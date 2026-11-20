import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_MIX, SOUNDS, customToDef, type CustomSound, type SoundDef } from '../data/sounds';
import { TEMPLATES, type MixEntry, type Template } from '../data/templates';
import { usePersistentState } from '../lib/storage';
import { searchVideos, type VideoResult } from '../lib/youtube';
import type { PlayerStatus } from '../components/YouTubeChannel';

export type ChannelStatus = PlayerStatus | 'searching' | 'error';
export interface ChannelState {
  status: ChannelStatus;
  error?: string;
}

const FADE_MS = 30_000;

export function useMixer() {
  const [active, setActive] = usePersistentState<MixEntry[]>('asm:active', DEFAULT_MIX);
  const [master, setMaster] = usePersistentState('asm:master', 50);
  const [videos, setVideos] = usePersistentState<Record<string, VideoResult>>('asm:videos', {});
  const [customSounds, setCustomSounds] = usePersistentState<CustomSound[]>('asm:customSounds', []);
  const [customTemplates, setCustomTemplates] = usePersistentState<Template[]>('asm:customTemplates', []);
  const [templateId, setTemplateId] = usePersistentState<string | null>('asm:template', null);
  const [playing, setPlaying] = useState(false);
  const [channels, setChannels] = useState<Record<string, ChannelState>>({});
  const [timerEnd, setTimerEnd] = useState<number | null>(null);
  const [timerMinutes, setTimerMinutes] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const failed = useRef(new Map<string, Set<string>>());
  const resolving = useRef(new Set<string>());

  const allSounds = useMemo<SoundDef[]>(() => [...SOUNDS, ...customSounds.map(customToDef)], [customSounds]);
  const soundById = useMemo(() => new Map(allSounds.map((s) => [s.id, s])), [allSounds]);
  const templates = useMemo(() => [...customTemplates, ...TEMPLATES], [customTemplates]);

  const setChannel = useCallback((id: string, next: ChannelState) => {
    setChannels((c) => (c[id]?.status === next.status && c[id]?.error === next.error ? c : { ...c, [id]: next }));
  }, []);

  // Find a YouTube video for every active sound that doesn't have one yet.
  useEffect(() => {
    for (const entry of active) {
      if (videos[entry.id] || resolving.current.has(entry.id)) continue;
      const sound = soundById.get(entry.id);
      if (!sound) continue;
      const bad = failed.current.get(entry.id);

      if (sound.video) {
        if (bad?.has(sound.video.id)) setChannel(entry.id, { status: 'error', error: 'Video can’t be embedded' });
        else setVideos((v) => ({ ...v, [entry.id]: sound.video! }));
        continue;
      }

      resolving.current.add(entry.id);
      setChannel(entry.id, { status: 'searching' });
      searchVideos(sound.query)
        .then((list) => {
          const pick = list.find((v) => !bad?.has(v.id));
          if (pick) setVideos((v) => ({ ...v, [entry.id]: pick }));
          else setChannel(entry.id, { status: 'error', error: 'No playable video' });
        })
        .catch((err: Error) => setChannel(entry.id, { status: 'error', error: err.message }))
        .finally(() => resolving.current.delete(entry.id));
    }
  }, [active, videos, soundById, setChannel]);

  /** Player refused the video (not embeddable, removed…): skip to the next search result. */
  const reportPlayerError = useCallback((soundId: string, videoId: string) => {
    const set = failed.current.get(soundId) ?? new Set<string>();
    set.add(videoId);
    failed.current.set(soundId, set);
    setVideos((v) => {
      if (v[soundId]?.id !== videoId) return v;
      const next = { ...v };
      delete next[soundId];
      return next;
    });
  }, [setVideos]);

  const chooseVideo = useCallback((soundId: string, video: VideoResult) => {
    failed.current.get(soundId)?.delete(video.id);
    setVideos((v) => ({ ...v, [soundId]: video }));
  }, [setVideos]);

  // Sleep timer with a 30 s fade-out.
  useEffect(() => {
    if (!timerEnd) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [timerEnd]);

  const remaining = timerEnd ? Math.max(0, timerEnd - now) : null;
  useEffect(() => {
    if (timerEnd && remaining === 0) {
      setPlaying(false);
      setTimerEnd(null);
      setTimerMinutes(null);
    }
  }, [remaining, timerEnd]);
  const fade = remaining !== null && remaining < FADE_MS ? remaining / FADE_MS : 1;

  const startTimer = useCallback((minutes: number | null) => {
    setTimerMinutes(minutes);
    if (minutes === null) return setTimerEnd(null);
    const start = Date.now();
    setNow(start);
    setTimerEnd(start + minutes * 60_000);
  }, []);

  const effectiveVolume = useCallback(
    (volume: number) => Math.round((volume * master * fade) / 100),
    [master, fade],
  );

  const addSound = useCallback((id: string, volume = 50) => {
    setActive((a) => (a.some((e) => e.id === id) ? a : [...a, { id, volume }]));
    setTemplateId(null);
    setPlaying(true);
  }, [setActive, setTemplateId]);

  const removeSound = useCallback((id: string) => {
    setActive((a) => a.filter((e) => e.id !== id));
    setTemplateId(null);
  }, [setActive, setTemplateId]);

  const toggleSound = useCallback((id: string) => {
    if (active.some((e) => e.id === id)) removeSound(id);
    else addSound(id);
  }, [active, addSound, removeSound]);

  const setSoundVolume = useCallback((id: string, volume: number) => {
    setActive((a) => a.map((e) => (e.id === id ? { ...e, volume } : e)));
  }, [setActive]);

  const applyTemplate = useCallback((t: Template) => {
    if (t.id === templateId) {
      setPlaying((p) => !p);
      return;
    }
    setActive(t.sounds.filter((s) => soundById.has(s.id)).map((s) => ({ ...s })));
    setTemplateId(t.id);
    setPlaying(true);
  }, [templateId, setActive, setTemplateId, soundById]);

  const addCustomSound = useCallback((video: VideoResult) => {
    const id = `yt-${video.id}`;
    const name = video.title.length > 28 ? `${video.title.slice(0, 26)}…` : video.title;
    setCustomSounds((list) => (list.some((c) => c.id === id) ? list : [...list, { id, name, video }]));
    addSound(id);
  }, [setCustomSounds, addSound]);

  const saveTemplate = useCallback((title: string, description: string, moods: Template['moods']) => {
    const coverVideo = active.map((e) => videos[e.id]).find(Boolean);
    const t: Template = {
      id: `custom-${Date.now()}`,
      title,
      description: description || `${active.length} sounds mixed by you.`,
      moods,
      sounds: active.map((e) => ({ ...e })),
      imageQuery: title,
      imageVideoId: coverVideo?.id,
      custom: true,
    };
    setCustomTemplates((list) => [t, ...list]);
    setTemplateId(t.id);
    return t;
  }, [active, videos, setCustomTemplates, setTemplateId]);

  const deleteTemplate = useCallback((id: string) => {
    setCustomTemplates((list) => list.filter((t) => t.id !== id));
    if (templateId === id) setTemplateId(null);
  }, [setCustomTemplates, templateId, setTemplateId]);

  return {
    active,
    master,
    setMaster,
    videos,
    channels,
    setChannel,
    playing,
    setPlaying,
    allSounds,
    soundById,
    templates,
    templateId,
    remaining,
    timerMinutes,
    startTimer,
    effectiveVolume,
    addSound,
    removeSound,
    toggleSound,
    setSoundVolume,
    applyTemplate,
    addCustomSound,
    saveTemplate,
    deleteTemplate,
    chooseVideo,
    reportPlayerError,
  };
}

export type Mixer = ReturnType<typeof useMixer>;
