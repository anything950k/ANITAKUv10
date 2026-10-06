import { useState, useEffect, useRef, useCallback } from 'react';
import {
  swrGetSync,
  swrGet,
  swrSet,
  swrMutate,
  swrFetchDedupe,
  swrSubscribe,
  getTtlForKey,
} from '../services/swrCache';
import { hasDataChanged, preloadMediaImages } from '../services/cacheService';

export interface SWROptions<T> {
  freshnessWindow?: number; // Custom freshness window in ms (if data is fresher than this, skip revalidation)
  dedupingInterval?: number; // Deduplicate requests within this interval in ms (default: 3000)
  revalidateOnMount?: boolean; // Revalidate when component mounts (default: true if stale)
  revalidateOnFocus?: boolean; // Revalidate when window/tab regains focus (default: true)
  revalidateOnReconnect?: boolean; // Revalidate when network reconnects (default: true)
  pollingInterval?: number; // Optional periodic background polling in ms
  enabled?: boolean; // Whether the query is active (default: true)
  fallbackData?: T; // Initial data if no cache exists
  compareFn?: (cached: T, fresh: T) => boolean; // Custom comparator
  onSuccess?: (data: T) => void; // Callback when fresh data arrives
  onError?: (err: Error) => void; // Callback on error
}

export interface SWRResponse<T> {
  data: T;
  error: Error | null;
  isLoading: boolean; // True ONLY when waiting for initial data with no cached value
  isValidating: boolean; // True during background revalidation
  mutate: (newData?: T | ((prev: T) => T), shouldRevalidate?: boolean) => Promise<T | undefined>;
  refresh: () => Promise<void>;
}

/**
 * Modern Stale-While-Revalidate (SWR) Hook
 * Provides instant 0ms cached renders, background silent revalidation,
 * cross-component real-time synchronization, and offline persistence.
 */
export function useSWR<T>(
  key: string | null | undefined,
  fetcher?: (() => Promise<T>) | null,
  options: SWROptions<T> = {}
): SWRResponse<T> {
  const {
    freshnessWindow,
    dedupingInterval = 3000,
    revalidateOnMount = true,
    revalidateOnFocus = true,
    revalidateOnReconnect = true,
    pollingInterval = 0,
    enabled = true,
    fallbackData,
    compareFn = hasDataChanged,
    onSuccess,
    onError,
  } = options;

  const resolvedTtl = key ? getTtlForKey(key) : { freshness: 5 * 60 * 1000, maxAge: 7 * 24 * 60 * 60 * 1000 };
  const effectiveFreshness = freshnessWindow !== undefined ? freshnessWindow : resolvedTtl.freshness;

  // 1. Instant Synchronous Cache Hit (0ms)
  const syncRecord = key ? swrGetSync<T>(key) : null;
  const hasSyncCache = syncRecord !== null;

  const [data, setData] = useState<T>(() => {
    if (hasSyncCache) return syncRecord.data;
    if (fallbackData !== undefined) return fallbackData;
    return [] as unknown as T;
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => !hasSyncCache && fallbackData === undefined);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Mutable refs to prevent stale closures and unnecessary effect re-runs
  const dataRef = useRef<T>(data);
  dataRef.current = data;

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const compareFnRef = useRef(compareFn);
  compareFnRef.current = compareFn;

  const lastFetchTimeRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  // -------------------------------------------------------------
  // REVALIDATION EXECUTION
  // -------------------------------------------------------------
  const executeRevalidation = useCallback(async (isSilent = true, force = false): Promise<void> => {
    if (!key || !fetcherRef.current || !enabled) return;

    const now = Date.now();
    // Request deduping window
    if (!force && now - lastFetchTimeRef.current < dedupingInterval) {
      return;
    }

    // Check freshness window if not forced
    if (!force) {
      const currentSync = swrGetSync<T>(key);
      if (currentSync && now - currentSync.timestamp < effectiveFreshness) {
        // Data is still completely fresh, skip background revalidation
        return;
      }
    }

    lastFetchTimeRef.current = now;

    if (!isSilent && isMountedRef.current) {
      setIsValidating(true);
    }

    try {
      // In-flight request deduplication across all components
      const freshData = await swrFetchDedupe<T>(key, fetcherRef.current);

      if (!isMountedRef.current) return;

      const currentData = dataRef.current;

      // Retain existing populated array if an upstream error or unexpected empty array returned
      const isFreshEmpty = Array.isArray(freshData) && freshData.length === 0;
      const isCurrentPopulated = Array.isArray(currentData) && currentData.length > 0;

      if (isFreshEmpty && isCurrentPopulated) {
        if (isMountedRef.current) {
          setIsLoading(false);
          setIsValidating(false);
        }
        return;
      }

      const isChanged = compareFnRef.current(currentData, freshData);

      if (isChanged) {
        await swrSet(key, freshData, { freshness: effectiveFreshness });

        if (isMountedRef.current) {
          setData(freshData);
          dataRef.current = freshData;
          if (Array.isArray(freshData)) {
            preloadMediaImages(freshData);
          }
          if (onSuccessRef.current) {
            onSuccessRef.current(freshData);
          }
        }
      } else {
        // Structurally identical: refresh timestamp silently
        await swrSet(key, currentData, { freshness: effectiveFreshness });
        if (Array.isArray(currentData)) {
          preloadMediaImages(currentData);
        }
      }

      if (isMountedRef.current) {
        setError(null);
        setIsLoading(false);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn(`[useSWR] Revalidation error for key "${key}":`, err);
      }
      if (isMountedRef.current) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        setIsLoading(false);
        if (onErrorRef.current) {
          onErrorRef.current(errorObj);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsValidating(false);
      }
    }
  }, [key, enabled, dedupingInterval, effectiveFreshness]);

  // -------------------------------------------------------------
  // MOUNT INITIALIZATION & INDEXEDDB HYDRATION
  // -------------------------------------------------------------
  useEffect(() => {
    isMountedRef.current = true;

    if (!key) {
      setIsLoading(false);
      return;
    }

    async function hydrateAndRevalidate() {
      // If we didn't have a sync memory hit, query async IndexedDB
      if (!hasSyncCache) {
        const asyncRecord = await swrGet<T>(key!);
        if (asyncRecord !== null && isMountedRef.current) {
          setData(asyncRecord.data);
          dataRef.current = asyncRecord.data;
          setIsLoading(false);
          if (Array.isArray(asyncRecord.data)) {
            preloadMediaImages(asyncRecord.data);
          }

          // If IndexedDB data is fresh, no immediate revalidation is needed!
          if (asyncRecord.isFresh) {
            return;
          }
        }
      }

      if (revalidateOnMount && enabled && fetcherRef.current) {
        const currentSync = swrGetSync<T>(key!);
        const isStale = !currentSync || !currentSync.isFresh;
        if (isStale) {
          executeRevalidation(hasSyncCache, false);
        }
      }
    }

    hydrateAndRevalidate();

    return () => {
      isMountedRef.current = false;
    };
  }, [key, enabled, revalidateOnMount, executeRevalidation]);

  // -------------------------------------------------------------
  // CROSS-COMPONENT REAL-TIME SYNCHRONIZATION
  // -------------------------------------------------------------
  useEffect(() => {
    if (!key) return;

    // Subscribe to global mutations of this key
    const unsubscribe = swrSubscribe<T>(key, (updatedData) => {
      if (isMountedRef.current) {
        setData(updatedData);
        dataRef.current = updatedData;
        setIsLoading(false);
        if (Array.isArray(updatedData)) {
          preloadMediaImages(updatedData);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [key]);

  // -------------------------------------------------------------
  // REVALIDATION TRIGGERS (FOCUS, RECONNECT, POLLING)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!enabled || !key) return;

    // Window Focus & Visibility Change
    const handleFocus = () => {
      if (revalidateOnFocus && typeof document !== 'undefined' && document.visibilityState === 'visible') {
        executeRevalidation(true, false);
      }
    };

    // Network Reconnect
    const handleOnline = () => {
      if (revalidateOnReconnect) {
        executeRevalidation(true, true);
      }
    };

    if (revalidateOnFocus) {
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleFocus);
    }

    if (revalidateOnReconnect) {
      window.addEventListener('online', handleOnline);
    }

    return () => {
      if (revalidateOnFocus) {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleFocus);
      }
      if (revalidateOnReconnect) {
        window.removeEventListener('online', handleOnline);
      }
    };
  }, [key, enabled, revalidateOnFocus, revalidateOnReconnect, executeRevalidation]);

  // Optional periodic polling
  useEffect(() => {
    if (!enabled || !key || pollingInterval <= 0) return;

    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        executeRevalidation(true, false);
      }
    }, pollingInterval);

    return () => clearInterval(intervalId);
  }, [key, enabled, pollingInterval, executeRevalidation]);

  // -------------------------------------------------------------
  // MANUAL MUTATION & REFRESH HELPERS
  // -------------------------------------------------------------
  const mutate = useCallback(async (
    newData?: T | ((prev: T) => T),
    shouldRevalidate = false
  ): Promise<T | undefined> => {
    if (!key) return undefined;
    return swrMutate<T>(key, newData as any, shouldRevalidate, fetcherRef.current || undefined);
  }, [key]);

  const refresh = useCallback(async (): Promise<void> => {
    await executeRevalidation(false, true);
  }, [executeRevalidation]);

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
    refresh,
  };
}
