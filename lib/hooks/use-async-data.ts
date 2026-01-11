import { useState, useEffect, useCallback, useRef } from 'react';

export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

/**
 * Generic hook for async data loading with loading/error states.
 *
 * @example
 * const { data: programs, loading, error, refetch } = useAsyncData(
 *   () => getPrograms(),
 *   []
 * );
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = []
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isMounted = useRef(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (isMounted.current) {
        setData(result);
      }
    } catch (e) {
      if (isMounted.current) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, deps);

  useEffect(() => {
    isMounted.current = true;
    fetch();
    return () => {
      isMounted.current = false;
    };
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export type LazyAsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
  fetch: () => Promise<T | null>;
};

/**
 * Lazy version that doesn't fetch on mount - you control when to fetch.
 */
export function useLazyAsyncData<T>(
  fetcher: () => Promise<T>
): LazyAsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (isMounted.current) {
        setData(result);
        return result;
      }
      return null;
    } catch (e) {
      if (isMounted.current) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
      return null;
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [fetcher]);

  return { data, loading, error, fetch };
}
