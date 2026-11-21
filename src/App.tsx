import { useEffect, useState } from 'react';
import { CreateModal, type CreateTab } from './components/CreateModal';
import { MixerPanel } from './components/MixerPanel';
import { TemplatesPanel } from './components/TemplatesPanel';
import { TitleBar } from './components/TitleBar';
import { VideoPickerModal } from './components/VideoPickerModal';
import { YouTubeChannel } from './components/YouTubeChannel';
import { RoutinesModal, formatClock, type RoutinesTab } from './components/RoutinesModal';
import { useI18n } from './i18n';
import { readSharedMix } from './lib/share';
import { useMixer } from './state/useMixer';
import { useRoutines } from './state/useRoutines';

export default function App() {
  const mixer = useMixer();
  const { t } = useI18n();
  const [create, setCreate] = useState<{ tab: CreateTab; query?: string } | null>(null);
  const [pickFor, setPickFor] = useState<string | null>(null);
  const { playing, setPlaying, active, loadShared } = mixer;
  const [toast, setToast] = useState<string | null>(null);
  const routines = useRoutines(mixer, t);
  const [routinesTab, setRoutinesTab] = useState<RoutinesTab | null>(null);
  const focusLabel =
    routines.run && routines.focusRemaining !== null
      ? `${routines.run.phase === 'focus' ? t('rt.focus') : t('rt.break')} ${formatClock(routines.focusRemaining)}`
      : null;

  // Opened from a shared link (#mix=…): load that mix, then tidy the URL.
  useEffect(() => {
    const open = () => {
      const shared = readSharedMix();
      if (!shared) return;
      if (loadShared(shared)) setToast(t('toast.sharedLoaded', { n: shared.sounds.length }));
      history.replaceState(null, '', location.pathname + location.search);
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadShared]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Space toggles play/pause (outside text fields).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.code !== 'Space' || el.closest('input, textarea, select, button, [role="button"]')) return;
      e.preventDefault();
      setPlaying((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPlaying]);

  // Electron tray menu: Play/Pause item + keep its label in sync.
  useEffect(() => {
    const bridge = (window as any).ambient;
    return bridge?.onTogglePlay?.(() => setPlaying((p) => !p));
  }, [setPlaying]);
  useEffect(() => {
    (window as any).ambient?.setPlaying?.(playing && active.length > 0);
  }, [playing, active.length]);

  // Media keys / OS media overlay.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: 'Ambient Sound Mixer', artist: t('media.sounds', { n: active.length }) });
    navigator.mediaSession.setActionHandler('play', () => setPlaying(true));
    navigator.mediaSession.setActionHandler('pause', () => setPlaying(false));
  }, [active.length, setPlaying, t]);

  return (
    <div className="app">
      <TitleBar playing={playing} count={active.length} extra={focusLabel} />
      <main className="layout">
        <MixerPanel
          mixer={mixer}
          onAddSound={() => setCreate({ tab: 'library' })}
          onPickVideo={setPickFor}
          onNotify={setToast}
          routines={routines}
          focusLabel={focusLabel}
          onOpenRoutines={setRoutinesTab}
        />
        <TemplatesPanel
          mixer={mixer}
          onCreate={() => setCreate({ tab: 'library' })}
          onSearchYouTube={(query) => setCreate({ tab: 'youtube', query })}
        />
      </main>

      {/* Hidden YouTube players — one per active sound. */}
      <div className="players" aria-hidden="true">
        {active.map((entry) => {
          const video = mixer.videos[entry.id];
          if (!video) return null;
          return (
            <YouTubeChannel
              key={`${entry.id}:${video.id}`}
              videoId={video.id}
              volume={mixer.effectiveVolume(entry.volume, entry.id)}
              playing={playing}
              onStatus={(status) => mixer.setChannel(entry.id, { status })}
              onError={(code) => {
                console.warn(`YouTube player error ${code} for ${entry.id} (${video.id}); trying next result`);
                mixer.reportPlayerError(entry.id, video.id);
              }}
            />
          );
        })}
      </div>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      {routinesTab && (
        <RoutinesModal mixer={mixer} routines={routines} initialTab={routinesTab} onClose={() => setRoutinesTab(null)} />
      )}
      {create && <CreateModal mixer={mixer} initialTab={create.tab} initialQuery={create.query} onClose={() => setCreate(null)} />}
      {pickFor && <VideoPickerModal mixer={mixer} soundId={pickFor} onClose={() => setPickFor(null)} />}
    </div>
  );
}
