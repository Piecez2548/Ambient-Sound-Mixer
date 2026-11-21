import { useEffect, useMemo, useRef, useState } from 'react';
import { CirclePlay, ListFilter, Search } from 'lucide-react';
import { MOODS, type Mood } from '../data/templates';
import { SOUNDS } from '../data/sounds';
import { moodName, soundName, templateDesc, templateTitle, useI18n } from '../i18n';
import type { Mixer } from '../state/useMixer';
import { TemplateCard } from './TemplateCard';

type Filter = 'All' | Mood | 'Mine';

interface Props {
  mixer: Mixer;
  onCreate: () => void;
  onSearchYouTube: (query: string) => void;
}

export function TemplatesPanel({ mixer, onCreate, onSearchYouTube }: Props) {
  const i18n = useI18n();
  const { t } = i18n;
  const filterLabel = (f: Filter) => (f === 'All' ? t('tp.all') : f === 'Mine' ? t('tp.mine') : moodName(i18n, f));
  const [query, setQuery] = useState('');
  const [mood, setMood] = useState<Filter>('All');
  const [soundFilter, setSoundFilter] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filterOpen) return;
    const close = (e: MouseEvent) => !popRef.current?.contains(e.target as Node) && setFilterOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [filterOpen]);

  const hasCustom = mixer.templates.some((t) => t.custom);
  const filters: Filter[] = ['All', ...MOODS, ...(hasCustom ? (['Mine'] as const) : [])];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mixer.templates.filter((t) => {
      if (mood === 'Mine' && !t.custom) return false;
      if (mood !== 'All' && mood !== 'Mine' && !t.moods.includes(mood)) return false;
      if (soundFilter.length && !soundFilter.every((id) => t.sounds.some((s) => s.id === id))) return false;
      if (!q) return true;
      // Match both languages, so "rain" and "ฝน" both work.
      const names = t.sounds
        .map((s) => mixer.soundById.get(s.id))
        .flatMap((s) => (s ? [s.name, soundName(i18n, s)] : []))
        .join(' ');
      const moods = t.moods.flatMap((m) => [m, moodName(i18n, m)]).join(' ');
      const text = `${t.title} ${t.description} ${templateTitle(i18n, t)} ${templateDesc(i18n, t)} ${moods} ${names}`;
      return text.toLowerCase().includes(q);
    });
  }, [mixer.templates, mixer.soundById, query, mood, soundFilter, i18n]);

  const toggleSoundFilter = (id: string) =>
    setSoundFilter((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  return (
    <section className="panel templates">
      <div className="tp-top">
        <label className="search">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && visible.length === 0 && query.trim() && onSearchYouTube(query.trim())}
            placeholder={t('tp.search')}
            aria-label={t('tp.searchAria')}
          />
        </label>
        <button className="btn-outline" onClick={onCreate}>
          {t('tp.create')}
        </button>
      </div>

      <div className="tp-head">
        <div>
          <h2>{t('tp.title')}</h2>
          <p>{t('tp.subtitle')}</p>
        </div>
        <div className="chips">
          {filters.map((f) => (
            <button key={f} className={`chip ${mood === f ? 'active' : ''}`} onClick={() => setMood(f)}>
              {filterLabel(f)}
            </button>
          ))}
          <div className="filter-wrap" ref={popRef}>
            <button
              className={`chip icon ${soundFilter.length ? 'active' : ''}`}
              onClick={() => setFilterOpen((o) => !o)}
              aria-label={t('tp.filterAria')}
              aria-expanded={filterOpen}
            >
              <ListFilter size={16} />
              {soundFilter.length > 0 && <span className="chip-count">{soundFilter.length}</span>}
            </button>
            {filterOpen && (
              <div className="popover">
                <div className="popover-head">
                  <span>{t('tp.mustInclude')}</span>
                  {soundFilter.length > 0 && (
                    <button className="link" onClick={() => setSoundFilter([])}>
                      {t('tp.clear')}
                    </button>
                  )}
                </div>
                <div className="popover-grid">
                  {SOUNDS.map((s) => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.id}
                        className={`chip small ${soundFilter.includes(s.id) ? 'active' : ''}`}
                        onClick={() => toggleSoundFilter(s.id)}
                      >
                        <Icon size={13} /> {soundName(i18n, s)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid">
        {visible.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            soundById={mixer.soundById}
            active={mixer.templateId === t.id}
            playing={mixer.playing}
            onApply={() => mixer.applyTemplate(t)}
            onDelete={t.custom ? () => mixer.deleteTemplate(t.id) : undefined}
          />
        ))}
      </div>

      {visible.length === 0 && (
        <div className="empty">
          <p>{t('tp.none')}</p>
          {query.trim() && (
            <button className="btn-outline" onClick={() => onSearchYouTube(query.trim())}>
              <CirclePlay size={16} /> {t('tp.searchYouTube', { q: query.trim() })}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
