import { useState, type ReactNode } from 'react';
import { AlarmClock, Brain, Coffee, SkipForward, Square } from 'lucide-react';
import { templateTitle, useI18n } from '../i18n';
import type { Mixer } from '../state/useMixer';
import { nextAlarm, requestNotifications, type Routines } from '../state/useRoutines';
import { Modal } from './Modal';

export type RoutinesTab = 'focus' | 'alarm';

interface Props {
  mixer: Mixer;
  routines: Routines;
  initialTab: RoutinesTab;
  onClose: () => void;
}

export function formatClock(ms: number) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const isElectron = Boolean((window as any).ambient?.isElectron);

export function RoutinesModal({ mixer, routines, initialTab, onClose }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<RoutinesTab>(initialTab);
  return (
    <Modal title={t('rt.title')} subtitle={t('rt.subtitle')} onClose={onClose}>
      <div className="tabs" role="tablist">
        {(
          [
            ['focus', t('rt.tabFocus')],
            ['alarm', t('rt.tabAlarm')],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'focus' ? <FocusTab mixer={mixer} routines={routines} /> : <AlarmTab mixer={mixer} routines={routines} />}
    </Modal>
  );
}

function TemplateSelect({ mixer, value, onChange, label }: { mixer: Mixer; value: string | null; onChange: (id: string | null) => void; label: string }) {
  const i18n = useI18n();
  return (
    <select className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-label={label}>
      <option value="">{i18n.t('rt.keepMix')}</option>
      {mixer.templates.map((tpl) => (
        <option key={tpl.id} value={tpl.id}>
          {templateTitle(i18n, tpl)}
        </option>
      ))}
    </select>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="routine-row">
      <span>{label}</span>
      {children}
    </label>
  );
}

function MinutesInput({ value, onChange, min, max, label }: { value: number; onChange: (n: number) => void; min: number; max: number; label: string }) {
  const { t } = useI18n();
  return (
    <span className="minutes">
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value));
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
      {t('rt.min')}
    </span>
  );
}

function FocusTab({ mixer, routines }: { mixer: Mixer; routines: Routines }) {
  const { t } = useI18n();
  const { focus, setFocus, run, focusRemaining } = routines;
  const set = (patch: Partial<typeof focus>) => setFocus((f) => ({ ...f, ...patch }));

  return (
    <div className="routine">
      {run && focusRemaining !== null ? (
        <div className={`focus-live ${run.phase}`}>
          <div className="focus-phase">
            {run.phase === 'focus' ? <Brain size={16} /> : <Coffee size={16} />}
            {run.phase === 'focus' ? t('rt.focus') : t('rt.break')}
            <span className="focus-count">{t('rt.done', { n: run.done })}</span>
          </div>
          <div className="focus-clock">{formatClock(focusRemaining)}</div>
          <div className="focus-actions">
            <button className="btn-outline" onClick={routines.skipPhase}>
              <SkipForward size={15} /> {run.phase === 'focus' ? t('rt.startBreak') : t('rt.startFocus')}
            </button>
            <button className="btn-outline" onClick={routines.stopFocus}>
              <Square size={14} /> {t('rt.stop')}
            </button>
          </div>
        </div>
      ) : (
        <p className="hint">{t('rt.focusHint')}</p>
      )}

      <Row label={t('rt.focus')}>
        <MinutesInput value={focus.focusMinutes} min={1} max={180} onChange={(n) => set({ focusMinutes: n })} label={t('rt.focusMinAria')} />
        <TemplateSelect mixer={mixer} value={focus.focusTemplateId} onChange={(id) => set({ focusTemplateId: id })} label={t('rt.focusMixAria')} />
      </Row>
      <Row label={t('rt.break')}>
        <MinutesInput value={focus.breakMinutes} min={1} max={60} onChange={(n) => set({ breakMinutes: n })} label={t('rt.breakMinAria')} />
        <TemplateSelect mixer={mixer} value={focus.breakTemplateId} onChange={(id) => set({ breakTemplateId: id })} label={t('rt.breakMixAria')} />
      </Row>

      {!run && (
        <button className="btn-primary routine-go" onClick={routines.startFocus}>
          <Brain size={16} /> {t('rt.go')}
        </button>
      )}
    </div>
  );
}

function AlarmTab({ mixer, routines }: { mixer: Mixer; routines: Routines }) {
  const { t, locale, lang } = useI18n();
  const { alarm, setAlarm } = routines;
  const next = nextAlarm(alarm.time);
  const minutesLeft = Math.max(1, Math.round((next.getTime() - Date.now()) / 60_000));
  const inText = minutesLeft >= 60 ? t('rt.inHM', { h: Math.floor(minutesLeft / 60), m: minutesLeft % 60 }) : t('rt.inM', { m: minutesLeft });
  const weekday = next.toLocaleDateString(locale, { weekday: 'long' });
  const when = lang === 'th' ? `${weekday} ${alarm.time} น.` : `${weekday} ${alarm.time}`;

  return (
    <div className="routine">
      <div className={`alarm-status ${alarm.enabled ? 'on' : ''}`}>
        <AlarmClock size={18} />
        {alarm.enabled ? <span>{t('rt.rings', { when, in: inText })}</span> : <span>{t('rt.off')}</span>}
      </div>

      <Row label={t('rt.time')}>
        <input className="time-input" type="time" value={alarm.time} onChange={(e) => e.target.value && setAlarm({ time: e.target.value })} aria-label={t('rt.timeAria')} />
      </Row>
      <Row label={t('rt.fadeIn')}>
        <MinutesInput value={alarm.fadeMinutes} min={0} max={60} onChange={(n) => setAlarm({ fadeMinutes: n })} label={t('rt.fadeAria')} />
      </Row>
      <Row label={t('rt.play')}>
        <TemplateSelect mixer={mixer} value={alarm.templateId} onChange={(id) => setAlarm({ templateId: id })} label={t('rt.mixAria')} />
      </Row>
      <Row label={t('rt.repeat')}>
        <span className="chips">
          <button type="button" className={`chip small ${alarm.daily ? 'active' : ''}`} onClick={() => setAlarm({ daily: true })}>
            {t('rt.daily')}
          </button>
          <button type="button" className={`chip small ${!alarm.daily ? 'active' : ''}`} onClick={() => setAlarm({ daily: false })}>
            {t('rt.once')}
          </button>
        </span>
      </Row>

      <button
        className={alarm.enabled ? 'btn-outline routine-go' : 'btn-primary routine-go'}
        onClick={() => {
          if (!alarm.enabled) requestNotifications();
          setAlarm({ enabled: !alarm.enabled });
        }}
      >
        <AlarmClock size={16} /> {alarm.enabled ? t('rt.turnOff') : t('rt.turnOn')}
      </button>
      <p className="hint">{isElectron ? t('rt.hintApp') : t('rt.hintWeb')}</p>
    </div>
  );
}
