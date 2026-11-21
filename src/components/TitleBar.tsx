import { AudioLines } from 'lucide-react';

const isElectron = Boolean((window as any).ambient?.isElectron);

export function TitleBar({ playing, count, extra }: { playing: boolean; count: number; extra?: string | null }) {
  return (
    <div className={`titlebar ${isElectron ? 'is-electron' : ''}`}>
      <div className="brand">
        <span className="brand-mark">
          <AudioLines size={15} />
        </span>
        Ambient Sound Mixer
      </div>
      <div className="titlebar-status">
        {extra && <span className="titlebar-pill">{extra}</span>}
        <span className={`dot ${playing && count > 0 ? 'live' : ''}`} />
        {playing && count > 0 ? `Playing ${count} sound${count > 1 ? 's' : ''}` : 'Paused'}
      </div>
    </div>
  );
}
