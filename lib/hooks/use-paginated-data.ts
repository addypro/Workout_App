import { useState, useCallback, useEffect, useRef } from 'react';

export type PaginatedResult<T> = {
  items: T[];
  total: number;
};

export type PaginatedState<T> = {
  data: T[];
  total: number;
  loading: boolean;
  paging: boolean;
  hasMore: boolean;
  loadMore: () => void;
  reset: () => Promise<void>;
  error: Error | null;
};

type FetchFn<T, F> = (params: {
  offset: number;
  limit: number;
  filters: F;
  query?: string;
}) => Promise<PaginatedResult<T>>;

/**
 * Hook for paginated data loading with infinite scroll support.
 *
 * @example
 * const { data, loading, paging, hasMore, loadMore } = usePaginatedData({
 *   fetcher: ({ offset, limit, filters, query }) =>
 *     programsService.listCatalog({ q: query, filters, limit, offset }),
 *   pageSize: 50,
 *   filters: { type: 'STRENGTH' },
 *   query: searchText,
 * });
 */
export function usePaginatedData<T, F = Record<string, unknown>>({
  fetcher,
  pageSize = 50,
  filters,
  query = '',
}: {
  fetcher: FetchFn<T, F>;
  pageSize?: number;
  filters: F;
  query?: string;
}): PaginatedState<T> {
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isMounted = useRef(true);
  const loadingRef = useRef(false);

  // Reset and load first page when filters/query change
  const reset = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const result = await fetcher({
        offset: 0,
        limit: pageSize,
        filters,
        query: query || undefined,
      });

      if (isMounted.current) {
        setData(result.items);
        setTotal(result.total);
      }
    } catch (e) {
      if (isMounted.current) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      loadingRef.current = false;
    }
  }, [fetcher, pageSize, filters, query]);

  // Load next page
  const loadMore = useCallback(async () => {
    if (loadingRef.current || loading || paging) return;
    if (data.length >= total) return;

    loadingRef.current = true;
    setPaging(true);

    try {
      const result = await fetcher({
        offset: data.length,
        limit: pageSize,
        filters,
        query: query || undefined,
      });

      if (isMounted.current) {
        setData(prev => [...prev, ...result.items]);
        setTotal(result.total);
      }
    } catch (e) {
      if (isMounted.current) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    } finally {
      if (isMounted.current) {
        setPaging(false);
      }
      loadingRef.current = false;
    }
  }, [fetcher, pageSize, filters, query, data.length, total, loading, paging]);

  // Initial load and reload on filter/query change
  useEffect(() => {
    isMounted.current = true;
    reset();
    return () => {
      isMounted.current = false;
    };
  }, [reset]);

  return {
    data,
    total,
    loading,
    paging,
    hasMore: data.length < total,
    loadMore,
    reset,
    error,
  };
}
