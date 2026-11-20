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
- **`api/search.ts`** is a Vercel Function that holds the YouTube Data API key (`YOUTUBE_API_KEY` or `VITE_YOUTUBE_API_KEY` in the Vercel project's Environment Variables). Vercel's CDN caches each query for 7 days, so all visitors share one result and the free quota (10,000 units/day, 100 per search) goes much further. Requests from websites other than this app are refused.
- If a video won't play (the owner blocks embedding, error 101/150), the app skips to the next search result automatically.
- **Click a sound's icon** in the left panel to choose a different video, or search for a new one.
- **Create your own**: add sounds from the library, search YouTube and add any video as a sound, or save the current mix as your own template.
- Each browser also caches results in localStorage (7 days; 30 days for card images).

### Windows app (Electron)

- Loads the app through a local server at `http://127.0.0.1:47821` instead of `file://`, because YouTube embeds won't play without a Referer.
- Closing the window keeps it running in the system tray, so sounds keep playing. The tray menu has Play/Pause, **Start with Windows** (starts hidden in the tray), and Quit.
- Checks GitHub Releases on startup and installs updates automatically (`electron-updater`).
- The installer isn't code-signed, so Windows SmartScreen shows "Windows protected your PC" the first time: click **More info → Run anyway**.

## Releasing a new version

1. Bump `version` in `package.json`.
2. Run `npm run dist`.
3. Create a GitHub release tagged `v<version>` and upload the `.exe`, `.exe.blockmap` and `latest.yml` files from `release/`. Installed apps pick it up on their next launch.

## API key restrictions

In Google Cloud Console → Credentials:
- API restrictions: YouTube Data API v3
- Website restrictions: `https://ambient-sound-mixer-lake.vercel.app/*`. The function sends this as its Referer. You can remove the old localhost / 127.0.0.1 entries; the browser no longer calls Google directly.
