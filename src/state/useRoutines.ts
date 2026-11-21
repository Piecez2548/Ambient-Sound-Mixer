// Wake-up alarm and Pomodoro focus timer, built on top of the mixer.
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePersistentState } from '../lib/storage';
import type { T } from '../i18n';
import type { Mixer } from './useMixer';

export interface AlarmSettings {
  enabled: boolean;
  /** "HH:MM", local time. */
  time: string;
  fadeMinutes: number;
  /** Template to play, or null for the current mix. */
  templateId: string | null;
  daily: boolean;
  /** When the settings last changed — a time that had already passed then doesn't ring. */
  armedAt: number;
}

export interface FocusSettings {
  focusMinutes: number;
  breakMinutes: number;
  /** Templates for each phase; null keeps whatever is playing. */
  focusTemplateId: string | null;
  breakTemplateId: string | null;
}

export type FocusPhase = 'focus' | 'break';
export interface FocusRun {
  phase: FocusPhase;
  endsAt: number;
  /** Completed focus sessions in this run. */
  done: number;
}

const DEFAULT_ALARM: AlarmSettings = { enabled: false, time: '07:00', fadeMinutes: 10, templateId: 'forest-morning', daily: true, armedAt: 0 };
/** A sleeping laptop or throttled tab can wake late; still ring within this window. */
const LATE_WINDOW_MS = 30 * 60_000;
const DEFAULT_FOCUS: FocusSettings = { focusMinutes: 25, breakMinutes: 5, focusTemplateId: 'rainy-day-focus', breakTemplateId: 'forest-morning' };

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
function todayAt(time: string, from: Date) {
  const [h, m] = time.split(':').map(Number);
  const at = new Date(from);
  at.setHours(h, m, 0, 0);
  return at;
}

/** Next time the alarm will ring, for display. */
export function nextAlarm(time: string, from = new Date()) {
  const at = todayAt(time, from);
  if (at <= from) at.setDate(at.getDate() + 1);
  return at;
}

// Short two-note chime made with Web Audio (no audio file needed).
let audioCtx: AudioContext | null = null;
export function chime(notes = [660, 880]) {
  try {
    audioCtx ??= new AudioContext();
    void audioCtx.resume();
    const t0 = audioCtx.currentTime;
    notes.forEach((freq, i) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = t0 + i * 0.28;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      osc.connect(gain).connect(audioCtx!.destination);
      osc.start(t);
      osc.stop(t + 1);
    });
  } catch {
    /* audio unavailable */
  }
}

function notify(title: string, body: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body, icon: '/icon-192.png', silent: true });
  } catch {
    /* ignore */
  }
}

export function requestNotifications() {
  try {
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
  } catch {
    /* ignore */
  }
}

export function useRoutines(mixer: Mixer, t: T) {
  const tRef = useRef(t);
  tRef.current = t;
  const [alarm, setAlarmState] = usePersistentState<AlarmSettings>('asm:alarm', DEFAULT_ALARM);
  const setAlarm = useCallback(
    (patch: Partial<AlarmSettings>) => setAlarmState((a) => ({ ...a, ...patch, armedAt: Date.now() })),
    [setAlarmState],
  );
  const [lastRang, setLastRang] = usePersistentState<string | null>('asm:alarmLastRang', null);
  const [focus, setFocus] = usePersistentState<FocusSettings>('asm:focus', DEFAULT_FOCUS);
  const [run, setRun] = useState<FocusRun | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const mixerRef = useRef(mixer);
  mixerRef.current = mixer;

  const playTemplate = useCallback((templateId: string | null) => {
    const m = mixerRef.current;
    const t = templateId ? m.templates.find((x) => x.id === templateId) : undefined;
    if (t) m.loadTemplate(t);
  }, []);

  // One clock for both features. Background tabs throttle timers to ~1/min,
  // which is fine for a minute-precision alarm; focus phases use absolute end times.
  useEffect(() => {
    if (!alarm.enabled && !run) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [alarm.enabled, run]);

  // Wake-up alarm.
  useEffect(() => {
    if (!alarm.enabled) return;
    const d = new Date(now);
    const target = todayAt(alarm.time, d).getTime();
    const due = now >= target && now - target < LATE_WINDOW_MS && target > alarm.armedAt;
    if (!due || lastRang === dayKey(d)) return;
    setLastRang(dayKey(d));
    playTemplate(alarm.templateId);
    mixerRef.current.playWithFadeIn(alarm.fadeMinutes);
    notify(tRef.current('notify.morning'), tRef.current('notify.morningBody'));
    if (!alarm.daily) setAlarmState((a) => ({ ...a, enabled: false }));
  }, [now, alarm, lastRang, setLastRang, setAlarmState, playTemplate]);

  // Focus timer: switch phase (and mix) when the current one ends.
  useEffect(() => {
    if (!run || now < run.endsAt) return;
    const toBreak = run.phase === 'focus';
    const minutes = toBreak ? focus.breakMinutes : focus.focusMinutes;
    const start = Date.now();
    setNow(start);
    setRun({ phase: toBreak ? 'break' : 'focus', endsAt: start + minutes * 60_000, done: run.done + (toBreak ? 1 : 0) });
    playTemplate(toBreak ? focus.breakTemplateId : focus.focusTemplateId);
    mixerRef.current.setPlaying(true);
    chime(toBreak ? [880, 660] : [660, 880]);
    const tt = tRef.current;
    notify(tt(toBreak ? 'notify.break' : 'notify.focus'), tt(toBreak ? 'notify.breakBody' : 'notify.focusBody', { n: minutes }));
  }, [now, run, focus, playTemplate]);

  const startFocus = useCallback(() => {
    requestNotifications();
    chime([660, 880]);
    const start = Date.now();
    setNow(start);
    setRun({ phase: 'focus', endsAt: start + focus.focusMinutes * 60_000, done: 0 });
    playTemplate(focus.focusTemplateId);
    mixerRef.current.setPlaying(true);
  }, [focus, playTemplate]);

  const skipPhase = useCallback(() => setRun((r) => (r ? { ...r, endsAt: Date.now() } : r)), []);
  const stopFocus = useCallback(() => setRun(null), []);

  return {
    alarm,
    setAlarm,
    focus,
    setFocus,
    run,
    focusRemaining: run ? Math.max(0, run.endsAt - now) : null,
    startFocus,
    skipPhase,
    stopFocus,
  };
}

export type Routines = ReturnType<typeof useRoutines>;
