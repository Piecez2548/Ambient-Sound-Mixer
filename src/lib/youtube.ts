import { storage } from './storage';

export interface VideoResult {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
}

const API_KEY = ((import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined) ?? '').trim();
export const hasApiKey = API_KEY.length > 0;

export type Duration = 'any' | 'short' | 'medium' | 'long';

export interface SearchOptions {
  maxResults?: number;
  duration?: Duration;
  /** search.list costs 100 quota units (10,000/day free), so cache aggressively. */
  ttlDays?: number;
}

export class YouTubeError extends Error {
  reason?: string;
  constructor(message: string, reason?: string) {
    super(message);
    this.reason = reason;
  }
}

interface CacheEntry {
  at: number;
  ttl: number;
  items: VideoResult[];
}

const inflight = new Map<string, Promise<VideoResult[]>>();

function decodeEntities(s: string) {
  const t = document.createElement('textarea');
  t.innerHTML = s;
  return t.value;
}

export function thumbUrl(videoId: string, quality: 'maxresdefault' | 'hqdefault' | 'mqdefault' = 'mqdefault') {
  return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
}

export function watchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function searchVideos(query: string, opts: SearchOptions = {}): Promise<VideoResult[]> {
  const { maxResults = 12, duration = 'long', ttlDays = 7 } = opts;
  const q = query.trim();
  const cacheKey = `asm:yt:${duration}:${maxResults}:${q.toLowerCase()}`;

  const cached = storage.get<CacheEntry>(cacheKey);
  if (cached && Date.now() - cached.at < cached.ttl) return Promise.resolve(cached.items);

  if (!hasApiKey) {
    return Promise.reject(new YouTubeError('Add VITE_YOUTUBE_API_KEY to .env', 'noKey'));
  }

  const pending = inflight.get(cacheKey);
  if (pending) return pending;

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    safeSearch: 'moderate',
    maxResults: String(maxResults),
    q,
    key: API_KEY,
  });
  if (duration !== 'any') params.set('videoDuration', duration);

  const request = fetch(`https://www.googleapis.com/youtube/v3/search?${params}`)
    .then(async (res) => {
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const reason: string | undefined = body?.error?.errors?.[0]?.reason;
        const message =
          reason === 'quotaExceeded'
            ? 'YouTube API quota used up — try again tomorrow'
            : reason === 'keyInvalid'
              ? 'YouTube API key is invalid'
              : (body?.error?.message as string | undefined) ?? `YouTube API error ${res.status}`;
        throw new YouTubeError(message, reason);
      }
      const items: VideoResult[] = ((body?.items ?? []) as any[])
        .filter((it) => it?.id?.videoId && it.snippet?.liveBroadcastContent !== 'upcoming')
        .map((it) => ({
          id: it.id.videoId as string,
          title: decodeEntities(it.snippet.title ?? ''),
          channel: decodeEntities(it.snippet.channelTitle ?? ''),
          thumbnail: (it.snippet.thumbnails?.medium?.url as string | undefined) ?? thumbUrl(it.id.videoId),
        }));
      storage.set(cacheKey, { at: Date.now(), ttl: ttlDays * 86_400_000, items } satisfies CacheEntry);
      return items;
    })
    .finally(() => inflight.delete(cacheKey));

  inflight.set(cacheKey, request);
  return request;
}
