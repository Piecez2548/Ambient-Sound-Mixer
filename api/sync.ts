// Vercel Function: cloud sync store.
//
// Devices share a sync code that never reaches this server. From the code the
// browser derives an id (SHA-256) and an AES key; it uploads only the id and
// an encrypted blob. So this function stores opaque ciphertext under a hash —
// it cannot read anyone's mixes, and a database leak reveals nothing.
//
// Storage: Upstash Redis (Vercel Marketplace). Each id is a hash with
// rev / updatedAt / blob; writes are compare-and-set on rev so two devices
// can't silently overwrite each other (the loser gets 409 + the current copy).

const PROD_ORIGIN = 'https://ambient-sound-mixer-lake.vercel.app';
const ALLOWED_ORIGINS = new Set([PROD_ORIGIN, 'http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:47821']);
const ID_RE = /^[0-9a-f]{64}$/;
const MAX_BLOB = 200_000; // characters of base64
const TTL_SECONDS = 400 * 24 * 3600; // forgotten codes expire ~13 months after the last write

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS },
  });
}

function originOk(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || ALLOWED_ORIGINS.has(origin) || /^https:\/\/ambient-sound-mixer-[\w-]+\.vercel\.app$/.test(origin);
}

// Works with either set of env var names the Upstash integration creates.
function redisConfig() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function redis(command: (string | number)[]) {
  const cfg = redisConfig()!;
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const body: any = await res.json().catch(() => null);
  if (!res.ok || body?.error) throw new Error(body?.error ?? `Redis error ${res.status}`);
  return body.result;
}

const key = (id: string) => `asm:sync:${id}`;

// Compare-and-set: only write when the stored rev matches the device's base rev.
const CAS_SCRIPT = `
local rev = redis.call('HGET', KEYS[1], 'rev') or '0'
if rev ~= ARGV[1] then return {0, rev} end
local nextRev = tonumber(rev) + 1
redis.call('HSET', KEYS[1], 'rev', nextRev, 'updatedAt', ARGV[3], 'blob', ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[4])
return {1, tostring(nextRev)}
`;

async function readDoc(id: string) {
  const [rev, updatedAt, blob] = (await redis(['HMGET', key(id), 'rev', 'updatedAt', 'blob'])) as (string | null)[];
  return rev ? { rev: Number(rev), updatedAt: Number(updatedAt), blob } : null;
}

async function guard(request: Request) {
  if (!originOk(request)) return json({ error: 'Origin not allowed' }, 403);
  if (!redisConfig()) return json({ error: 'Cloud storage is not set up', reason: 'notConfigured' }, 503);
  return null;
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  const bad = await guard(request);
  if (bad) return bad;
  const url = new URL(request.url);
  const id = url.searchParams.get('id') ?? '';
  if (!ID_RE.test(id)) return json({ error: 'Bad id' }, 400);
  try {
    // Cheap check first: devices poll with the rev they already have.
    const known = url.searchParams.get('rev');
    if (known) {
      const rev = (await redis(['HGET', key(id), 'rev'])) as string | null;
      if (rev && rev === known) return json({ rev: Number(rev), unchanged: true });
    }
    const doc = await readDoc(id);
    return doc ? json(doc) : json({ error: 'Not found', rev: 0 }, 404);
  } catch {
    return json({ error: 'Storage error' }, 502);
  }
}

export async function PUT(request: Request) {
  const bad = await guard(request);
  if (bad) return bad;
  const body: any = await request.json().catch(() => null);
  const id = body?.id;
  const baseRev = Number(body?.baseRev);
  const blob = body?.blob;
  if (typeof id !== 'string' || !ID_RE.test(id)) return json({ error: 'Bad id' }, 400);
  if (!Number.isInteger(baseRev) || baseRev < 0) return json({ error: 'Bad baseRev' }, 400);
  if (typeof blob !== 'string' || !blob || blob.length > MAX_BLOB || !/^[A-Za-z0-9+/=]+$/.test(blob)) {
    return json({ error: 'Bad blob' }, 400);
  }
  try {
    const [ok, rev] = (await redis(['EVAL', CAS_SCRIPT, 1, key(id), String(baseRev), blob, Date.now(), TTL_SECONDS])) as [number, string];
    if (ok === 1) return json({ rev: Number(rev) });
    // Someone else wrote first: hand back the current copy to merge with.
    return json({ error: 'Conflict', ...(await readDoc(id)) }, 409);
  } catch {
    return json({ error: 'Storage error' }, 502);
  }
}

export async function DELETE(request: Request) {
  const bad = await guard(request);
  if (bad) return bad;
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!ID_RE.test(id)) return json({ error: 'Bad id' }, 400);
  try {
    await redis(['DEL', key(id)]);
    return json({ deleted: true });
  } catch {
    return json({ error: 'Storage error' }, 502);
  }
}
