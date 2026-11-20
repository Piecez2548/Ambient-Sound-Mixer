import { storage } from './storage';

export interface VideoResult {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
}

// Search goes through our Vercel Function (api/search.ts), which holds the API
// key. On a Vercel deployment it's same-origin; Electron and `npm run dev` call
// the production deployment.
const PROD_API = 'https://ambient-sound-mixer-lake.vercel.app/api/search';
const SEARCH_API =
  (import.meta.env.VITE_SEARCH_API as string | undefined) ??
  (location.hostname.endsWith('.vercel.app') ? '/api/search' : PROD_API);

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

  const pending = inflight.get(cacheKey);
  if (pending) return pending;

  const params = new URLSearchParams({ q, duration, max: String(maxResults) });

  const request = fetch(`${SEARCH_API}?${params}`)
    .catch(() => {
      throw new YouTubeError('Can’t reach the search server — check your internet connection', 'network');
    })
    .then(async (res) => {
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new YouTubeError((body?.error as string | undefined) ?? `Search error ${res.status}`, body?.reason);
      }
      const items: VideoResult[] = ((body?.items ?? []) as VideoResult[]).map((it) => ({
        ...it,
        title: decodeEntities(it.title),
        channel: decodeEntities(it.channel),
      }));
      storage.set(cacheKey, { at: Date.now(), ttl: ttlDays * 86_400_000, items } satisfies CacheEntry);
      return items;
    })
    .finally(() => inflight.delete(cacheKey));

  inflight.set(cacheKey, request);
  return request;
}
