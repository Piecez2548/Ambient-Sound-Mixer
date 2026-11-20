import { useRef, type CSSProperties } from 'react';
import { AlertCircle, LoaderCircle, Pause, Play, Plus, Timer, Volume1, Volume2, VolumeX, X } from 'lucide-react';
import type { Mixer } from '../state/useMixer';
import { Slider } from './Slider';

const TIMER_OPTIONS: { label: string; minutes: number | null }[] = [
  { label: 'Off', minutes: null },
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '2h', minutes: 120 },
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
}

export function MixerPanel({ mixer, onAddSound, onPickVideo }: Props) {
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
          Create Your
          <br />
          Perfect Ambience
        </h1>
        <p>Mix sounds. Match Moods. Stay In Flow.</p>
      </div>

      <div className="section-label">Master Volume</div>
      <div className="master-row">
        <button className="icon-btn ghost" onClick={toggleMute} aria-label={master === 0 ? 'Unmute' : 'Mute'}>
          <MasterIcon size={17} />
        </button>
        <Slider value={master} onChange={setMaster} label="Master volume" />
        <span className="master-value">{master}%</span>
      </div>

      <div className="sound-list">
        {mixer.active.map((entry) => {
          const sound = mixer.soundById.get(entry.id);
          if (!sound) return null;
          const Icon = sound.icon;
          const channel = mixer.channels[entry.id];
          const busy = channel?.status === 'searching' || channel?.status === 'loading';
          const error = channel?.status === 'error' ? channel.error : undefined;
          const video = mixer.videos[entry.id];
          return (
            <div className={`sound-row ${error ? 'has-error' : ''}`} key={entry.id}>
              <button
                className="sound-icon"
                style={{ '--hue': sound.color } as CSSProperties}
                onClick={() => onPickVideo(entry.id)}
                title={video ? `Source: ${video.title}\nClick to change` : 'Choose YouTube source'}
              >
                <Icon size={18} />
                {busy && mixer.playing && <LoaderCircle className="sound-spinner spin" size={40} strokeWidth={1.5} />}
              </button>
              <div className="sound-meta">
                <div className="sound-name" title={sound.name}>
                  {sound.name}
                </div>
                <div className="sound-cat">
                  {error ? (
                    <span className="sound-error" title={error}>
                      <AlertCircle size={11} /> Error
                    </span>
                  ) : (
                    sound.category
                  )}
                </div>
              </div>
              <Slider value={entry.volume} onChange={(v) => mixer.setSoundVolume(entry.id, v)} label={`${sound.name} volume`} />
              <button className="icon-btn ghost" onClick={() => mixer.removeSound(entry.id)} aria-label={`Remove ${sound.name}`}>
                <X size={16} />
              </button>
            </div>
          );
        })}

        {mixer.active.length === 0 && (
          <div className="sound-empty">Pick a template or add sounds to start your mix.</div>
        )}

        <button className="add-sound" onClick={onAddSound}>
          <Plus size={16} /> Add sound
        </button>
      </div>

      <footer className="mixer-foot">
        <div className="timer">
          <div className="timer-head">
            <Timer size={14} />
            <span>Sleep timer</span>
            {mixer.remaining !== null && <span className="timer-left">{formatRemaining(mixer.remaining)}</span>}
          </div>
          <div className="timer-options">
            {TIMER_OPTIONS.map((o) => (
              <button
                key={o.label}
                className={`chip small ${mixer.timerMinutes === o.minutes ? 'active' : ''}`}
                onClick={() => mixer.startTimer(o.minutes)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <button
          className="play-btn"
          onClick={() => mixer.setPlaying((p) => !p)}
          disabled={mixer.active.length === 0}
          aria-label={mixer.playing ? 'Pause all' : 'Play all'}
        >
          {mixer.playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </button>
      </footer>
    </aside>
  );
}
