import { useEffect, useState, type FormEvent } from 'react';
import { Copy, Link, LoaderCircle, RefreshCw, ShieldCheck, Trash2, Unlink } from 'lucide-react';
import QRCode from 'qrcode';
import { useI18n, type Key } from '../i18n';
import { formatCode, normalizeCode, syncLink } from '../lib/sync';
import type { Sync } from '../state/useSync';
import { Modal } from './Modal';

interface Props {
  sync: Sync;
  onClose: () => void;
  onNotify: (message: string) => void;
}

export function syncErrorKey(code: string | null): Key | null {
  return code ? (`sync.err.${code}` as Key) : null;
}

export function SyncModal({ sync, onClose, onNotify }: Props) {
  const { t } = useI18n();
  // Kept here so a failed join (which briefly links, then unlinks) doesn't wipe what was typed.
  const [code, setCode] = useState('');
  return (
    <Modal title={t('sync.title')} subtitle={t('sync.subtitle')} onClose={onClose}>
      {sync.meta ? (
        <Linked sync={sync} onNotify={onNotify} />
      ) : (
        <Unlinked sync={sync} onNotify={onNotify} code={code} setCode={setCode} />
      )}
      <p className="hint sync-privacy">
        <ShieldCheck size={13} /> {t('sync.privacy')}
      </p>
    </Modal>
  );
}

function StatusLine({ sync }: { sync: Sync }) {
  const { t, locale } = useI18n();
  const err = syncErrorKey(sync.error);
  if (sync.status === 'syncing') return <span className="sync-status">{t('sync.syncing')}</span>;
  if (sync.status === 'error' && err) return <span className="sync-status error">{t(err)}</span>;
  const last = sync.meta?.lastSync;
  return (
    <span className="sync-status ok">
      {last ? t('sync.ok', { time: new Date(last).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) }) : t('sync.never')}
    </span>
  );
}

interface UnlinkedProps {
  sync: Sync;
  onNotify: (m: string) => void;
  code: string;
  setCode: (c: string) => void;
}

function Unlinked({ sync, onNotify, code, setCode }: UnlinkedProps) {
  const { t } = useI18n();
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  // Only show a server error for the attempt the user just made.
  const err = sync.status === 'error' && !bad ? syncErrorKey(sync.error) : null;

  const create = async () => {
    setBusy(true);
    const ok = await sync.create();
    setBusy(false);
    if (ok) onNotify(t('sync.started'));
  };
  const join = async (e: FormEvent) => {
    e.preventDefault();
    const normal = normalizeCode(code);
    if (!normal) return setBad(true);
    setBusy(true);
    const ok = await sync.join(normal);
    setBusy(false);
    if (ok) onNotify(t('sync.linked'));
  };

  return (
    <div className="sync">
      <p className="hint">{t('sync.offIntro')}</p>
      <button className="btn-primary" onClick={create} disabled={busy}>
        {busy ? <LoaderCircle size={16} className="spin" /> : <RefreshCw size={16} />} {t('sync.create')}
      </button>

      <form className="sync-join" onSubmit={join}>
        <label className="field">
          <span>{t('sync.haveCode')}</span>
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setBad(false);
              if (sync.status === 'error') sync.stop(); // clears the old error
            }}
            placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
            className="code-input"
          />
        </label>
        <button className="btn-outline" type="submit" disabled={busy || !code.trim()}>
          {t('sync.join')}
        </button>
      </form>
      {bad && <div className="notice error">{t('sync.badCode')}</div>}
      {err && <div className="notice error">{t(err)}</div>}
      <p className="hint">{t('sync.joinNote')}</p>
    </div>
  );
}

function Linked({ sync, onNotify }: { sync: Sync; onNotify: (m: string) => void }) {
  const { t } = useI18n();
  const code = sync.meta!.code;
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toString(syncLink(code), { type: 'svg', margin: 1, color: { dark: '#0a0b10', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [code]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onNotify(t('sync.copied'));
    } catch {
      window.prompt('', text);
    }
  };

  return (
    <div className="sync">
      <div className="sync-code-box">
        <div>
          <div className="label-sm">{t('sync.yourCode')}</div>
          <div className="sync-code">{formatCode(code)}</div>
          <div className="sync-actions">
            <button className="btn-small" onClick={() => copy(formatCode(code))}>
              <Copy size={13} /> {t('sync.copyCode')}
            </button>
            <button className="btn-small" onClick={() => copy(syncLink(code))}>
              <Link size={13} /> {t('sync.copyLink')}
            </button>
          </div>
        </div>
        {qr && <div className="sync-qr" title={t('sync.qrHint')} dangerouslySetInnerHTML={{ __html: qr }} />}
      </div>
      <p className="hint">{t('sync.qrHint')}</p>
      <div className="notice">{t('sync.keepSecret')}</div>

      <div className="sync-row">
        <StatusLine sync={sync} />
        <button className="btn-small" onClick={sync.syncNow} disabled={sync.status === 'syncing'}>
          <RefreshCw size={13} className={sync.status === 'syncing' ? 'spin' : ''} /> {t('sync.now')}
        </button>
      </div>
      <p className="hint">{t('sync.whatSyncs')}</p>

      <div className="sync-row danger">
        <button className="link" onClick={sync.stop}>
          <Unlink size={13} /> {t('sync.stop')}
        </button>
        <button
          className="link danger"
          onClick={() => {
            if (window.confirm(t('sync.deleteConfirm'))) void sync.deleteCloud();
          }}
        >
          <Trash2 size={13} /> {t('sync.delete')}
        </button>
      </div>
    </div>
  );
}

/** Confirmation shown when the app is opened from a #sync=… link. */
export function SyncLinkPrompt({ code, sync, onDone, onNotify }: { code: string; sync: Sync; onDone: () => void; onNotify: (m: string) => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={t('sync.linkTitle')} onClose={onDone}>
      <div className="sync">
        <p>{t('sync.linkBody', { code: formatCode(code) })}</p>
        <p className="hint">{t('sync.joinNote')}</p>
        <div className="sync-row">
          <button className="btn-outline" onClick={onDone}>
            {t('sync.linkCancel')}
          </button>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await sync.join(code);
              setBusy(false);
              if (ok) {
                onNotify(t('sync.linked'));
                onDone();
              }
            }}
          >
            {busy ? <LoaderCircle size={16} className="spin" /> : null} {t('sync.join')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
