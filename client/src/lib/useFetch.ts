import { useCallback, useEffect, useState, type DependencyList } from 'react';
import { ApiError } from './api';

interface State<T> { data: T | undefined; loading: boolean; error: string | undefined }

export function useFetch<T>(fn: () => Promise<T>, deps: DependencyList = [], enabled = true) {
  const [state, setState] = useState<State<T>>({ data: undefined, loading: enabled, error: undefined });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) { setState({ data: undefined, loading: false, error: undefined }); return; }
    let alive = true;
    setState(s => ({ ...s, loading: true, error: undefined }));
    fn()
      .then(data => { if (alive) setState({ data, loading: false, error: undefined }); })
      .catch(err => {
        if (alive) setState({ data: undefined, loading: false, error: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' });
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled]);

  const retry = useCallback(() => setNonce(n => n + 1), []);
  return { ...state, retry };
}
