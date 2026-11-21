import { useRef, type CSSProperties } from 'react';
import {
  AlarmClock,
  AlertCircle,
  Brain,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  Share2,
  Sparkles,
  Timer,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { categoryName, soundName, useI18n, type Key } from '../i18n';
import type { Mixer } from '../state/useMixer';
import type { Routines } from '../state/useRoutines';
import type { RoutinesTab } from './RoutinesModal';
import { Slider } from './Slider';

const TIMER_OPTIONS: { label: Key; minutes: number | null }[] = [
  { label: 'timer.off', minutes: null },
  { label: 'timer.15', minutes: 15 },
  { label: 'timer.30', minutes: 30 },
  { label: 'timer.60', minutes: 60 },
  { label: 'timer.120', minutes: 120 },
];

function formatRemaining(ms: number) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mmss = `${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
  return h ? `${h}:${mmss}` : mmss;
}

interface Props {
  mixer: Mixer;
  onAddSound: () => void;
  onPickVideo: (soundId: string) => void;
  onNotify: (message: string) => void;
  routines: Routines;
  focusLabel: string | null;
  onOpenRoutines: (tab: RoutinesTab) => void;
}

export function MixerPanel({ mixer, onAddSound, onPickVideo, onNotify, routines, focusLabel, onOpenRoutines }: Props) {
  const i18n = useI18n();
  const { t, errorText } = i18n;

  const share = async () => {
    const url = mixer.shareUrl();
    try {
      await navigator.clipboard.writeText(url);
      onNotify(t('mixer.shareCopied'));
    } catch {
      window.prompt(t('mixer.sharePrompt'), url);
    }
  };

  const toggleNatural = () => {
    const next = !mixer.natural;
    mixer.setNatural(next);
    if (next) onNotify(t('mixer.naturalOn'));
  };

  const lastMaster = useRef(50);
  const { master, setMaster } = mixer;
  const MasterIcon = master === 0 ? VolumeX : master < 50 ? Volume1 : Volume2;

  const toggleMute = () => {
    if (master > 0) {
      lastMaster.current = master;
      setMaster(0);
    } else {
      setMaster(lastMaster.current || 50);
    }
  };

  return (
    <aside className="panel mixer">
      <div className="mixer-head">
        <h1>
          {t('mixer.title1')}
          <br />
          {t('mixer.title2')}
        </h1>
        <p>{t('mixer.tagline')}</p>
      </div>

      <div className="section-label">{t('mixer.master')}</div>
      <div className="master-row">
        <button className="icon-btn ghost" onClick={toggleMute} aria-label={master === 0 ? t('mixer.unmute') : t('mixer.mute')}>
          <MasterIcon size={17} />
        </button>
        <Slider value={master} onChange={setMaster} label={t('mixer.masterAria')} />
        <span className="master-value">{master}%</span>
      </div>

      <div className="sound-list">
        {mixer.active.map((entry) => {
          const sound = mixer.soundById.get(entry.id);
          if (!sound) return null;
          const name = soundName(i18n, sound);
          const Icon = sound.icon;
          const channel = mixer.channels[entry.id];
          const busy = channel?.status === 'searching' || channel?.status === 'loading';
          const error = channel?.status === 'error' ? errorText(channel.error) : undefined;
          const video = mixer.videos[entry.id];
          return (
            <div className={`sound-row ${error ? 'has-error' : ''}`} key={entry.id}>
              <button
                className="sound-icon"
                style={{ '--hue': sound.color } as CSSProperties}
                onClick={() => onPickVideo(entry.id)}
                title={video ? t('mixer.source', { title: video.title }) : t('mixer.chooseSource')}
              >
                <Icon size={18} />
                {busy && mixer.playing && <LoaderCircle className="sound-spinner spin" size={40} strokeWidth={1.5} />}
              </button>
              <div className="sound-meta">
                <div className="sound-name" title={name}>
                  {name}
                </div>
                <div className="sound-cat">
                  {error ? (
                    <span className="sound-error" title={error}>
                      <AlertCircle size={11} /> {t('mixer.error')}
                    </span>
                  ) : video ? (
                    <a
                      className="sound-source"
                      href={`https://www.youtube.com/watch?v=${video.id}`}
                      target="_blank"
                      rel="noreferrer"
                      title={`${video.title}${video.channel ? ` — ${video.channel}` : ''}\n${t('mixer.openYouTube')}`}
                    >
                      {[video.channel, video.title].filter(Boolean).join(' · ')}
                    </a>
                  ) : (
                    categoryName(i18n, sound.category)
                  )}
                </div>
              </div>
              <Slider
                value={entry.volume}
                onChange={(v) => mixer.setSoundVolume(entry.id, v)}
                label={t('mixer.volumeAria', { name })}
                live={mixer.driftLevel(entry.id)}
              />
              <button className="icon-btn ghost" onClick={() => mixer.removeSound(entry.id)} aria-label={t('mixer.remove', { name })}>
                <X size={16} />
              </button>
            </div>
          );
        })}

        {mixer.active.length === 0 && <div className="sound-empty">{t('mixer.empty')}</div>}

        <div className="mixer-actions">
          <button className="add-sound" onClick={onAddSound}>
            <Plus size={16} /> {t('mixer.add')}
          </button>
          {mixer.active.length > 0 && (
            <button className="add-sound share" onClick={share} title={t('mixer.shareTitle')}>
              <Share2 size={15} /> {t('mixer.share')}
            </button>
          )}
        </div>
      </div>

      <div className="routine-bar">
        <button
          className={`chip small ${mixer.natural ? 'active' : ''}`}
          onClick={toggleNatural}
          title={t('mixer.naturalTitle')}
          aria-pressed={mixer.natural}
        >
          <Sparkles size={13} /> {t('mixer.natural')}
        </button>
        <button className={`chip small ${routines.run ? 'active' : ''}`} onClick={() => onOpenRoutines('focus')}>
          <Brain size={13} /> {focusLabel ?? t('mixer.focus')}
        </button>
        <button className={`chip small ${routines.alarm.enabled ? 'active' : ''}`} onClick={() => onOpenRoutines('alarm')}>
          <AlarmClock size={13} /> {routines.alarm.enabled ? t('mixer.alarmAt', { time: routines.alarm.time }) : t('mixer.alarm')}
        </button>
        {mixer.fadingIn && <span className="routine-note">{t('mixer.fadingIn')}</span>}
      </div>

      <footer className="mixer-foot">
        <div className="timer">
          <div className="timer-head">
            <Timer size={14} />
            <span>{t('mixer.sleepTimer')}</span>
            {mixer.remaining !== null && <span className="timer-left">{formatRemaining(mixer.remaining)}</span>}
          </div>
          <div className="timer-options">
            {TIMER_OPTIONS.map((o) => (
              <button
                key={o.label}
                className={`chip small ${mixer.timerMinutes === o.minutes ? 'active' : ''}`}
                onClick={() => mixer.startTimer(o.minutes)}
              >
                {t(o.label)}
              </button>
            ))}
          </div>
        </div>
        <button
          className="play-btn"
          onClick={() => mixer.setPlaying((p) => !p)}
          disabled={mixer.active.length === 0}
          aria-label={mixer.playing ? t('mixer.pauseAll') : t('mixer.playAll')}
        >
          {mixer.playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </button>
      </footer>
    </aside>
  );
}
