import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Check, LoaderCircle, Search } from 'lucide-react';
import { SOUNDS } from '../data/sounds';
import { MOODS, type Mood } from '../data/templates';
import { categoryName, moodName, soundName, useI18n } from '../i18n';
import type { Duration } from '../lib/youtube';
import type { Mixer } from '../state/useMixer';
import { Modal } from './Modal';
import { YouTubeResults } from './YouTubeResults';
import { useYouTubeSearch } from './useYouTubeSearch';

export type CreateTab = 'library' | 'youtube' | 'save';

interface Props {
  mixer: Mixer;
  initialTab: CreateTab;
  initialQuery?: string;
  onClose: () => void;
}

const CATEGORIES = [...new Set(SOUNDS.map((s) => s.category))];

export function CreateModal({ mixer, initialTab, initialQuery = '', onClose }: Props) {
  const i18n = useI18n();
  const { t } = i18n;
  const [tab, setTab] = useState<CreateTab>(initialTab);
  const activeIds = new Set(mixer.active.map((e) => e.id));

  return (
    <Modal title={t('create.title')} subtitle={t('create.subtitle')} onClose={onClose} wide>
      <div className="tabs" role="tablist">
        {(
          [
            ['library', t('create.library')],
            ['youtube', t('create.youtube')],
            ['save', t('create.save')],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'library' && (
        <div className="library">
          {CATEGORIES.map((cat) => (
            <section key={cat}>
              <h4>{categoryName(i18n, cat)}</h4>
              <div className="library-grid">
                {SOUNDS.filter((s) => s.category === cat).map((s) => {
                  const Icon = s.icon;
                  const on = activeIds.has(s.id);
                  return (
                    <button
                      key={s.id}
                      className={`lib-tile ${on ? 'on' : ''}`}
                      style={{ '--hue': s.color } as CSSProperties}
                      onClick={() => mixer.toggleSound(s.id)}
                      aria-pressed={on}
                    >
                      <span className="lib-icon">
                        <Icon size={20} />
                      </span>
                      <span>{soundName(i18n, s)}</span>
                      {on && <Check className="lib-check" size={14} />}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === 'youtube' && <YouTubeTab mixer={mixer} initialQuery={initialQuery} />}
      {tab === 'save' && <SaveTab mixer={mixer} onSaved={onClose} />}
    </Modal>
  );
}

function YouTubeTab({ mixer, initialQuery }: { mixer: Mixer; initialQuery: string }) {
  const { t, errorText } = useI18n();
  const [query, setQuery] = useState(initialQuery);
  const [duration, setDuration] = useState<Duration>('long');
  const search = useYouTubeSearch();
  const activeIds = new Set(mixer.active.map((e) => e.id));

  useEffect(() => {
    if (initialQuery) search.run(initialQuery, 'long');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    search.run(query, duration);
  };

  return (
    <div className="yt-tab">
      <form className="yt-search" onSubmit={submit}>
        <label className="search grow">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('yt.placeholder')} autoFocus />
        </label>
        <select value={duration} onChange={(e) => setDuration(e.target.value as Duration)} aria-label={t('yt.lengthAria')}>
          <option value="long">{t('yt.long')}</option>
          <option value="medium">{t('yt.medium')}</option>
          <option value="any">{t('yt.any')}</option>
        </select>
        <button className="btn-primary" type="submit" disabled={search.loading || !query.trim()}>
          {search.loading ? <LoaderCircle size={16} className="spin" /> : t('yt.search')}
        </button>
      </form>
      {search.error && <div className="notice error">{errorText(search.error)}</div>}
      <YouTubeResults
        results={search.results}
        actionLabel={t('yt.addToMix')}
        isDone={(v) => activeIds.has(`yt-${v.id}`)}
        onPick={(v) => mixer.addCustomSound(v)}
      />
      {!search.loading && !search.error && search.results.length === 0 && (
        <p className="hint">{t('yt.cachedHint')}</p>
      )}
    </div>
  );
}

function SaveTab({ mixer, onSaved }: { mixer: Mixer; onSaved: () => void }) {
  const i18n = useI18n();
  const { t } = i18n;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [moods, setMoods] = useState<Mood[]>([]);
  const empty = mixer.active.length === 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || empty) return;
    mixer.saveTemplate(title.trim(), description.trim() || t('save.defaultDesc', { n: mixer.active.length }), moods);
    onSaved();
  };

  return (
    <form className="save-form" onSubmit={submit}>
      <div className="save-preview">
        {mixer.active.map((e) => {
          const s = mixer.soundById.get(e.id);
          if (!s) return null;
          const Icon = s.icon;
          return (
            <span key={e.id} className="chip small static">
              <Icon size={13} /> {soundName(i18n, s)} · {e.volume}%
            </span>
          );
        })}
        {empty && <span className="hint">{t('save.empty')}</span>}
      </div>
      <label className="field">
        <span>{t('save.name')}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('save.namePh')} maxLength={40} required />
      </label>
      <label className="field">
        <span>{t('save.desc')}</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('save.descPh')} maxLength={70} />
      </label>
      <div className="field">
        <span>{t('save.moods')}</span>
        <div className="chips">
          {MOODS.map((m) => (
            <button
              type="button"
              key={m}
              className={`chip small ${moods.includes(m) ? 'active' : ''}`}
              onClick={() => setMoods((list) => (list.includes(m) ? list.filter((x) => x !== m) : [...list, m]))}
            >
              {moodName(i18n, m)}
            </button>
          ))}
        </div>
      </div>
      <button className="btn-primary" type="submit" disabled={!title.trim() || empty}>
        {t('save.submit')}
      </button>
    </form>
  );
}
