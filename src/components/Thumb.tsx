import { useEffect, useState } from 'react';
import { thumbUrl } from '../lib/youtube';

/** YouTube thumbnail: tries the HD frame, falls back to the always-present medium one. */
export function Thumb({ videoId, className }: { videoId: string; className?: string }) {
  const [src, setSrc] = useState(thumbUrl(videoId, 'maxresdefault'));
  useEffect(() => setSrc(thumbUrl(videoId, 'maxresdefault')), [videoId]);
  const fallback = thumbUrl(videoId, 'mqdefault');
  return (
    <img
      className={className}
      src={src}
      alt=""
      loading="lazy"
      draggable={false}
      // A missing maxres image comes back as a 120×90 grey placeholder.
      onLoad={(e) => e.currentTarget.naturalWidth <= 120 && src !== fallback && setSrc(fallback)}
      onError={() => src !== fallback && setSrc(fallback)}
    />
  );
}
