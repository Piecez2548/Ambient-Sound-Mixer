// Cloud sync between devices, keyed by a secret sync code.
//
// The code (20 Crockford base32 chars ≈ 100 bits) stays on the devices. From it
// we derive an id (sent to the server) and an AES-GCM key (never sent); the
// server only ever sees `id` and ciphertext. Each synced setting carries the
// time it last changed, and merging keeps the newer one per setting.
import { applyRemote, storage } from './storage';

/** Everything that follows you between devices. Play/pause never syncs. */
export const SYNC_KEYS = [
  'asm:active',
  'asm:master',
  'asm:videos',
  'asm:customSounds',
  'asm:customTemplates',
  'asm:template',
  'asm:natural',
  'asm:alarm',
  'asm:focus',
  'asm:lang',
] as const;
export type SyncKey = (typeof SYNC_KEYS)[number];
export const isSyncKey = (k: string): k is SyncKey => (SYNC_KEYS as readonly string[]).includes(k);

/** Lists that are merged item-by-item (by id) when a device first joins. */
const LIST_KEYS: SyncKey[] = ['asm:customSounds', 'asm:customTemplates'];

const PROD_API = 'https://ambient-sound-mixer-lake.vercel.app/api/sync';
const SYNC_API =
  (import.meta.env.VITE_SYNC_API as string | undefined) ?? (location.hostname.endsWith('.vercel.app') ? '/api/sync' : PROD_API);
export const SYNC_SITE = 'https://ambient-sound-mixer-lake.vercel.app/';

// ---------- Codes ----------
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32 (no I, L, O, U)
const CODE_LEN = 20;

export function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LEN));
  return Array.from(bytes, (b) => ALPHABET[b & 31]).join('');
}

/** Accepts any spacing/dashes/case and the usual look-alikes; returns null if it isn't a code. */
export function normalizeCode(input: string): string | null {
  const s = input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  return s.length === CODE_LEN && [...s].every((c) => ALPHABET.includes(c)) ? s : null;
}

export const formatCode = (code: string) => code.match(/.{1,4}/g)!.join('-');
export const syncLink = (code: string) => `${SYNC_SITE}#sync=${formatCode(code)}`;

// ---------- Crypto ----------
const enc = new TextEncoder();
const dec = new TextDecoder();

async function sha256(text: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
function toB64(b: Uint8Array) {
  let s = '';
  b.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s);
}
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

interface Keys {
  id: string;
  key: CryptoKey;
}
async function deriveKeys(code: string): Promise<Keys> {
  const id = hex(await sha256(`ambient-sound-mixer:sync-id:${code}`));
  const raw = await sha256(`ambient-sound-mixer:sync-key:${code}`);
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  return { id, key };
}

async function encrypt(keys: Keys, data: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keys.key, enc.encode(JSON.stringify(data))));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return toB64(out);
}

async function decrypt<T>(keys: Keys, blob: string): Promise<T> {
  const bytes = fromB64(blob);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, keys.key, bytes.slice(12));
  return JSON.parse(dec.decode(plain)) as T;
}

// ---------- Local bookkeeping ----------
interface Doc {
  v: 1;
  values: Partial<Record<SyncKey, unknown>>;
  /** When each value last changed (ms). */
  ts: Partial<Record<SyncKey, number>>;
}

export interface SyncMeta {
  code: string;
  rev: number;
  ts: Partial<Record<SyncKey, number>>;
  lastSync: number | null;
}

const META_KEY = 'asm:syncMeta'; // device-local, never synced
export const readMeta = () => storage.get<SyncMeta>(META_KEY) ?? null;
export const writeMeta = (m: SyncMeta | null) => (m ? storage.set(META_KEY, m) : storage.remove(META_KEY));

function localDoc(meta: SyncMeta): Doc {
  const values: Doc['values'] = {};
  for (const k of SYNC_KEYS) {
    const v = storage.get(k);
    if (v !== undefined) values[k] = v;
  }
  return { v: 1, values, ts: { ...meta.ts } };
}

function unionById(local: unknown, remote: unknown) {
  const a = Array.isArray(local) ? local : [];
  const b = Array.isArray(remote) ? remote : [];
  const ids = new Set(b.map((x: any) => x?.id));
  return [...b, ...a.filter((x: any) => !ids.has(x?.id))];
}

/**
 * Merge a remote doc into this device. Newer value wins per key. On the very
 * first sync of a joining device, personal lists are combined instead.
 * Returns true if this device still has something newer than the cloud.
 */
function merge(meta: SyncMeta, remote: Doc, joining: boolean) {
  let localNewer = false;
  for (const k of SYNC_KEYS) {
    const rTs = remote.ts[k] ?? 0;
    const lTs = meta.ts[k] ?? 0;
    const hasRemote = k in remote.values;
    if (joining && LIST_KEYS.includes(k) && hasRemote) {
      const merged = unionById(storage.get(k), remote.values[k]);
      applyRemote(k, merged);
      const grew = merged.length > (Array.isArray(remote.values[k]) ? (remote.values[k] as unknown[]).length : 0);
      meta.ts[k] = grew ? Date.now() : rTs;
      if (grew) localNewer = true;
      continue;
    }
    if (hasRemote && rTs > lTs) {
      applyRemote(k, remote.values[k]);
      meta.ts[k] = rTs;
    } else if (lTs > rTs) {
      localNewer = true;
    }
  }
  return localNewer;
}

// ---------- Server calls ----------
export class SyncError extends Error {
  constructor(public code: 'notConfigured' | 'network' | 'server' | 'badData' | 'notFound' | 'deleted') {
    super(code);
  }
}

async function call(method: string, query: string, body?: unknown) {
  let res: Response;
  try {
    res = await fetch(`${SYNC_API}${query}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new SyncError('network');
  }
  const data: any = await res.json().catch(() => ({}));
  if (res.status === 503 && data?.reason === 'notConfigured') throw new SyncError('notConfigured');
  if (res.status >= 500) throw new SyncError('server');
  return { status: res.status, data };
}

// ---------- The engine ----------
export type SyncStatus = 'off' | 'syncing' | 'ok' | 'error';

/**
 * One full round: pull, merge, and push if this device has newer changes.
 * `joining` is true for the first sync after entering an existing code.
 */
export async function syncOnce(joining = false): Promise<SyncMeta | null> {
  const meta = readMeta();
  if (!meta) return null;
  // Changes made after this moment are picked up by the next round.
  const started = Date.now();
  const keys = await deriveKeys(meta.code);

  const pulled = await call('GET', `?id=${keys.id}${meta.rev && !joining ? `&rev=${meta.rev}` : ''}`);
  let push = false;
  if (pulled.status === 200 && !pulled.data.unchanged) {
    let remote: Doc;
    try {
      remote = await decrypt<Doc>(keys, pulled.data.blob);
    } catch {
      throw new SyncError('badData');
    }
    push = merge(meta, remote, joining);
    meta.rev = pulled.data.rev;
  } else if (pulled.status === 404) {
    // Joining a code nobody has used: almost certainly a typo — don't create a new space.
    if (joining) throw new SyncError('notFound');
    // We synced before and now it's gone: another device deleted the cloud copy.
    // Stop here instead of quietly re-creating it.
    if (meta.rev > 0) {
      writeMeta(null);
      throw new SyncError('deleted');
    }
    // Nothing in the cloud yet: this device's data becomes the first copy.
    for (const k of SYNC_KEYS) meta.ts[k] ??= started - 1;
    meta.rev = 0;
    push = true;
  } else if (pulled.status === 200) {
    push = SYNC_KEYS.some((k) => (meta.ts[k] ?? 0) > (meta.lastSync ?? 0));
  }

  for (let attempt = 0; push && attempt < 3; attempt++) {
    const blob = await encrypt(keys, localDoc(meta));
    const put = await call('PUT', '', { id: keys.id, baseRev: meta.rev, blob });
    if (put.status === 200) {
      meta.rev = put.data.rev;
      push = false;
    } else if (put.status === 409 && put.data.blob) {
      // Another device wrote meanwhile: merge its copy and try again.
      const remote = await decrypt<Doc>(keys, put.data.blob).catch(() => null);
      if (!remote) throw new SyncError('badData');
      push = merge(meta, remote, false);
      meta.rev = put.data.rev;
    } else {
      throw new SyncError('server');
    }
  }

  // The user may have changed something (or unlinked) while we were talking to
  // the server: keep their newer timestamps, and don't resurrect an unlinked code.
  const latest = readMeta();
  if (!latest || latest.code !== meta.code) return latest;
  for (const k of SYNC_KEYS) meta.ts[k] = Math.max(meta.ts[k] ?? 0, latest.ts[k] ?? 0) || undefined;
  meta.lastSync = started;
  writeMeta(meta);
  return meta;
}

/** Record that the user changed a synced value on this device. */
export function markChanged(key: SyncKey) {
  const meta = readMeta();
  if (!meta) return;
  meta.ts[key] = Date.now();
  writeMeta(meta);
}

/** Remove this sync code's data from the cloud (other devices keep their local copy). */
export async function deleteCloudCopy(code: string) {
  const keys = await deriveKeys(code);
  await call('DELETE', `?id=${keys.id}`);
}

/** Reads #sync=CODE from the URL. */
export function readSyncLink(hash = location.hash) {
  const m = /[#&]sync=([\w-]+)/.exec(hash);
  return m ? normalizeCode(m[1]) : null;
}
