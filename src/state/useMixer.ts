import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_MIX, SOUNDS, customToDef, type CustomSound, type SoundDef } from '../data/sounds';
import { TEMPLATES, type MixEntry, type Template } from '../data/templates';
import { buildShareUrl, type SharedMix } from '../lib/share';
import { usePersistentState } from '../lib/storage';
import { searchVideos, thumbUrl, type VideoResult, type YouTubeError } from '../lib/youtube';
import type { PlayerStatus } from '../components/YouTubeChannel';

export type ChannelStatus = PlayerStatus | 'searching' | 'error';
export interface ChannelState {
  status: ChannelStatus;
  error?: string;
}

const FADE_MS = 30_000;

// "Natural variation": each sound's volume drifts below its set level along two
// slow sine waves with periods/phases seeded by the sound id, so every sound
// breathes on its own cycle and the mix never sounds static.
const DRIFT_DEPTH: Record<string, number> = { thunder: 0.7, wind: 0.6, waves: 0.5, rain: 0.4, 'tin-roof': 0.4, birds: 0.5 };
const DEFAULT_DEPTH = 0.35;
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function driftFactor(id: string, t: number) {
  const h = hash(id);
  const slow = 40 + (h % 41); // 40–80 s
  const fast = 11 + ((h >>> 8) % 15); // 11–25 s
  const p1 = ((h >>> 16) % 628) / 100;
  const p2 = ((h >>> 4) % 628) / 100;
  const s = t / 1000;
  const wave = 0.65 * Math.sin((2 * Math.PI * s) / slow + p1) + 0.35 * Math.sin((2 * Math.PI * s) / fast + p2); // −1…1
  const depth = DRIFT_DEPTH[id] ?? DEFAULT_DEPTH;
  return 1 - depth * (0.5 + 0.5 * wave);
}

const shortName = (title: string) => (title.length > 28 ? `${title.slice(0, 26)}…` : title);
const makeVideo = (id: string, title: string): VideoResult => ({ id, title, channel: '', thumbnail: thumbUrl(id) });

export function useMixer() {
  const [active, setActive] = usePersistentState<MixEntry[]>('asm:active', DEFAULT_MIX);
  const [master, setMaster] = usePersistentState('asm:master', 50);
  const [videos, setVideos] = usePersistentState<Record<string, VideoResult>>('asm:videos', {});
  const [customSounds, setCustomSounds] = usePersistentState<CustomSound[]>('asm:customSounds', []);
  const [customTemplates, setCustomTemplates] = usePersistentState<Template[]>('asm:customTemplates', []);
  const [templateId, setTemplateId] = usePersistentState<string | null>('asm:template', null);
  const [natural, setNatural] = usePersistentState('asm:natural', false);
  const [playing, setPlaying] = useState(false);
  const [channels, setChannels] = useState<Record<string, ChannelState>>({});
  const [timerEnd, setTimerEnd] = useState<number | null>(null);
  const [timerMinutes, setTimerMinutes] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Gentle start (wake-up alarm): volume ramps from 0 to full over this window.
  const [fadeIn, setFadeIn] = useState<{ start: number; end: number } | null>(null);

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
        if (bad?.has(sound.video.id)) setChannel(entry.id, { status: 'error', error: 'embed' });
        else setVideos((v) => ({ ...v, [entry.id]: sound.video! }));
        continue;
      }

      // Built-in pick first; only search if it has failed to play.
      const preset = sound.defaultVideo;
      if (preset && !bad?.has(preset.id)) {
        setVideos((v) => ({ ...v, [entry.id]: preset }));
        continue;
      }

      resolving.current.add(entry.id);
      setChannel(entry.id, { status: 'searching' });
      searchVideos(sound.query)
        .then((list) => {
          const pick = list.find((v) => !bad?.has(v.id));
          if (pick) setVideos((v) => ({ ...v, [entry.id]: pick }));
          else setChannel(entry.id, { status: 'error', error: 'noVideo' });
        })
        // Error codes (embed, noVideo, network, quotaExceeded…) are translated by the UI.
        .catch((err: YouTubeError) => setChannel(entry.id, { status: 'error', error: err.reason ?? err.message }))
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

  // Sleep timer with a 30 s fade-out; also drives the fade-in ramp.
  const drifting = natural && playing;
  useEffect(() => {
    if (!timerEnd && !fadeIn && !drifting) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [timerEnd, fadeIn, drifting]);

  const fadeInFactor = fadeIn ? Math.min(1, Math.max(0, (now - fadeIn.start) / (fadeIn.end - fadeIn.start))) : 1;
  useEffect(() => {
    if (fadeIn && (now >= fadeIn.end || !playing)) setFadeIn(null);
  }, [fadeIn, now, playing]);

  /** Start playing, ramping the volume up from silence over `minutes`. */
  const playWithFadeIn = useCallback((minutes: number) => {
    const start = Date.now();
    setNow(start);
    setFadeIn(minutes > 0 ? { start, end: start + minutes * 60_000 } : null);
    setPlaying(true);
  }, []);

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
    (volume: number, soundId?: string) => {
      const drift = drifting && soundId ? driftFactor(soundId, now) : 1;
      return Math.round((volume * master * fade * fadeInFactor * drift) / 100);
    },
    [master, fade, fadeInFactor, drifting, now],
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

  /** Switch to a template's sounds (alarm, focus timer) without the click-to-toggle behaviour. */
  const loadTemplate = useCallback((t: Template) => {
    setActive(t.sounds.filter((s) => soundById.has(s.id)).map((s) => ({ ...s })));
    setTemplateId(t.id);
  }, [setActive, setTemplateId, soundById]);

  const addCustomSound = useCallback((video: VideoResult) => {
    const id = `yt-${video.id}`;
    const name = shortName(video.title);
    setCustomSounds((list) => (list.some((c) => c.id === id) ? list : [...list, { id, name, video }]));
    addSound(id);
  }, [setCustomSounds, addSound]);

  /** Link that recreates the current mix (sounds, volumes, chosen videos). */
  const shareUrl = useCallback(() => {
    const sounds = active.map((e) => {
      const def = soundById.get(e.id);
      const video = videos[e.id];
      const custom = e.id.startsWith('yt-');
      return {
        id: e.id,
        volume: e.volume,
        videoId: !custom && video && video.id !== def?.defaultVideo?.id ? video.id : undefined,
        title: custom ? def?.video?.title : undefined,
      };
    });
    return buildShareUrl({ master, sounds });
  }, [active, master, soundById, videos]);

  /** Replace the current mix with one opened from a shared link (paused). */
  const loadShared = useCallback((mix: SharedMix) => {
    const builtIn = new Map(SOUNDS.map((s) => [s.id, s]));
    const added: CustomSound[] = [];
    const chosen: Record<string, VideoResult> = {};
    const entries: MixEntry[] = [];
    for (const s of mix.sounds) {
      if (s.id.startsWith('yt-')) {
        const videoId = s.id.slice(3);
        if (!/^[\w-]{11}$/.test(videoId)) continue;
        const title = s.title || 'YouTube sound';
        added.push({ id: s.id, name: shortName(title), video: makeVideo(videoId, title) });
      } else {
        const def = builtIn.get(s.id);
        if (!def) continue;
        if (s.videoId) chosen[s.id] = makeVideo(s.videoId, `${def.name} (shared)`);
      }
      entries.push({ id: s.id, volume: s.volume });
    }
    if (!entries.length) return false;
    setCustomSounds((list) => [...list, ...added.filter((a) => !list.some((c) => c.id === a.id))]);
    setVideos((v) => {
      const next = { ...v, ...chosen };
      // Built-in sounds without a shared pick go back to their default video.
      for (const e of entries) if (!e.id.startsWith('yt-') && !chosen[e.id]) delete next[e.id];
      return next;
    });
    setActive(entries);
    setMaster(mix.master);
    setTemplateId(null);
    setPlaying(false);
    return true;
  }, [setCustomSounds, setVideos, setActive, setMaster, setTemplateId]);

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
    shareUrl,
    loadShared,
    loadTemplate,
    playWithFadeIn,
    fadingIn: fadeIn !== null,
    natural,
    setNatural,
    /** Current natural-variation level for a sound (0–1), for the UI. */
    driftLevel: (soundId: string) => (drifting ? driftFactor(soundId, now) : 1),
  };
}

export type Mixer = ReturnType<typeof useMixer>;
