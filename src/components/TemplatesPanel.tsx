import { useEffect, useMemo, useRef, useState } from 'react';
import { CirclePlay, ListFilter, Search } from 'lucide-react';
import { MOODS, type Mood } from '../data/templates';
import { SOUNDS } from '../data/sounds';
import type { Mixer } from '../state/useMixer';
import { TemplateCard } from './TemplateCard';

type Filter = 'All' | Mood | 'Mine';

interface Props {
  mixer: Mixer;
  onCreate: () => void;
  onSearchYouTube: (query: string) => void;
}

export function TemplatesPanel({ mixer, onCreate, onSearchYouTube }: Props) {
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
      const names = t.sounds.map((s) => mixer.soundById.get(s.id)?.name ?? '').join(' ');
      return `${t.title} ${t.description} ${t.moods.join(' ')} ${names}`.toLowerCase().includes(q);
    });
  }, [mixer.templates, mixer.soundById, query, mood, soundFilter]);

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
            placeholder="Search for Templates..."
            aria-label="Search templates"
          />
        </label>
        <button className="btn-outline" onClick={onCreate}>
          Create your own
        </button>
      </div>

      <div className="tp-head">
        <div>
          <h2>Sound Templates</h2>
          <p>Start with a vibe. customize it your way.</p>
        </div>
        <div className="chips">
          {filters.map((f) => (
            <button key={f} className={`chip ${mood === f ? 'active' : ''}`} onClick={() => setMood(f)}>
              {f}
            </button>
          ))}
          <div className="filter-wrap" ref={popRef}>
            <button
              className={`chip icon ${soundFilter.length ? 'active' : ''}`}
              onClick={() => setFilterOpen((o) => !o)}
              aria-label="Filter by sound"
              aria-expanded={filterOpen}
            >
              <ListFilter size={16} />
              {soundFilter.length > 0 && <span className="chip-count">{soundFilter.length}</span>}
            </button>
            {filterOpen && (
              <div className="popover">
                <div className="popover-head">
                  <span>Must include</span>
                  {soundFilter.length > 0 && (
                    <button className="link" onClick={() => setSoundFilter([])}>
                      Clear
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
                        <Icon size={13} /> {s.name}
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
          <p>No templates match.</p>
          {query.trim() && (
            <button className="btn-outline" onClick={() => onSearchYouTube(query.trim())}>
              <CirclePlay size={16} /> Search YouTube for “{query.trim()}”
            </button>
          )}
        </div>
      )}
    </section>
  );
}
