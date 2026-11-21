import { useCallback, useEffect, useRef, useState } from 'react';
import { onLocalWrite } from '../lib/storage';
import {
  SyncError,
  deleteCloudCopy,
  generateCode,
  isSyncKey,
  markChanged,
  readMeta,
  syncOnce,
  writeMeta,
  type SyncMeta,
  type SyncStatus,
} from '../lib/sync';

const PUSH_DELAY_MS = 1500; // wait for slider drags to settle
const POLL_MS = 45_000; // check for other devices' changes while visible

export type SyncErrorCode = SyncError['code'];

export function useSync() {
  const [meta, setMeta] = useState<SyncMeta | null>(() => readMeta());
  const [status, setStatus] = useState<SyncStatus>(() => (readMeta() ? 'syncing' : 'off'));
  const [error, setError] = useState<SyncErrorCode | null>(null);
  const running = useRef(false);
  const queued = useRef(false);
  const pushTimer = useRef<number | undefined>(undefined);

  const run = useCallback(async (joining = false): Promise<boolean> => {
    if (!readMeta()) return false;
    if (running.current) {
      queued.current = true;
      return true;
    }
    running.current = true;
    setStatus('syncing');
    try {
      const m = await syncOnce(joining);
      setMeta(m);
      setStatus(m ? 'ok' : 'off');
      setError(null);
      return true;
    } catch (e) {
      setStatus('error');
      setError(e instanceof SyncError ? e.code : 'server');
      if (!readMeta()) setMeta(null); // unlinked by the engine (cloud copy deleted)
      return false;
    } finally {
      running.current = false;
      if (queued.current) {
        queued.current = false;
        void run();
      }
    }
  }, []);

  // The user changed something synced: note when, and push shortly.
  useEffect(
    () =>
      onLocalWrite((key) => {
        if (!isSyncKey(key) || !readMeta()) return;
        markChanged(key);
        window.clearTimeout(pushTimer.current);
        pushTimer.current = window.setTimeout(() => void run(), PUSH_DELAY_MS);
      }),
    [run],
  );

  // On launch, catch up once.
  useEffect(() => {
    if (readMeta()) void run();
  }, [run]);

  // While linked: poll when visible, and catch up whenever the app comes back to the front.
  const code = meta?.code;
  useEffect(() => {
    if (!code) return;
    const visible = () => document.visibilityState === 'visible';
    const onShow = () => visible() && void run();
    const poll = window.setInterval(onShow, POLL_MS);
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    window.addEventListener('online', onShow);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('focus', onShow);
      window.removeEventListener('online', onShow);
    };
  }, [code, run]);

  const start = useCallback(
    async (newCode: string, joining: boolean) => {
      writeMeta({ code: newCode, rev: 0, ts: {}, lastSync: null });
      setMeta(readMeta());
      const ok = await run(joining);
      if (!ok && joining) {
        // Couldn't join (wrong code, offline…): stay unlinked so the user can retry.
        writeMeta(null);
        setMeta(null);
      }
      return ok;
    },
    [run],
  );

  /** Start syncing with a brand-new code; this device's data becomes the first copy. */
  const create = useCallback(() => start(generateCode(), false), [start]);
  /** Link this device to an existing code; the cloud copy wins, personal lists are combined. */
  const join = useCallback((c: string) => start(c, true), [start]);

  /** Stop syncing on this device (keeps everything local). */
  const stop = useCallback(() => {
    window.clearTimeout(pushTimer.current);
    writeMeta(null);
    setMeta(null);
    setStatus('off');
    setError(null);
  }, []);

  /** Delete the cloud copy for this code and stop syncing here. */
  const deleteCloud = useCallback(async () => {
    const m = readMeta();
    if (!m) return;
    try {
      await deleteCloudCopy(m.code);
      stop();
    } catch (e) {
      setStatus('error');
      setError(e instanceof SyncError ? e.code : 'server');
    }
  }, [stop]);

  return { meta, status, error, create, join, stop, deleteCloud, syncNow: () => run() };
}

export type Sync = ReturnType<typeof useSync>;
