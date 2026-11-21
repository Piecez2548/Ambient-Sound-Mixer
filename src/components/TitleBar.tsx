import { AudioLines } from 'lucide-react';
import { LANGS, useI18n } from '../i18n';

const isElectron = Boolean((window as any).ambient?.isElectron);

export function TitleBar({ playing, count, extra }: { playing: boolean; count: number; extra?: string | null }) {
  const { t, lang, setLang } = useI18n();
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
        <span className="status-text">
          {playing && count > 0 ? t('status.playing', { n: count, s: count > 1 ? 's' : '' }) : t('status.paused')}
        </span>
        <div className="lang-switch" role="group" aria-label={t('lang.switch')}>
          {LANGS.map((l) => (
            <button key={l} className={lang === l ? 'active' : ''} onClick={() => setLang(l)} aria-pressed={lang === l} lang={l}>
              {l === 'th' ? 'ไทย' : 'EN'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
