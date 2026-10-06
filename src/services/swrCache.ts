import { hasDataChanged, preloadMediaImages } from './cacheService';

/**
 * Enhanced SWR Cache Envelope
 */
export interface SWREnvelope<T = any> {
  data: T;
  timestamp: number;
  lastAccessed: number;
  version: '2.0';
  maxAge?: number;
  freshness?: number;
}

const SWR_VERSION: '2.0' = '2.0';
const DB_NAME = 'satori_swr_cache_v2';
const STORE_NAME = 'swr_store';
const DB_VERSION = 1;

// Maximum number of items in memory LRU cache to prevent memory bloat
const MAX_MEMORY_CACHE_ITEMS = 600;

// Default Freshness Windows (Time to Live before background revalidation is needed)
export const FRESHNESS_WINDOWS = {
  CHAPTERS: 20 * 60 * 1000,      // 20 minutes for Novel/Manga Chapters
  MEDIA_DETAILS: 12 * 60 * 1000, // 12 minutes for Media Details & Metadata
  FEED: 4 * 60 * 1000,           // 4 minutes for Home/Trending/Popular Feeds
  SCHEDULE: 8 * 60 * 1000,       // 8 minutes for Airing Schedules
  SEARCH: 10 * 60 * 1000,        // 10 minutes for Search results
  DEFAULT: 5 * 60 * 1000,        // 5 minutes default
};

// Default Maximum Cache Expiries (Total time data stays in storage before eviction)
export const MAX_AGE_LIMITS = {
  CHAPTERS: 14 * 24 * 60 * 60 * 1000, // 14 days for Novel & Manga Chapters
  MEDIA_DETAILS: 7 * 24 * 60 * 60 * 1000, // 7 days for Media Details
  FEED: 24 * 60 * 60 * 1000,         // 24 hours for Feed lists
  SCHEDULE: 48 * 60 * 60 * 1000,     // 48 hours for Schedules
  SEARCH: 24 * 60 * 60 * 1000,       // 24 hours for Search
  DEFAULT: 7 * 24 * 60 * 60 * 1000,  // 7 days default
};

const LS_PREFIX = 'satori_swr_';

// -------------------------------------------------------------
// IN-MEMORY TIER & REAL-TIME EVENT BUS
// -------------------------------------------------------------
const memoryCache = new Map<string, SWREnvelope<any>>();
const inFlightRequests = new Map<string, Promise<any>>();
const subscribers = new Map<string, Set<(data: any) => void>>();

// -------------------------------------------------------------
// INDEXEDDB INSTANCE MANAGEMENT
// -------------------------------------------------------------
let idbPromise: Promise<IDBDatabase | null> | null = null;

function getIDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (!idbPromise) {
    idbPromise = new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            store.createIndex('timestamp', 'envelope.timestamp', { unique: false });
            store.createIndex('lastAccessed', 'envelope.lastAccessed', { unique: false });
          }
        };

        request.onsuccess = (event: Event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          resolve(db);
        };

        request.onerror = () => {
          console.warn('[SWRCache] IndexedDB unavailable, using memory & localStorage.');
          resolve(null);
        };

        request.onblocked = () => {
          console.warn('[SWRCache] IndexedDB open blocked.');
          resolve(null);
        };
      } catch (err) {
        console.warn('[SWRCache] IndexedDB initialization error:', err);
        resolve(null);
      }
    });
  }

  return idbPromise;
}

/**
 * Determine default freshness and maxAge limits based on cache key prefix
 */
export function getTtlForKey(key: string): { freshness: number; maxAge: number } {
  const lower = key.toLowerCase();
  if (lower.includes('chapter') || lower.includes('volume') || lower.includes('novel_ch_') || lower.includes('manga_ch_')) {
    return { freshness: FRESHNESS_WINDOWS.CHAPTERS, maxAge: MAX_AGE_LIMITS.CHAPTERS };
  }
  if (lower.includes('media_details_') || lower.includes('detail_') || lower.includes('info_')) {
    return { freshness: FRESHNESS_WINDOWS.MEDIA_DETAILS, maxAge: MAX_AGE_LIMITS.MEDIA_DETAILS };
  }
  if (lower.includes('schedule') || lower.includes('airing')) {
    return { freshness: FRESHNESS_WINDOWS.SCHEDULE, maxAge: MAX_AGE_LIMITS.SCHEDULE };
  }
  if (lower.includes('search_')) {
    return { freshness: FRESHNESS_WINDOWS.SEARCH, maxAge: MAX_AGE_LIMITS.SEARCH };
  }
  if (lower.includes('home_') || lower.includes('feed_') || lower.includes('trending') || lower.includes('popular')) {
    return { freshness: FRESHNESS_WINDOWS.FEED, maxAge: MAX_AGE_LIMITS.FEED };
  }
  return { freshness: FRESHNESS_WINDOWS.DEFAULT, maxAge: MAX_AGE_LIMITS.DEFAULT };
}

// -------------------------------------------------------------
// SWR GET (SYNC & ASYNC)
// -------------------------------------------------------------

export interface SWRRecord<T> {
  data: T;
  timestamp: number;
  isFresh: boolean;
}

/**
 * Fast synchronous lookup in Memory / LocalStorage.
 * Returns instantly (0ms) on component mount.
 */
export function swrGetSync<T>(key: string): SWRRecord<T> | null {
  const now = Date.now();
  const ttls = getTtlForKey(key);

  // 1. Check in-memory LRU Map
  const mem = memoryCache.get(key);
  if (mem && mem.version === SWR_VERSION) {
    mem.lastAccessed = now;
    const freshnessWindow = mem.freshness || ttls.freshness;
    const isFresh = now - mem.timestamp < freshnessWindow;
    return { data: mem.data as T, timestamp: mem.timestamp, isFresh };
  }

  // 2. Synchronous LocalStorage check
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(LS_PREFIX + key);
      if (raw) {
        const parsed = JSON.parse(raw) as SWREnvelope<T>;
        if (parsed && parsed.version === SWR_VERSION) {
          parsed.lastAccessed = now;
          memoryCache.set(key, parsed);
          const freshnessWindow = parsed.freshness || ttls.freshness;
          const isFresh = now - parsed.timestamp < freshnessWindow;
          return { data: parsed.data, timestamp: parsed.timestamp, isFresh };
        }
      }
    } catch {
      // Ignore parse or storage quota errors
    }
  }

  return null;
}

/**
 * Asynchronous multi-tier lookup (Memory -> LocalStorage -> IndexedDB)
 */
export async function swrGet<T>(key: string): Promise<SWRRecord<T> | null> {
  // 1. Check synchronous cache first
  const syncResult = swrGetSync<T>(key);
  if (syncResult !== null) {
    return syncResult;
  }

  // 2. Check IndexedDB
  try {
    const db = await getIDB();
    if (db) {
      const record = await new Promise<{ key: string; envelope: SWREnvelope<T> } | null>((resolve) => {
        try {
          const transaction = db.transaction([STORE_NAME], 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const getReq = store.get(key);
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });

      if (record && record.envelope && record.envelope.version === SWR_VERSION) {
        const now = Date.now();
        record.envelope.lastAccessed = now;
        memoryCache.set(key, record.envelope);

        const ttls = getTtlForKey(key);
        const freshnessWindow = record.envelope.freshness || ttls.freshness;
        const isFresh = now - record.envelope.timestamp < freshnessWindow;

        return {
          data: record.envelope.data,
          timestamp: record.envelope.timestamp,
          isFresh,
        };
      }
    }
  } catch (err) {
    console.warn('[SWRCache] Error reading from IndexedDB:', err);
  }

  return null;
}

// -------------------------------------------------------------
// SWR SET & MUTATION WITH REAL-TIME BROADCAST
// -------------------------------------------------------------

/**
 * Set a key in the SWR Cache and notify all active listeners
 */
export async function swrSet<T>(
  key: string,
  data: T,
  options?: { maxAge?: number; freshness?: number }
): Promise<void> {
  const now = Date.now();
  const ttls = getTtlForKey(key);

  const envelope: SWREnvelope<T> = {
    data,
    timestamp: now,
    lastAccessed: now,
    version: SWR_VERSION,
    maxAge: options?.maxAge || ttls.maxAge,
    freshness: options?.freshness || ttls.freshness,
  };

  // LRU Eviction check for memory cache
  if (memoryCache.size >= MAX_MEMORY_CACHE_ITEMS) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [k, v] of memoryCache.entries()) {
      if (v.lastAccessed < oldestTime) {
        oldestTime = v.lastAccessed;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      memoryCache.delete(oldestKey);
    }
  }

  // 1. In-Memory Map
  memoryCache.set(key, envelope);

  // 2. Broadcast to all mounted subscribers across the app
  notifySubscribers(key, data);

  // 3. Set LocalStorage (Best effort for small records under 30KB)
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const serialized = JSON.stringify(envelope);
      if (serialized.length < 30000) {
        window.localStorage.setItem(LS_PREFIX + key, serialized);
      }
    } catch {
      // Storage quota or private browsing mode
    }
  }

  // 4. IndexedDB for persistent storage
  try {
    const db = await getIDB();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const transaction = db.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const putReq = store.put({ key, envelope });
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch (err) {
    console.warn('[SWRCache] Error persisting to IndexedDB:', err);
  }
}

/**
 * Optimistic mutation: updates cache immediately, notifies subscribers, and optionally revalidates
 */
export async function swrMutate<T>(
  key: string,
  dataOrUpdater?: T | ((prev: T | undefined) => T),
  shouldRevalidate = false,
  fetcher?: () => Promise<T>
): Promise<T | undefined> {
  let updatedData: T | undefined;

  if (dataOrUpdater !== undefined) {
    if (typeof dataOrUpdater === 'function') {
      const existing = swrGetSync<T>(key);
      updatedData = (dataOrUpdater as any)(existing?.data);
    } else {
      updatedData = dataOrUpdater;
    }

    if (updatedData !== undefined) {
      await swrSet(key, updatedData);
    }
  }

  if (shouldRevalidate && fetcher) {
    try {
      const fresh = await swrFetchDedupe(key, fetcher);
      await swrSet(key, fresh);
      return fresh;
    } catch (err) {
      console.warn(`[SWRCache] Revalidation failed during mutate for key "${key}":`, err);
    }
  }

  return updatedData;
}

// -------------------------------------------------------------
// REQUEST DEDUPLICATION & IN-FLIGHT SHARING
// -------------------------------------------------------------

/**
 * Deduplicates in-flight network requests.
 * If 5 components request the same key concurrently, only 1 network request is made.
 */
export function swrFetchDedupe<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key)! as Promise<T>;
  }

  const promise = (async () => {
    try {
      const data = await fetcher();
      return data;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, promise);
  return promise;
}

// -------------------------------------------------------------
// EVENT SUBSCRIPTION SYSTEM (Global Sync Across Components)
// -------------------------------------------------------------

export function swrSubscribe<T>(key: string, callback: (data: T) => void): () => void {
  if (!subscribers.has(key)) {
    subscribers.set(key, new Set());
  }
  const keySubscribers = subscribers.get(key)!;
  keySubscribers.add(callback);

  return () => {
    keySubscribers.delete(callback);
    if (keySubscribers.size === 0) {
      subscribers.delete(key);
    }
  };
}

function notifySubscribers(key: string, data: any): void {
  const keySubscribers = subscribers.get(key);
  if (keySubscribers && keySubscribers.size > 0) {
    keySubscribers.forEach((callback) => {
      try {
        callback(data);
      } catch (err) {
        console.error('[SWRCache] Error in subscriber callback:', err);
      }
    });
  }
}

// -------------------------------------------------------------
// AUTOMATIC EVICTION & CLEANUP ENGINE
// -------------------------------------------------------------

/**
 * Purges items exceeding their maxAge or invalid version
 */
export async function cleanStaleSWRCache(): Promise<number> {
  const now = Date.now();
  let purgedCount = 0;

  // 1. Clean Memory
  for (const [key, env] of memoryCache.entries()) {
    const ttls = getTtlForKey(key);
    const maxAge = env.maxAge || ttls.maxAge;
    if (env.version !== SWR_VERSION || now - env.timestamp > maxAge) {
      memoryCache.delete(key);
      purgedCount++;
    }
  }

  // 2. Clean LocalStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const keysToClean: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(LS_PREFIX)) {
          try {
            const raw = window.localStorage.getItem(k);
            if (raw) {
              const env = JSON.parse(raw) as SWREnvelope<any>;
              const origKey = k.replace(LS_PREFIX, '');
              const ttls = getTtlForKey(origKey);
              const maxAge = env.maxAge || ttls.maxAge;
              if (env.version !== SWR_VERSION || now - env.timestamp > maxAge) {
                keysToClean.push(k);
              }
            } else {
              keysToClean.push(k);
            }
          } catch {
            keysToClean.push(k);
          }
        }
      }
      keysToClean.forEach((k) => {
        window.localStorage.removeItem(k);
        purgedCount++;
      });
    } catch {
      // Ignore
    }
  }

  // 3. Clean IndexedDB
  try {
    const db = await getIDB();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const transaction = db.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const cursorReq = store.openCursor();

          cursorReq.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              const record = cursor.value;
              const env: SWREnvelope<any> | undefined = record?.envelope;
              const key: string = record?.key || '';
              const ttls = getTtlForKey(key);
              const maxAge = env?.maxAge || ttls.maxAge;

              if (!env || env.version !== SWR_VERSION || now - env.timestamp > maxAge) {
                cursor.delete();
                purgedCount++;
              }
              cursor.continue();
            } else {
              resolve();
            }
          };

          cursorReq.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch (err) {
    console.warn('[SWRCache] Error cleaning IndexedDB:', err);
  }

  return purgedCount;
}

// Auto-run cleanup silently in idle time
if (typeof window !== 'undefined') {
  setTimeout(() => {
    cleanStaleSWRCache().catch(() => {});
  }, 3000);
}
