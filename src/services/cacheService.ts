import { MediaItem, MediaCategory, ScheduleDay } from '../types';

/**
 * Cache Envelope Format matching specification
 */
export interface CacheEnvelope<T = any> {
  data: T;
  timestamp: number;
  version: '1.3';
}

const CACHE_VERSION: '1.3' = '1.3';
const DB_NAME = 'satori_media_cache_db';
const STORE_NAME = 'media_cache_store';
const DB_VERSION = 1;

// 7 Days in Milliseconds: 7 * 24 * 60 * 60 * 1000
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// LocalStorage prefix
const LS_PREFIX = 'satori_cache_';

// -------------------------------------------------------------
// TIER 3: IN-MEMORY MAP FALLBACK & SYNC CACHE
// -------------------------------------------------------------
const memoryCache = new Map<string, CacheEnvelope<any>>();
const inFlightPrefetches = new Set<string>();

// -------------------------------------------------------------
// TIER 1: INDEXEDDB ENGINE
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
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };

        request.onsuccess = (event: Event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          resolve(db);
        };

        request.onerror = () => {
          console.warn('[CacheService] IndexedDB open error, using fallbacks.');
          resolve(null);
        };

        request.onblocked = () => {
          console.warn('[CacheService] IndexedDB blocked, using fallbacks.');
          resolve(null);
        };
      } catch (err) {
        console.warn('[CacheService] IndexedDB exception:', err);
        resolve(null);
      }
    });
  }

  return idbPromise;
}

// -------------------------------------------------------------
// MULTI-TIER STORAGE METHODS (IDB -> LocalStorage -> Memory)
// -------------------------------------------------------------

/**
 * Synchronous cache lookup for zero-latency initial render
 */
export function cacheGetSync<T>(key: string): T | null {
  // 1. Check in-memory Map
  const mem = memoryCache.get(key);
  if (mem && mem.version === CACHE_VERSION) {
    return mem.data as T;
  }

  // 2. Check LocalStorage synchronously
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(LS_PREFIX + key);
      if (raw) {
        const parsed = JSON.parse(raw) as CacheEnvelope<T>;
        if (parsed && parsed.version === CACHE_VERSION) {
          // Hydrate in-memory cache
          memoryCache.set(key, parsed);
          return parsed.data;
        }
      }
    } catch {
      // Ignore parse or storage errors
    }
  }

  return null;
}

/**
 * Asynchronous cache retrieval checking: Memory -> LocalStorage -> IndexedDB
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  // 1. Check sync memory first
  const syncResult = cacheGetSync<T>(key);
  if (syncResult !== null) {
    return syncResult;
  }

  // 2. Check IndexedDB
  try {
    const db = await getIDB();
    if (db) {
      const record = await new Promise<{ key: string; envelope: CacheEnvelope<T> } | null>((resolve) => {
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

      if (record && record.envelope && record.envelope.version === CACHE_VERSION) {
        // Hydrate memory cache
        memoryCache.set(key, record.envelope);
        return record.envelope.data;
      }
    }
  } catch (err) {
    console.warn('[CacheService] Error reading from IndexedDB:', err);
  }

  return null;
}

/**
 * Cache setter with multi-tier persistence (Memory + LocalStorage + IndexedDB)
 */
export async function cacheSet<T>(key: string, data: T): Promise<void> {
  const envelope: CacheEnvelope<T> = {
    data,
    timestamp: Date.now(),
    version: CACHE_VERSION,
  };

  // 1. Set In-Memory Map (Always succeeds)
  memoryCache.set(key, envelope);

  // 2. Set LocalStorage (Best-effort, small entries only to preserve quota for user data)
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const serialized = JSON.stringify(envelope);
      // Only keep small entries in LocalStorage (< 25KB) so IndexedDB handles large collections
      if (serialized.length < 25000) {
        window.localStorage.setItem(LS_PREFIX + key, serialized);
      }
    } catch {
      // Quota exceeded or private mode, gracefully skip LocalStorage
    }
  }

  // 3. Set IndexedDB (Primary large storage driver)
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
    console.warn('[CacheService] Error writing to IndexedDB:', err);
  }
}

/**
 * Remove an item from all cache tiers
 */
export async function cacheDelete(key: string): Promise<void> {
  memoryCache.delete(key);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(LS_PREFIX + key);
    } catch {
      // Ignore
    }
  }

  try {
    const db = await getIDB();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const transaction = db.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const delReq = store.delete(key);
          delReq.onsuccess = () => resolve();
          delReq.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch {
    // Ignore
  }
}

/**
 * Clear all cached records
 */
export async function cacheClear(): Promise<void> {
  memoryCache.clear();

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(LS_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
    } catch {
      // Ignore
    }
  }

  try {
    const db = await getIDB();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const transaction = db.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const clearReq = store.clear();
          clearReq.onsuccess = () => resolve();
          clearReq.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch {
    // Ignore
  }
}

// -------------------------------------------------------------
// 7-DAY AUTOMATIC EVICTION POLICY (`cleanStaleCache()`)
// -------------------------------------------------------------

/**
 * Purges entries older than 7 days (604,800,000 ms) or with outdated versions.
 * Executes automatically upon application launch.
 */
export async function cleanStaleCache(): Promise<number> {
  const now = Date.now();
  let purgedCount = 0;

  // 1. Purge In-Memory Cache
  for (const [key, envelope] of memoryCache.entries()) {
    if (envelope.version !== CACHE_VERSION || now - envelope.timestamp > SEVEN_DAYS_MS) {
      memoryCache.delete(key);
      purgedCount++;
    }
  }

  // 2. Purge LocalStorage entries
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const keysToClean: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(LS_PREFIX)) {
          try {
            const raw = window.localStorage.getItem(k);
            if (raw) {
              const envelope = JSON.parse(raw) as CacheEnvelope<any>;
              if (envelope.version !== CACHE_VERSION || now - envelope.timestamp > SEVEN_DAYS_MS) {
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

  // 3. Purge IndexedDB entries
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
              const env: CacheEnvelope<any> | undefined = record?.envelope;
              if (!env || env.version !== CACHE_VERSION || now - env.timestamp > SEVEN_DAYS_MS) {
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
    console.warn('[CacheService] Error cleaning stale IndexedDB entries:', err);
  }

  return purgedCount;
}

// Auto-run eviction on startup
if (typeof window !== 'undefined') {
  setTimeout(() => {
    cleanStaleCache().catch(() => {});
  }, 1000);
}

// -------------------------------------------------------------
// DEEP STRUCTURAL DIFFING ENGINE
// -------------------------------------------------------------

/**
 * Compares core streaming and metadata properties to prevent unwanted renders and layout shifts
 */
export function hasDataChanged<T>(cached: T, fresh: T): boolean {
  if (cached === fresh) return false;
  if (!cached && !fresh) return false;
  if (!cached || !fresh) return true;

  // If array, compare length and items
  if (Array.isArray(cached) && Array.isArray(fresh)) {
    if (cached.length !== fresh.length) return true;
    for (let i = 0; i < cached.length; i++) {
      if (hasDataChanged(cached[i], fresh[i])) return true;
    }
    return false;
  }

  // If object, perform targeted structural comparison for MediaItems, Schedules, etc.
  if (typeof cached === 'object' && typeof fresh === 'object') {
    const c = cached as Record<string, any>;
    const f = fresh as Record<string, any>;

    // Core MediaItem properties comparison
    const coreKeys = [
      'id',
      'title',
      'status',
      'latestEpisode',
      'totalEpisodes',
      'totalChapters',
      'totalVolumes',
      'currentEpisodeBadge',
      'nextEpisodeCountdown',
      'score',
      'coverImage',
      'bannerImage',
      'format',
      'category',
      'airingTime',
      'episodeNumber',
      'isAiringToday',
      'date',
      'day',
    ];

    for (const key of coreKeys) {
      if (key in c || key in f) {
        if (c[key] !== f[key]) {
          return true;
        }
      }
    }

    // Compare nested items array if present (e.g. ScheduleDay.items or Search.items)
    if (Array.isArray(c.items) && Array.isArray(f.items)) {
      if (c.items.length !== f.items.length) return true;
      for (let i = 0; i < c.items.length; i++) {
        if (hasDataChanged(c.items[i], f.items[i])) return true;
      }
    }

    // Compare genres / characters count
    if (Array.isArray(c.genres) && Array.isArray(f.genres)) {
      if (c.genres.length !== f.genres.length) return true;
    }
    if (Array.isArray(c.characters) && Array.isArray(f.characters)) {
      if (c.characters.length !== f.characters.length) return true;
    }

    return false;
  }

  return cached !== fresh;
}

// -------------------------------------------------------------
// PRELOADED IMAGE CACHE & DECODED OBJECT HIERARCHY
// -------------------------------------------------------------
const preloadedImageUrls = new Set<string>();
const preloadedImageObjects = new Map<string, HTMLImageElement>();

/**
 * Checks synchronously if an image is already decoded and retained in memory
 */
export function isImagePreloaded(url: string): boolean {
  if (!url) return false;
  return preloadedImageUrls.has(url);
}

/**
 * Marks an image URL as loaded and cached in memory
 */
export function markImageLoaded(url: string): void {
  if (url) {
    preloadedImageUrls.add(url);
  }
}

/**
 * Preload an image URL into browser memory with HTMLImageElement decoding
 */
export function preloadImage(url: string): Promise<boolean> {
  if (!url || typeof window === 'undefined') return Promise.resolve(false);
  if (preloadedImageUrls.has(url)) return Promise.resolve(true);

  return new Promise((resolve) => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.src = url;

    // Retain object reference in memory cache map
    preloadedImageObjects.set(url, img);

    if (img.complete && img.naturalWidth > 0) {
      preloadedImageUrls.add(url);
      resolve(true);
      return;
    }

    img.onload = () => {
      preloadedImageUrls.add(url);
      resolve(true);
    };

    img.onerror = () => {
      resolve(false);
    };
  });
}

/**
 * Batch preloads images for an array of media items silently in the background
 */
export function preloadMediaImages(items: (MediaItem | { coverImage?: string; bannerImage?: string })[]): void {
  if (!items || !Array.isArray(items) || typeof window === 'undefined') return;

  // Use requestIdleCallback or setTimeout to not block main thread
  const execute = () => {
    for (const item of items.slice(0, 15)) {
      if (item.coverImage) {
        preloadImage(item.coverImage);
      }
      if ('bannerImage' in item && item.bannerImage) {
        preloadImage(item.bannerImage);
      }
    }
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(execute, { timeout: 1000 });
  } else {
    setTimeout(execute, 50);
  }
}

// -------------------------------------------------------------
// PREFETCHING & PREDICTIVE LOADING ENGINE
// -------------------------------------------------------------

/**
 * Predictive background fetcher that warms the cache for media details and chapters
 * when a media card enters the viewport.
 */
export async function prefetchMediaDetails(
  id: string | number,
  category: MediaCategory = 'anime'
): Promise<void> {
  const mediaIdStr = String(id);
  const cacheKey = `media_details_${mediaIdStr}`;

  // If already cached or prefetch is in progress, skip
  if (cacheGetSync(cacheKey) || inFlightPrefetches.has(mediaIdStr)) {
    return;
  }

  inFlightPrefetches.add(mediaIdStr);

  try {
    // Dynamic import of fetcher to prevent circular dependencies
    const { fetchMediaDetailsById } = await import('./apiClient');
    const details = await fetchMediaDetailsById(mediaIdStr);
    if (details) {
      await cacheSet(cacheKey, details);
    }
  } catch (err) {
    // Silent fail for background prefetch
  } finally {
    inFlightPrefetches.delete(mediaIdStr);
  }
}
