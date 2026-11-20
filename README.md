# Ambient Sound Mixer

Mix ambient sounds pulled from YouTube (rain, thunder, cafe, waves, forest…), set a volume for each sound plus a master volume, and set a sleep timer (it fades out over the last 30 seconds). Runs on the web and in Electron.

## Setup

1. `copy .env.example .env` and put your key in `VITE_YOUTUBE_API_KEY=`
2. `npm install`

| Command | Purpose |
| --- | --- |
| `npm run dev` | Web at http://localhost:5173 |
| `npm run electron:dev` | Electron + hot reload |
| `npm run electron` | Build, then open Electron (production mode) |
| `npm run dist` | Package a Windows installer into `release/` |

## How it works

- **Each sound** has a search query (`src/data/sounds.ts`). The app calls the YouTube Data API `search.list` (long, embeddable videos only), picks the first result, and plays it in a hidden IFrame Player, one player per sound, looping forever.
- If a video won't play (the owner blocks embedding, error 101/150), the app skips to the next search result automatically.
- **Click a sound's icon** in the left panel to choose a different video, or search for a new one.
- **Create your own**: add sounds from the library, search YouTube and add any video as a sound, or save the current mix as your own template.
- Search results are cached in localStorage for 7 days (30 days for card images), because each search uses 100 of your 10,000 free daily quota units.
- Electron loads the app through a local server at `http://127.0.0.1:47821` instead of `file://`, because YouTube embeds won't play without a Referer.

## API key restriction (recommended)

In Google Cloud Console → Credentials, set:
- API restrictions: YouTube Data API v3
- Website restrictions: `http://localhost:5173/*`, `http://127.0.0.1:47821/*` and `https://ambient-sound-mixer-lake.vercel.app/*`
