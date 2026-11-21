import { useEffect, useState, type CSSProperties } from 'react';
import { AudioLines, Pause, Play, Trash2 } from 'lucide-react';
import type { SoundDef } from '../data/sounds';
import type { Template } from '../data/templates';
import { soundName, templateDesc, templateTitle, useI18n } from '../i18n';
import { searchVideos } from '../lib/youtube';
import { Thumb } from './Thumb';

function useCoverVideo(t: Template) {
  const [videoId, setVideoId] = useState<string | null>(t.imageVideoId ?? null);
  useEffect(() => {
    if (t.imageVideoId) return setVideoId(t.imageVideoId);
    let alive = true;
    searchVideos(t.imageQuery, { duration: 'any', maxResults: 5, ttlDays: 30 })
      .then((list) => alive && list[0] && setVideoId(list[0].id))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [t.imageVideoId, t.imageQuery]);
  return videoId;
}

interface Props {
  template: Template;
  soundById: Map<string, SoundDef>;
  active: boolean;
  playing: boolean;
  onApply: () => void;
  onDelete?: () => void;
}

export function TemplateCard({ template, soundById, active, playing, onApply, onDelete }: Props) {
  const i18n = useI18n();
  const { t } = i18n;
  const title = templateTitle(i18n, template);
  const description = templateDesc(i18n, template);
  const cover = useCoverVideo(template);
  const firstSound = soundById.get(template.sounds[0]?.id ?? '');
  const FallbackIcon = firstSound?.icon ?? AudioLines;

  return (
    <article
      className={`tcard ${active ? 'active' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onApply}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onApply();
        }
      }}
      aria-pressed={active}
      aria-label={`${title}: ${description}`}
    >
      <div className="tcard-media" style={{ '--hue': firstSound?.color ?? '#8b5cf6' } as CSSProperties}>
        {cover ? <Thumb videoId={cover} className="tcard-img" /> : <FallbackIcon className="tcard-fallback" size={48} strokeWidth={1.2} />}
      </div>
      <div className="tcard-shade" />

      <div className="tcard-play">{active && playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</div>

      {active && (
        <span className="tcard-badge">
          <AudioLines size={12} className={playing ? 'pulse' : ''} /> {playing ? t('card.playing') : t('card.paused')}
        </span>
      )}
      {template.custom && onDelete && (
        <button
          className="tcard-delete"
          aria-label={t('card.delete', { title })}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 size={14} />
        </button>
      )}

      <div className="tcard-body">
        <h3>{title}</h3>
        <p>{description}</p>
        <div className="tcard-icons">
          {template.sounds.map((s) => {
            const sound = soundById.get(s.id);
            if (!sound) return null;
            const Icon = sound.icon;
            return <Icon key={s.id} size={16} aria-label={soundName(i18n, sound)} />;
          })}
        </div>
      </div>
    </article>
  );
}
