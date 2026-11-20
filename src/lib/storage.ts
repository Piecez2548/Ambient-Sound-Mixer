import { useEffect, useState } from 'react';

// localStorage can throw (private mode, blocked storage) — never let that break the app.
export const storage = {
  get<T>(key: string): T | undefined {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch {
      return undefined;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = storage.get<T>(key);
    return stored === undefined ? initial : stored;
  });
  useEffect(() => storage.set(key, value), [key, value]);
  return [value, setValue] as const;
}
