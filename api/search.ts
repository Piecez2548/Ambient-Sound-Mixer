// Vercel Function: YouTube search proxy.
// Keeps the API key on the server and lets Vercel's CDN cache each query for a
// week, so every visitor shares one cached result instead of spending quota.

const PROD_ORIGIN = 'https://ambient-sound-mixer-lake.vercel.app';
const ALLOWED_ORIGINS = new Set([PROD_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:47821']);
const DURATIONS = new Set(['any', 'short', 'medium', 'long']);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(body: unknown, status: number, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra },
  });
}

// Persistent result cache in Upstash Redis (the same store cloud sync uses).
// Vercel's CDN cache is wiped on every deploy; this one isn't, so a query that
// was ever answered costs no quota again for 30 days — and still works when the
// day's quota is used up. Every Redis problem is ignored: we just ask YouTube.
const CACHE_TTL_SECONDS = 30 * 24 * 3600;

function redisConfig() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function redis(command: (string | number)[]) {
  const cfg = redisConfig();
  if (!cfg) return null;
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(2500),
  });
  const body: any = await res.json().catch(() => null);
  if (!res.ok || body?.error) throw new Error('redis');
  return body.result;
}

const cacheKey = (q: string, duration: string, max: number) => `asm:search:v1:${duration}:${max}:${q.toLowerCase()}`;

async function cacheGet(key: string): Promise<unknown[] | null> {
  try {
    const raw = (await redis(['GET', key])) as string | null;
    const items = raw ? JSON.parse(raw) : null;
    return Array.isArray(items) ? items : null;
  } catch {
    return null;
  }
}

async function cachePut(key: string, items: unknown[]) {
  try {
    await redis(['SET', key, JSON.stringify(items), 'EX', CACHE_TTL_SECONDS]);
  } catch {
    /* cache is best-effort */
  }
}

const SUCCESS_CACHE = { 'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400' };

function decode(s: string) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  // Browsers on other sites get refused before any quota is spent.
  const origin = request.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.has(origin) && !/^https:\/\/ambient-sound-mixer-[\w-]+\.vercel\.app$/.test(origin)) {
    return json({ error: 'Origin not allowed' }, 403);
  }

  const key = (process.env.YOUTUBE_API_KEY ?? process.env.VITE_YOUTUBE_API_KEY ?? '').trim();
  if (!key) return json({ error: 'Server is missing YOUTUBE_API_KEY' }, 500);

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 120);
  const duration = url.searchParams.get('duration') ?? 'long';
  const max = Math.min(Math.max(Number(url.searchParams.get('max')) || 12, 1), 15);
  if (!q) return json({ error: 'Missing q' }, 400);
  if (!DURATIONS.has(duration)) return json({ error: 'Bad duration' }, 400);

  // Answered before (by anyone, at any deploy)? Serve it without touching YouTube.
  const ck = cacheKey(q, duration, max);
  const cached = await cacheGet(ck);
  if (cached) return json({ items: cached }, 200, { ...SUCCESS_CACHE, 'X-Search-Cache': 'redis' });

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    safeSearch: 'moderate',
    maxResults: String(max),
    q,
    key,
  });
  if (duration !== 'any') params.set('videoDuration', duration);

  // The key keeps its website restriction; identify as the production site.
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
    headers: { Referer: `${PROD_ORIGIN}/` },
  });
  const body: any = await res.json().catch(() => null);

  if (!res.ok) {
    const reason: string | undefined = body?.error?.errors?.[0]?.reason;
    const dailyLimit = reason === 'quotaExceeded' || /per day/i.test(body?.error?.message ?? '');
    const message =
      dailyLimit
        ? 'YouTube search limit reached for today — try again tomorrow'
        : (body?.error?.message as string | undefined) ?? `YouTube API error ${res.status}`;
    // Cache quota errors briefly so a burst of visitors doesn't hammer the API.
    return json({ error: message, reason }, res.status, { 'Cache-Control': 'public, s-maxage=300' });
  }

  const items = ((body?.items ?? []) as any[])
    .filter((it) => it?.id?.videoId && it.snippet?.liveBroadcastContent !== 'upcoming')
    .map((it) => ({
      id: it.id.videoId as string,
      title: decode(it.snippet.title ?? ''),
      channel: decode(it.snippet.channelTitle ?? ''),
      thumbnail: it.snippet.thumbnails?.medium?.url ?? `https://i.ytimg.com/vi/${it.id.videoId}/mqdefault.jpg`,
    }));

  // Don't remember empty answers: a later search might find something.
  if (items.length) await cachePut(ck, items);
  return json({ items }, 200, { ...SUCCESS_CACHE, 'X-Search-Cache': 'miss' });
}
