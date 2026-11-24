import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

interface AsyncState<T> {
  data: T | null;
  error: unknown;
  isLoading: boolean;
}

/**
 * Runs an async loader when its dependencies change and ignores results from stale runs.
 * `reload` re-runs it on demand (for example after a mutation).
 */
export function useAsync<T>(loader: () => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, isLoading: true });
  const runId = useRef(0);
  const loaderRef = useRef(loader);
  useLayoutEffect(() => {
    loaderRef.current = loader;
  });

  const run = useCallback(async (silent = false) => {
    const id = ++runId.current;
    if (!silent) setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await loaderRef.current();
      if (id === runId.current) setState({ data, error: null, isLoading: false });
    } catch (error) {
      if (id === runId.current) setState((prev) => ({ data: silent ? prev.data : null, error, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    void run();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  const setData = useCallback((updater: (prev: T | null) => T | null) => {
    setState((prev) => ({ ...prev, data: updater(prev.data) }));
  }, []);

  return { ...state, reload: () => run(), refresh: () => run(true), setData };
}
