import { useCallback } from 'react';
import { useSWR, SWROptions } from './useSWR';
import { hasDataChanged } from '../services/cacheService';

export interface UseCachedApiOptions<T> {
  pollingInterval?: number; // Background polling interval in ms (default: 60,000 ms)
  enabled?: boolean; // Whether the fetch/poll is active (default: true)
  revalidateOnMount?: boolean; // Whether to fetch in background on mount (default: true)
  revalidateOnFocus?: boolean; // Revalidate when user returns to window/tab (default: true)
  compareFn?: (cached: T, fresh: T) => boolean; // Custom comparator function
  onUpdate?: (newData: T) => void; // Callback when fresh data differs and is applied
  fallbackData?: T; // Initial fallback data if no cache exists
}

export interface UseCachedApiResult<T> {
  data: T;
  loading: boolean;
  isRevalidating: boolean;
  error: Error | null;
  mutate: (newData?: T | ((prev: T) => T), shouldRevalidate?: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * High-performance central caching and state synchronization hook
 * Powered by our modern SWR engine with 2-tier storage, deduping, and multi-component sync.
 */
export function useCachedApi<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseCachedApiOptions<T> = {}
): UseCachedApiResult<T> {
  const {
    pollingInterval = 60000,
    enabled = true,
    revalidateOnMount = true,
    revalidateOnFocus = true,
    compareFn = hasDataChanged,
    onUpdate,
    fallbackData,
  } = options;

  const swrOptions: SWROptions<T> = {
    pollingInterval,
    enabled,
    revalidateOnMount,
    revalidateOnFocus,
    revalidateOnReconnect: true,
    compareFn,
    onSuccess: onUpdate,
    fallbackData,
  };

  const {
    data,
    isLoading,
    isValidating,
    error,
    mutate: swrMutate,
    refresh: swrRefresh,
  } = useSWR<T>(key, fetcher, swrOptions);

  const mutate = useCallback(
    async (newData?: T | ((prev: T) => T), shouldRevalidate = true) => {
      await swrMutate(newData, shouldRevalidate);
    },
    [swrMutate]
  );

  return {
    data,
    loading: isLoading,
    isRevalidating: isValidating,
    error,
    mutate,
    refresh: swrRefresh,
  };
}
