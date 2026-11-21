import { useEffect, useRef, useState } from 'react';

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

// Cloud sync hooks in here: it hears about values the user changed, and can
// push values from the cloud into the live React state.
type WriteListener = (key: string) => void;
const writeListeners = new Set<WriteListener>();
const remoteSubscribers = new Map<string, Set<(value: unknown) => void>>();

/** Called after the user changes a persisted value on this device. */
export function onLocalWrite(listener: WriteListener) {
  writeListeners.add(listener);
  return () => void writeListeners.delete(listener);
}

/** Store a value that came from another device and update any mounted state using it. */
export function applyRemote(key: string, value: unknown) {
  storage.set(key, value);
  remoteSubscribers.get(key)?.forEach((fn) => fn(value));
}

export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = storage.get<T>(key);
    return stored === undefined ? initial : stored;
  });
  const previous = useRef(value);
  const fromRemote = useRef(false);

  useEffect(() => {
    const subs = remoteSubscribers.get(key) ?? new Set();
    remoteSubscribers.set(key, subs);
    const fn = (v: unknown) => {
      if (Object.is(previous.current, v)) return; // same primitive: no render, no flag
      fromRemote.current = true;
      setValue(v as T);
    };
    subs.add(fn);
    return () => void subs.delete(fn);
  }, [key]);

  useEffect(() => {
    if (Object.is(previous.current, value)) return; // first render: nothing changed
    previous.current = value;
    storage.set(key, value);
    if (fromRemote.current) {
      fromRemote.current = false;
      return;
    }
    writeListeners.forEach((fn) => fn(key));
  }, [key, value]);

  return [value, setValue] as const;
}
