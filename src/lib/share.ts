// Share a mix as a link: the whole mix is packed into the URL hash, so it needs
// no server and the link keeps working forever.
//   #mix=<base64url JSON>   { v: 1, m: master, s: [[soundId, volume, videoId?, title?]] }
// videoId is only included when the sound uses a video other than its built-in
// one; title only for sounds added straight from a YouTube search (yt-…).

export interface SharedSound {
  id: string;
  volume: number;
  videoId?: string;
  title?: string;
}
export interface SharedMix {
  master: number;
  sounds: SharedSound[];
}

const SITE = 'https://ambient-sound-mixer-lake.vercel.app/';
const VIDEO_ID = /^[\w-]{11}$/;
const SOUND_ID = /^[a-z0-9-]{1,40}$/i;
const MAX_SOUNDS = 30;

const clamp = (n: unknown) => Math.min(100, Math.max(0, Math.round(Number(n) || 0)));

function toBase64Url(text: string) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(data: string) {
  const bin = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Link to the public site, also when sharing from Electron or a dev server. */
export function buildShareUrl(mix: SharedMix) {
  const base = location.hostname.endsWith('.vercel.app') ? `${location.origin}/` : SITE;
  const s = mix.sounds.map((x) => {
    const row: (string | number)[] = [x.id, clamp(x.volume)];
    if (x.videoId || x.title) row.push(x.videoId ?? '');
    if (x.title) row.push(x.title.slice(0, 120));
    return row;
  });
  return `${base}#mix=${toBase64Url(JSON.stringify({ v: 1, m: clamp(mix.master), s }))}`;
}

/** Reads #mix=… from the current URL; returns null when absent or malformed. */
export function readSharedMix(hash = location.hash): SharedMix | null {
  const match = /[#&]mix=([\w-]+)/.exec(hash);
  if (!match) return null;
  try {
    const data = JSON.parse(fromBase64Url(match[1]));
    if (data?.v !== 1 || !Array.isArray(data.s)) return null;
    const sounds: SharedSound[] = [];
    for (const row of data.s.slice(0, MAX_SOUNDS)) {
      if (!Array.isArray(row) || typeof row[0] !== 'string' || !SOUND_ID.test(row[0])) continue;
      const videoId = typeof row[2] === 'string' && VIDEO_ID.test(row[2]) ? row[2] : undefined;
      const title = typeof row[3] === 'string' ? row[3].slice(0, 120) : undefined;
      if (sounds.some((s) => s.id === row[0])) continue;
      sounds.push({ id: row[0], volume: clamp(row[1]), videoId, title });
    }
    return sounds.length ? { master: clamp(data.m ?? 50), sounds } : null;
  } catch {
    return null;
  }
}
