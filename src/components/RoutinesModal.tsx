import { useState, type ReactNode } from 'react';
import { AlarmClock, Brain, Coffee, SkipForward, Square } from 'lucide-react';
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
  const [tab, setTab] = useState<RoutinesTab>(initialTab);
  return (
    <Modal title="Alarm & Focus" subtitle="Let your ambience follow your day." onClose={onClose}>
      <div className="tabs" role="tablist">
        {(
          [
            ['focus', 'Focus timer'],
            ['alarm', 'Wake-up alarm'],
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
  return (
    <select className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-label={label}>
      <option value="">Keep the current mix</option>
      {mixer.templates.map((t) => (
        <option key={t.id} value={t.id}>
          {t.title}
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
      min
    </span>
  );
}

function FocusTab({ mixer, routines }: { mixer: Mixer; routines: Routines }) {
  const { focus, setFocus, run, focusRemaining } = routines;
  const set = (patch: Partial<typeof focus>) => setFocus((f) => ({ ...f, ...patch }));

  return (
    <div className="routine">
      {run && focusRemaining !== null ? (
        <div className={`focus-live ${run.phase}`}>
          <div className="focus-phase">
            {run.phase === 'focus' ? <Brain size={16} /> : <Coffee size={16} />}
            {run.phase === 'focus' ? 'Focus' : 'Break'}
            <span className="focus-count">{run.done} done</span>
          </div>
          <div className="focus-clock">{formatClock(focusRemaining)}</div>
          <div className="focus-actions">
            <button className="btn-outline" onClick={routines.skipPhase}>
              <SkipForward size={15} /> {run.phase === 'focus' ? 'Start break' : 'Start focus'}
            </button>
            <button className="btn-outline" onClick={routines.stopFocus}>
              <Square size={14} /> Stop
            </button>
          </div>
        </div>
      ) : (
        <p className="hint">Work in focused blocks with short breaks. The mix switches automatically and a soft chime marks each change.</p>
      )}

      <Row label="Focus">
        <MinutesInput value={focus.focusMinutes} min={1} max={180} onChange={(n) => set({ focusMinutes: n })} label="Focus minutes" />
        <TemplateSelect mixer={mixer} value={focus.focusTemplateId} onChange={(id) => set({ focusTemplateId: id })} label="Focus mix" />
      </Row>
      <Row label="Break">
        <MinutesInput value={focus.breakMinutes} min={1} max={60} onChange={(n) => set({ breakMinutes: n })} label="Break minutes" />
        <TemplateSelect mixer={mixer} value={focus.breakTemplateId} onChange={(id) => set({ breakTemplateId: id })} label="Break mix" />
      </Row>

      {!run && (
        <button className="btn-primary routine-go" onClick={routines.startFocus}>
          <Brain size={16} /> Start focusing
        </button>
      )}
    </div>
  );
}

function AlarmTab({ mixer, routines }: { mixer: Mixer; routines: Routines }) {
  const { alarm, setAlarm } = routines;
  const next = nextAlarm(alarm.time);
  const inHours = (next.getTime() - Date.now()) / 3_600_000;
  const when = `${next.toLocaleDateString(undefined, { weekday: 'long' })} ${alarm.time}`;

  return (
    <div className="routine">
      <div className={`alarm-status ${alarm.enabled ? 'on' : ''}`}>
        <AlarmClock size={18} />
        {alarm.enabled ? (
          <span>
            Rings <strong>{when}</strong> — in {inHours >= 1 ? `${Math.floor(inHours)} h ${Math.round((inHours % 1) * 60)} min` : `${Math.max(1, Math.round(inHours * 60))} min`}
          </span>
        ) : (
          <span>Alarm is off</span>
        )}
      </div>

      <Row label="Time">
        <input className="time-input" type="time" value={alarm.time} onChange={(e) => e.target.value && setAlarm({ time: e.target.value })} aria-label="Alarm time" />
      </Row>
      <Row label="Fade in">
        <MinutesInput value={alarm.fadeMinutes} min={0} max={60} onChange={(n) => setAlarm({ fadeMinutes: n })} label="Fade-in minutes" />
      </Row>
      <Row label="Play">
        <TemplateSelect mixer={mixer} value={alarm.templateId} onChange={(id) => setAlarm({ templateId: id })} label="Alarm mix" />
      </Row>
      <Row label="Repeat">
        <span className="chips">
          <button type="button" className={`chip small ${alarm.daily ? 'active' : ''}`} onClick={() => setAlarm({ daily: true })}>
            Every day
          </button>
          <button type="button" className={`chip small ${!alarm.daily ? 'active' : ''}`} onClick={() => setAlarm({ daily: false })}>
            Once
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
        <AlarmClock size={16} /> {alarm.enabled ? 'Turn alarm off' : 'Turn alarm on'}
      </button>
      <p className="hint">
        {isElectron
          ? 'Keep the app running (the tray is fine) and the computer awake — a sleeping PC can’t ring.'
          : 'Keep this tab open and the device awake. For a reliable alarm, use the Windows app.'}
      </p>
    </div>
  );
}
