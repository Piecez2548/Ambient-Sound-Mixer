import {
  AudioWaveform,
  Bird,
  BookOpen,
  Building2,
  CloudLightning,
  CloudRain,
  Coffee,
  Droplets,
  Flame,
  Keyboard,
  Moon,
  Music,
  TrainFront,
  Trees,
  Waves,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import type { VideoResult } from '../lib/youtube';

export interface SoundDef {
  id: string;
  name: string;
  category: string;
  /** YouTube search query used to find the video for this sound. */
  query: string;
  icon: LucideIcon;
  color: string;
  /** Set for sounds the user added straight from a YouTube search. */
  video?: VideoResult;
  /** Built-in pick so the sound plays without spending search quota. */
  defaultVideo?: VideoResult;
}

const yt = (id: string, title: string, channel: string): VideoResult => ({
  id,
  title,
  channel,
  thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
});

// Picked from real search results (2026-11-20). If one stops embedding, the
// app falls back to searching with the sound's query.
const DEFAULT_VIDEOS: Record<string, VideoResult> = {
  rain: yt('vVUbF6ZRi_U', '"Rain Sounds" with No Music 10hrs "Sleep Sounds" ASMR', 'TexasHighDef'),
  thunder: yt('ekXFslHOvZ8', '10 Hours Rain & Thunder | Rainstorm Sounds for Sleep, Studying or Relaxation', 'Relaxing White Noise'),
  cafe: yt('qU8o3_T5y5M', 'ASMR Coffee Shop Sound | NO MUSIC | Coffee Shop Ambience for Study and Better Focus', 'Ambience For You'),
  wind: yt('Y72WPpPc_Lw', 'HOWLING WIND Sounds for Sleeping 2 | Relax | Study | BLACK SCREEN', 'Outdoor Therapy'),
  campfire: yt('UgHKb_7884o', '12 HOURS of Relaxing Fireplace Sounds - Crackling Fire Sounds (NO MUSIC)', 'Cat Trumpet'),
  fireplace: yt('ZiG_HADnqQk', 'Late Night Fireplace 4K - Cozy Burning Wood & Crackling Fire Sounds (No Music)', 'Royal Fireplace 4K'),
  train: yt('igqh1jLMe64', 'Rural Summer Train Ride in Hiroshima / 8K 60fps HDR / Natural Ambience (No Music)', 'Abao Ambience'),
  waves: yt('vPhg6sc1Mk4', 'The Most Relaxing Waves Ever - Ocean Sounds to Sleep, Study and Chill', 'Naturaleza Viva'),
  forest: yt('29XymHesxa0', 'Forest River Nature Sounds - Gentle Stream with Birdsong', 'Naturescapes'),
  birds: yt('OyYZlLTGYoQ', 'Morning Bird Sounds | Real Bird Chirping for Relaxation, Meditation, Focus & Deep Sleep', "Nature's symphony"),
  stream: yt('1wn-OSiNVjE', 'Forest Stream Sounds, Gentle Bird Song, Relaxing Nature Sounds', 'Streaming Birds'),
  // Added 2026-11-21.
  library: yt('camuymDbXhY', 'Library Sounds | 10 Hours of Quiet Page Turns for Study & Sleep', 'Hushloop'),
  night: yt('7GoXVDH656g', 'Night Time Summer Nature Sounds, Cricket Conversations For Sleeping 12 Hours', 'Jason Stephenson - Guided Sleep Meditation'),
  typing: yt('rRhXkyEW82g', '1 HOUR STUDY WITH ME ☁️ Typing Keyboard Sounds ASMR - No Music [Study Ambience] - No breaks', 'Kittys Desk'),
  city: yt('ebAKJA3nSFw', 'City Sounds - 10 HOURS | for Relaxing Sleep, Meditation, Yoga or Study - City Ambience', 'Pure Relaxing Vibes'),
  'white-noise': yt('nMfPqeZjc2c', 'White Noise Black Screen | Sleep, Study, Focus | 10 Hours', 'Relaxing White Noise'),
  'brown-noise': yt('GrwTSN2Saak', 'Deep Layered Brown Noise ( 10 Hours )', 'crysknife007'),
};

export interface CustomSound {
  id: string;
  name: string;
  video: VideoResult;
}

export const SOUNDS: SoundDef[] = [
  { id: 'rain', name: 'Rain', category: 'Nature', query: 'rain sounds for sleeping no music 10 hours', icon: CloudRain, color: '#7dd3fc' },
  { id: 'thunder', name: 'Thunder', category: 'Nature', query: 'thunderstorm sounds no music 10 hours', icon: CloudLightning, color: '#a5b4fc' },
  { id: 'cafe', name: 'Cafe', category: 'Urban', query: 'coffee shop ambience background noise no music', icon: Coffee, color: '#fcd34d' },
  { id: 'wind', name: 'Wind', category: 'Nature', query: 'wind blowing sounds for sleeping', icon: Wind, color: '#5eead4' },
  { id: 'campfire', name: 'Camp', category: 'Nature', query: 'crackling campfire sounds night no music', icon: Flame, color: '#fb923c' },
  { id: 'waves', name: 'Waves', category: 'Water', query: 'ocean waves sounds no music 10 hours', icon: Waves, color: '#38bdf8' },
  { id: 'forest', name: 'Forest', category: 'Nature', query: 'forest ambience birds sounds no music', icon: Trees, color: '#86efac' },
  { id: 'stream', name: 'Stream', category: 'Water', query: 'gentle stream water sounds no music', icon: Droplets, color: '#67e8f9' },
  { id: 'birds', name: 'Birds', category: 'Nature', query: 'morning birds singing sounds no music', icon: Bird, color: '#bef264' },
  { id: 'night', name: 'Night', category: 'Nature', query: 'night crickets sounds ambience no music', icon: Moon, color: '#c4b5fd' },
  { id: 'fireplace', name: 'Fireplace', category: 'Indoor', query: 'crackling fireplace sounds no music', icon: Flame, color: '#f97316' },
  { id: 'library', name: 'Library', category: 'Indoor', query: 'library ambience quiet page turning sounds', icon: BookOpen, color: '#e9d5ff' },
  { id: 'typing', name: 'Typing', category: 'Indoor', query: 'keyboard typing sounds ambience', icon: Keyboard, color: '#cbd5e1' },
  { id: 'train', name: 'Train', category: 'Urban', query: 'train ride sounds ambience no music', icon: TrainFront, color: '#fda4af' },
  { id: 'city', name: 'City', category: 'Urban', query: 'city street ambience sounds no music', icon: Building2, color: '#94a3b8' },
  { id: 'white-noise', name: 'White Noise', category: 'Noise', query: 'white noise 10 hours', icon: AudioWaveform, color: '#f1f5f9' },
  { id: 'brown-noise', name: 'Brown Noise', category: 'Noise', query: 'brown noise 10 hours', icon: AudioWaveform, color: '#d6a77a' },
].map((s) => ({ ...s, defaultVideo: DEFAULT_VIDEOS[s.id] }));

export function customToDef(c: CustomSound): SoundDef {
  return { id: c.id, name: c.name, category: 'YouTube', query: c.video.title, icon: Music, color: '#f87171', video: c.video };
}

export const DEFAULT_MIX = [
  { id: 'rain', volume: 55 },
  { id: 'thunder', volume: 40 },
  { id: 'cafe', volume: 45 },
  { id: 'wind', volume: 45 },
  { id: 'campfire', volume: 45 },
];
