import { AudioLines, Cloud, CloudAlert, CloudCheck, Download, RefreshCw } from 'lucide-react';
import { LANGS, useI18n } from '../i18n';
import type { UpdateState } from '../state/useUpdate';
import type { Sync } from '../state/useSync';
import { APP_VERSION } from '../lib/version';
import { syncErrorKey } from './SyncModal';

const isElectron = Boolean((window as any).ambient?.isElectron);

interface Props {
  playing: boolean;
  count: number;
  extra?: string | null;
  sync: Sync;
  onOpenSync: () => void;
  update: UpdateState;
}

export function TitleBar({ playing, count, extra, sync, onOpenSync, update }: Props) {
  const { t, lang, setLang } = useI18n();
  const SyncIcon =
    sync.status === 'syncing' ? RefreshCw : sync.status === 'error' ? CloudAlert : sync.status === 'ok' ? CloudCheck : Cloud;
  const errKey = syncErrorKey(sync.error);
  const syncTitle =
    sync.status === 'error' && errKey ? t(errKey) : sync.status === 'syncing' ? t('sync.syncing') : t('sync.title');

  return (
    <div className={`titlebar ${isElectron ? 'is-electron' : ''}`}>
      <div className="brand" title={t('about.title', { v: APP_VERSION })}>
        <span className="brand-mark">
          <AudioLines size={15} />
        </span>
        Ambient Sound Mixer
      </div>
      <div className="titlebar-status">
        {update.version && (
          <button className="update-btn" onClick={update.install} title={t('update.title', { v: update.version })}>
            <Download size={13} /> <span>{t('update.button')}</span>
          </button>
        )}
        {extra && <span className="titlebar-pill">{extra}</span>}
        <span className={`dot ${playing && count > 0 ? 'live' : ''}`} />
        <span className="status-text">
          {playing && count > 0 ? t('status.playing', { n: count, s: count > 1 ? 's' : '' }) : t('status.paused')}
        </span>
        <button className={`sync-btn ${sync.status}`} onClick={onOpenSync} title={syncTitle} aria-label={t('sync.title')}>
          <SyncIcon size={14} className={sync.status === 'syncing' ? 'spin' : ''} />
          <span>{t('sync.button')}</span>
        </button>
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
