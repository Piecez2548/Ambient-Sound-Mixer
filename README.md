# Ambient Sound Mixer

Mix ambient sounds pulled from YouTube (rain, thunder, cafe, waves, forest…), set a volume for each sound plus a master volume, and set a sleep timer (it fades out over the last 30 seconds). Runs on the web and as a Windows app.

- **Web:** https://ambient-sound-mixer-lake.vercel.app (Vercel auto-deploys from `main`)
- **Windows:** download the installer from [Releases](https://github.com/Piecez2548/Ambient-Sound-Mixer/releases/latest). The app updates itself when a new release is published.

## Development

```bash
npm install
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Web at http://localhost:5173 |
| `npm run electron:dev` | Electron + hot reload |
| `npm run electron` | Build, then open Electron (production mode) |
| `npm run dist` | Package a Windows installer into `release/` |

You don't need an API key locally: the app calls the search API on the production deployment.

## How it works

- **Each sound** has a search query (`src/data/sounds.ts`). The app asks `api/search` for long, embeddable videos, picks the first result, and plays it in a hidden YouTube IFrame Player, one player per sound, looping forever.
- **Built-in videos**: every sound and template card ships a default video (`DEFAULT_VIDEOS` / `imageVideoId`), so normal use spends no search quota. Searching is only needed for new videos.
- **Share**: the Share button copies a link with the whole mix packed into the URL hash (`#mix=…`: sounds, volumes, master, chosen videos, YouTube-added sounds). Opening it loads the mix paused. There's no server or database involved (`src/lib/share.ts`).
- **Focus timer** (Pomodoro): focus and break blocks with their own lengths and mixes. The mix switches and a soft Web Audio chime plays at each change, with a desktop notification if allowed (`src/state/useRoutines.ts`).
- **Wake-up alarm**: plays a chosen mix at a set time, fading in from silence over N minutes, once or every day. It needs the page (or the Windows app) running and the device awake. It still rings up to 30 minutes late if the device was asleep or the tab was throttled.
- **Natural variation** (✨ chip): each sound's volume drifts gently below its set level along two slow sine waves (periods of 11–80 s, seeded by the sound id). Thunder and wind swing the most. The slider's bright part shows the live level.
- **Thai / English**: everything is translated (`src/i18n.tsx`), including sound and template names and the Windows tray menu and close dialog. Thai is the default when the browser language is Thai or the timezone is Asia/Bangkok, English otherwise. Switch with ไทย / EN in the title bar; the choice is remembered.
- **Cloud sync** (cloud button in the title bar): no accounts. One device turns sync on and gets a 20-character sync code (about 100 bits); other devices enter it, or scan the QR code or open the link (`#sync=…`, which asks before connecting). The code never leaves the devices. From it the browser derives an id (SHA-256) and an AES-GCM key, so `api/sync.ts` only stores ciphertext under a hash, in Upstash Redis. Each setting carries its last-change time and the newer one wins; when a device joins, personal templates and YouTube sounds are combined. Writes are compare-and-set on a revision number, so two devices can't overwrite each other. Syncs the current mix and volumes, templates, YouTube sounds, chosen videos, focus/alarm settings, natural variation and language. Play/pause stays per device. Pushes 1.5 s after a change and checks every 45 s while visible and on focus. Joining an unknown code is refused rather than creating a new space. If one device deletes the cloud copy, the others notice and stop syncing.
- **Now playing**: each sound row shows the channel and video it's playing; click it to open the video on YouTube.
- **Installable (PWA)**: `public/manifest.webmanifest` + `public/sw.js` (network-first app-shell cache; never caches `/api/`). On a phone: browser menu → *Add to Home screen* / *Install app*. The service worker isn't registered in Electron or the dev server.
- **`api/search.ts`** is a Vercel Function that holds the YouTube Data API key (`YOUTUBE_API_KEY` in the Vercel project's Environment Variables, as a Secret. Vercel won't store `VITE_`-prefixed names as secrets). Vercel's CDN caches each query for 7 days, so all visitors share one result and the free quota (10,000 units/day, 100 per search) goes much further. Requests from websites other than this app are refused.
- If a video won't play (the owner blocks embedding, error 101/150), the app skips to the next search result automatically.
- **Click a sound's icon** in the left panel to choose a different video, or search for a new one.
- **Create your own**: add sounds from the library, search YouTube and add any video as a sound, or save the current mix as your own template.
- Each browser also caches results in localStorage (7 days; 30 days for card images).

### Windows app (Electron)

- Loads the app through a local server at `http://127.0.0.1:47821` instead of `file://`, because YouTube embeds won't play without a Referer.
- The first time you close the window it asks: **Keep playing in tray** (sounds continue from the tray icon) or **Quit**. The answer is remembered (`closeAction` in `settings.json` in the app's userData folder). Change it from the tray menu's *Keep playing when the window is closed* checkbox. The tray menu also has Play/Pause, **Start with Windows** (starts hidden in the tray), and Quit.
- **Ctrl+Alt+P** toggles play/pause from anywhere, even while the window is hidden. If another app already uses that shortcut, it's skipped silently.
- Checks GitHub Releases on startup and installs updates automatically (`electron-updater`).
- The installer isn't code-signed, so Windows SmartScreen shows "Windows protected your PC" the first time: click **More info → Run anyway**.

## Checking the built-in videos

YouTube videos disappear or get embedding turned off. `npm run check:videos` checks every built-in sound video and template cover without an API key: oEmbed for existence and embedding, plus the watch page's player status for sound videos. It exits 1 if anything is broken.

The **Check built-in videos** GitHub workflow runs it every Monday at 02:00 UTC, whenever the data files change, and on demand from the Actions tab. If something breaks, it opens an issue labelled `broken-video`, which GitHub emails to you. It updates that issue on later runs and closes it once everything works again. YouTube walls GitHub's servers off from watch pages, so the weekly run relies on oEmbed alone. Run `npm run check:videos` locally for the full check, which also catches ended live streams and age gates.

## Releasing a new version

1. Bump `version` in `package.json`.
2. Run `npm run dist`.
3. Create a GitHub release tagged `v<version>` and upload the `.exe`, `.exe.blockmap` and `latest.yml` files from `release/`. Installed apps pick it up on their next launch.

## Cloud sync storage

Vercel project → **Storage** → **Create Database** → **Upstash for Redis** (free plan) → connect it to this project. That adds `KV_REST_API_URL` / `KV_REST_API_TOKEN`, which `api/sync.ts` reads (`UPSTASH_REDIS_REST_URL` / `_TOKEN` also work). Redeploy afterwards. Without them the sync endpoint answers 503 and the app says cloud sync isn't set up.

## API key restrictions

In Google Cloud Console → Credentials:
- API restrictions: YouTube Data API v3
- Website restrictions: `https://ambient-sound-mixer-lake.vercel.app/*` only. The function sends this as its Referer; the browser never calls Google directly.
