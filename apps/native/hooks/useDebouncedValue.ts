import { useCallback, useEffect, useState } from 'react';

/**
 * 값이 delayMs 동안 바뀌지 않으면 따라간다. flush()는 기다리지 않고 지금 값으로 맞춘다(검색 키 등).
 */
export function useDebouncedValue<T>(
  value: T,
  delayMs: number
): [T, () => void] {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  const flush = useCallback(() => setDebounced(value), [value]);

  return [debounced, flush];
}
