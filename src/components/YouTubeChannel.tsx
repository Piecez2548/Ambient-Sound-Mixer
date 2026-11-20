import { useEffect, useRef } from 'react';
import { loadYouTubeApi } from '../lib/ytPlayer';

export type PlayerStatus = 'loading' | 'playing' | 'paused';

interface Props {
  videoId: string;
  /** 0–100, already multiplied by master volume and timer fade. */
  volume: number;
  playing: boolean;
  onStatus: (status: PlayerStatus) => void;
  onError: (code: number) => void;
}

/**
 * One hidden YouTube IFrame player = one sound channel.
 * The video loops forever; volume and play/pause follow props.
 */
export function YouTubeChannel({ videoId, volume, playing, onStatus, onError }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const readyRef = useRef(false);
  const latest = useRef({ volume, playing, onStatus, onError });
  latest.current = { volume, playing, onStatus, onError };

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    latest.current.onStatus('loading');

    loadYouTubeApi().then((YTApi) => {
      if (cancelled || !host) return;
      const mount = document.createElement('div');
      host.appendChild(mount);
      playerRef.current = new YTApi.Player(mount, {
        videoId,
        width: 200,
        height: 200,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (e) => {
            readyRef.current = true;
            e.target.unMute();
            e.target.setVolume(latest.current.volume);
            if (latest.current.playing) e.target.playVideo();
            else latest.current.onStatus('paused');
          },
          onStateChange: (e) => {
            const S = YTApi.PlayerState;
            if (e.data === S.ENDED) {
              e.target.seekTo(0, true);
              e.target.playVideo();
            } else if (e.data === S.PLAYING) {
              latest.current.onStatus('playing');
              // The user paused meanwhile (state changes are async).
              if (!latest.current.playing) e.target.pauseVideo();
            } else if (e.data === S.BUFFERING) {
              latest.current.onStatus('loading');
            } else if (e.data === S.PAUSED) {
              latest.current.onStatus('paused');
            }
          },
          onError: (e) => latest.current.onError(Number(e.data)),
        },
      });
    });

    return () => {
      cancelled = true;
      readyRef.current = false;
      try {
        playerRef.current?.destroy();
      } catch {
        /* player already gone */
      }
      playerRef.current = null;
      if (host) host.innerHTML = '';
    };
  }, [videoId]);

  useEffect(() => {
    if (readyRef.current) playerRef.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    if (!readyRef.current || !playerRef.current) return;
    if (playing) playerRef.current.playVideo();
    else playerRef.current.pauseVideo();
  }, [playing]);

  return <div ref={hostRef} className="yt-channel" />;
}
