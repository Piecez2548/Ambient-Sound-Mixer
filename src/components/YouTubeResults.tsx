import { Check, ExternalLink } from 'lucide-react';
import type { VideoResult } from '../lib/youtube';
import { useI18n } from '../i18n';
import { watchUrl } from '../lib/youtube';

interface Props {
  results: VideoResult[];
  selectedId?: string;
  actionLabel: string;
  isDone?: (v: VideoResult) => boolean;
  onPick: (v: VideoResult) => void;
}

export function YouTubeResults({ results, selectedId, actionLabel, isDone, onPick }: Props) {
  const { t } = useI18n();
  return (
    <ul className="yt-results">
      {results.map((v) => {
        const done = v.id === selectedId || isDone?.(v);
        return (
          <li key={v.id} className={done ? 'selected' : ''}>
            <img src={v.thumbnail} alt="" loading="lazy" />
            <div className="yt-meta">
              <div className="yt-title" title={v.title}>
                {v.title}
              </div>
              <div className="yt-channel-name">
                {v.channel}
                <a href={watchUrl(v.id)} target="_blank" rel="noreferrer" aria-label={t('yt.openAria')}>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
            <button className={`btn-small ${done ? 'done' : ''}`} onClick={() => onPick(v)} disabled={done}>
              {done ? <Check size={14} /> : actionLabel}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
