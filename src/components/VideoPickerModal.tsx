import { useEffect, useState, type FormEvent } from 'react';
import { ExternalLink, LoaderCircle, Search } from 'lucide-react';
import { soundName, useI18n } from '../i18n';
import { watchUrl } from '../lib/youtube';
import type { Mixer } from '../state/useMixer';
import { Modal } from './Modal';
import { YouTubeResults } from './YouTubeResults';
import { useYouTubeSearch } from './useYouTubeSearch';

export function VideoPickerModal({ mixer, soundId, onClose }: { mixer: Mixer; soundId: string; onClose: () => void }) {
  const i18n = useI18n();
  const { t, errorText } = i18n;
  const sound = mixer.soundById.get(soundId);
  const current = mixer.videos[soundId];
  const channel = mixer.channels[soundId];
  const [query, setQuery] = useState(sound?.video ? '' : (sound?.query ?? ''));
  const search = useYouTubeSearch();

  useEffect(() => {
    if (sound && !sound.video) search.run(sound.query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundId]);

  if (!sound) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    search.run(query);
  };

  return (
    <Modal title={t('picker.title', { name: soundName(i18n, sound) })} subtitle={t('picker.subtitle')} onClose={onClose} wide>
      {current && (
        <div className="current-video">
          <img src={current.thumbnail} alt="" />
          <div>
            <div className="label-sm">{t('picker.nowUsing')}</div>
            <div className="yt-title">{current.title}</div>
            <div className="yt-channel-name">
              {current.channel}
              <a href={watchUrl(current.id)} target="_blank" rel="noreferrer">
                {t('mixer.openYouTube')} <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      )}
      {channel?.status === 'error' && <div className="notice error">{errorText(channel.error)}</div>}

      <form className="yt-search" onSubmit={submit}>
        <label className="search grow">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('picker.searchPh')} />
        </label>
        <button className="btn-primary" type="submit" disabled={search.loading || !query.trim()}>
          {search.loading ? <LoaderCircle size={16} className="spin" /> : t('yt.search')}
        </button>
      </form>
      {search.error && <div className="notice error">{errorText(search.error)}</div>}
      <YouTubeResults
        results={search.results}
        selectedId={current?.id}
        actionLabel={t('picker.use')}
        onPick={(v) => {
          mixer.chooseVideo(soundId, v);
          onClose();
        }}
      />
    </Modal>
  );
}
