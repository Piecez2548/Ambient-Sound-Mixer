#!/usr/bin/env node
// Checks every built-in YouTube video the app relies on, without an API key
// or quota: YouTube's public oEmbed endpoint answers
//   200 → public and embeddable, 401 → embedding disabled, 403/404 → private or removed.
// Sound videos that pass are also checked against the watch page's player status.
//
// Sound videos must be embeddable (they play in the hidden player). Template
// covers only show the thumbnail, so they just need to still exist.
//
// Usage: node scripts/check-videos.mjs [--report report.md] [--extra id1,id2]
//   --report  also write a Markdown report (used by the weekly GitHub workflow)
//   --extra   check extra sound video IDs too (to test the failure path)
// Exit code: 0 all fine, 1 something is broken, 2 the check itself failed.
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

function readSounds() {
  const src = readFileSync(join(root, 'src/data/sounds.ts'), 'utf8');
  const out = [];
  // e.g.  rain: yt('vVUbF6ZRi_U', '"Rain Sounds" …', 'TexasHighDef'),
  const re = /^\s*'?([\w-]+)'?:\s*yt\('([\w-]{11})',\s*(['"])(.*?)\3/gm;
  for (const m of src.matchAll(re)) out.push({ kind: 'sound', name: m[1], id: m[2], title: m[4] });
  return out;
}

function readCovers() {
  const src = readFileSync(join(root, 'src/data/templates.ts'), 'utf8');
  const out = [];
  // Each template object: title: '…' … imageVideoId: '…'
  const re = /title:\s*'([^']+)'[\s\S]*?imageVideoId:\s*'([\w-]{11})'/g;
  for (const m of src.matchAll(re)) out.push({ kind: 'cover', name: m[1], id: m[2], title: '' });
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe(id) {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'ambient-sound-mixer-video-check' } });
      if ([200, 401, 403, 404].includes(res.status)) {
        let title = '';
        if (res.ok) title = (await res.json()).title ?? '';
        return { status: res.status, title };
      }
      // 429 / 5xx: back off and retry.
    } catch {
      /* network hiccup — retry */
    }
    await sleep(1500 * attempt);
  }
  return { status: 0, title: '' }; // unknown
}

// oEmbed can say 200 for videos the player still refuses (an ended live
// stream, age restriction…). The watch page carries the player's own verdict.
// If YouTube serves a consent or bot-check page instead, we learn nothing and
// rely on oEmbed alone.
async function playability(id) {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${id}&hl=en`, {
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'accept-language': 'en-US,en;q=0.9' },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = /"playabilityStatus":\{"status":"([A-Z_]+)"(?:,"reason":"([^"]*)")?/.exec(html);
    const embed = /"playableInEmbed":(true|false)/.exec(html)?.[1];
    if (!m) return null;
    let status = m[1];
    // Datacenter IPs (GitHub Actions) get "Sign in to confirm you're not a bot",
    // which is also LOGIN_REQUIRED. Only an age gate makes the video itself bad.
    if (status === 'LOGIN_REQUIRED' && !/age|inappropriate/i.test(m[2] ?? '')) return null;
    return { status, embeddable: embed !== 'false' };
  } catch {
    return null;
  }
}

function verdict(kind, status) {
  if (status === 0) return 'unknown';
  if (status === 200) return 'ok';
  if (status === 401) return kind === 'cover' ? 'ok' : 'broken'; // thumbnail still fine
  return 'broken';
}

const reason = (status) =>
  typeof status === 'string'
    ? status
    : ({ 401: 'embedding disabled by the owner', 403: 'private', 404: 'removed or private', 0: 'no answer from YouTube' })[status] ?? `HTTP ${status}`;

const PLAYER_PROBLEMS = {
  UNPLAYABLE: 'player says unplayable (e.g. an ended live stream or blocked region)',
  LOGIN_REQUIRED: 'age-restricted (sign-in required, cannot embed)',
  ERROR: 'player error (video unavailable)',
  LIVE_STREAM_OFFLINE: 'live stream is offline',
};

const items = [...readSounds(), ...readCovers()];
for (const id of (opt('--extra') ?? '').split(',').filter(Boolean)) items.push({ kind: 'sound', name: `extra-${id}`, id, title: '' });

const soundCount = items.filter((i) => i.kind === 'sound').length;
const coverCount = items.filter((i) => i.kind === 'cover').length;
if (soundCount < 10 || coverCount < 4) {
  console.error(`Parsed only ${soundCount} sound videos and ${coverCount} covers — did the data file format change?`);
  process.exit(2);
}

const results = [];
for (const item of items) {
  const { status, title } = await probe(item.id);
  results.push({ ...item, status, verdict: verdict(item.kind, status), liveTitle: title });
  await sleep(150);
}

// Second opinion from the player for sound videos that passed oEmbed.
const playerChecked = [];
for (const r of results.filter((x) => x.kind === 'sound' && x.verdict === 'ok')) {
  const p = await playability(r.id);
  const problem = p && (PLAYER_PROBLEMS[p.status] ?? (p.embeddable ? null : reason(401)));
  playerChecked.push({ r, p, problem });
  await sleep(150);
}
const flagged = playerChecked.filter((x) => x.problem);
// Real breakage hits one or two videos; most of them at once means YouTube is
// walling this network, not that the videos changed — ignore the player check then.
let playerNote = '';
if (flagged.length > Math.max(2, playerChecked.length / 2)) {
  playerNote = `Player check skipped: YouTube refused it for ${flagged.length}/${playerChecked.length} videos from this network (bot check), so only oEmbed results count.`;
  console.log(playerNote);
} else {
  for (const { r, problem } of flagged) (r.status = problem), (r.verdict = 'broken');
}
const playerOk = playerChecked.filter((x) => x.p).length;
console.log(`Player check answered for ${playerOk}/${playerChecked.length} sound videos.`);

const broken = results.filter((r) => r.verdict === 'broken');
const unknown = results.filter((r) => r.verdict === 'unknown');
for (const r of results) {
  const mark = r.verdict === 'ok' ? 'ok  ' : r.verdict === 'broken' ? 'FAIL' : '??  ';
  console.log(`${mark} ${r.kind.padEnd(5)} ${r.name.padEnd(24)} ${r.id}  ${r.verdict === 'ok' ? '' : reason(r.status)}`);
}
console.log(`\n${results.length} checked: ${results.length - broken.length - unknown.length} ok, ${broken.length} broken, ${unknown.length} unknown`);

const report = opt('--report');
if (report) {
  const link = (id) => `[\`${id}\`](https://www.youtube.com/watch?v=${id})`;
  const lines = [];
  if (broken.length) {
    lines.push(`**${broken.length} built-in video${broken.length > 1 ? 's no longer work' : ' no longer works'}.** The app falls back to a YouTube search for these, which spends search quota, so replace them soon.`, '');
    lines.push('| Where | Name | Video | Problem |', '|---|---|---|---|');
    for (const r of broken) lines.push(`| ${r.kind === 'sound' ? '`src/data/sounds.ts` (DEFAULT_VIDEOS)' : '`src/data/templates.ts` (imageVideoId)'} | ${r.name} | ${link(r.id)} | ${reason(r.status)} |`);
    lines.push('', 'To fix: find a replacement video that is long, has no music and allows embedding, then swap the ID. Check it with `npm run check:videos`.');
  } else {
    lines.push('All built-in videos are working.');
  }
  if (playerNote) lines.push('', `_${playerNote}_`);
  if (unknown.length) lines.push('', `Couldn't check ${unknown.length} (YouTube didn't answer): ${unknown.map((r) => `${r.name} ${link(r.id)}`).join(', ')}`);
  lines.push('', `_Checked ${soundCount} sound videos and ${coverCount} template covers on ${new Date().toISOString().slice(0, 10)}._`);
  writeFileSync(report, lines.join('\n') + '\n');
}
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `broken=${broken.length}\n`);

process.exit(broken.length ? 1 : 0);
