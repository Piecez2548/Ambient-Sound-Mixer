import { useEffect, useState } from 'react';

interface Bridge {
  getUpdate?: () => Promise<string | null>;
  onUpdateReady?: (cb: (version: string) => void) => () => void;
  installUpdate?: () => void;
}

/** Windows app only: a new version has been downloaded and can be installed with a restart. */
export function useUpdate() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    const bridge = (window as any).ambient as Bridge | undefined;
    if (!bridge?.onUpdateReady) return;
    let alive = true;
    // It may have finished downloading before this window opened.
    bridge.getUpdate?.().then((v) => alive && v && setVersion(v)).catch(() => {});
    const off = bridge.onUpdateReady(setVersion);
    return () => {
      alive = false;
      off();
    };
  }, []);

  return { version, install: () => (window as any).ambient?.installUpdate?.() };
}

export type UpdateState = ReturnType<typeof useUpdate>;
