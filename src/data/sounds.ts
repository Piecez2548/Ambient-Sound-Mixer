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
}

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
];

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
