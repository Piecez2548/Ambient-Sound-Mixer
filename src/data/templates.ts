export const MOODS = ['Focus', 'Relax', 'Sleep', 'Study', 'Meditate'] as const;
export type Mood = (typeof MOODS)[number];

export interface MixEntry {
  id: string;
  volume: number;
}

export interface Template {
  id: string;
  title: string;
  description: string;
  moods: Mood[];
  sounds: MixEntry[];
  /** YouTube search used to find the card's cover image. */
  imageQuery: string;
  /** Fixed cover video (used by templates the user saved). */
  imageVideoId?: string;
  custom?: boolean;
}

export const TEMPLATES: Template[] = [
  {
    id: 'rainy-library-night',
    title: 'Rainy Library Night',
    description: 'Rain and distant thunder in a quiet library.',
    moods: ['Study', 'Focus', 'Sleep'],
    sounds: [
      { id: 'rain', volume: 65 },
      { id: 'thunder', volume: 30 },
      { id: 'library', volume: 35 },
      { id: 'wind', volume: 20 },
    ],
    imageQuery: 'rainy night library ambience',
  },
  {
    id: 'autumn-library-evening',
    title: 'Autumn Library Evening',
    description: 'Calm autumn winds and subtle indoor vibes.',
    moods: ['Study', 'Relax'],
    sounds: [
      { id: 'wind', volume: 50 },
      { id: 'library', volume: 45 },
      { id: 'fireplace', volume: 30 },
      { id: 'rain', volume: 20 },
    ],
    imageQuery: 'autumn library evening ambience',
  },
  {
    id: 'rainy-day-focus',
    title: 'Rainy Day Focus',
    description: 'Focus-friendly daylight rain and ambience.',
    moods: ['Focus', 'Study'],
    sounds: [
      { id: 'rain', volume: 60 },
      { id: 'cafe', volume: 25 },
      { id: 'wind', volume: 20 },
      { id: 'typing', volume: 20 },
    ],
    imageQuery: 'rainy day window study ambience',
  },
  {
    id: 'cozy-campfire',
    title: 'Cozy Campfire',
    description: 'Crackling wood fire and a soft night breeze.',
    moods: ['Relax', 'Sleep'],
    sounds: [
      { id: 'campfire', volume: 70 },
      { id: 'wind', volume: 30 },
      { id: 'night', volume: 35 },
      { id: 'forest', volume: 20 },
    ],
    imageQuery: 'cozy campfire night forest ambience',
  },
  {
    id: 'cafe-chill',
    title: 'Cafe Chill',
    description: 'Light chatter and gentle cafe background noise.',
    moods: ['Focus', 'Study', 'Relax'],
    sounds: [
      { id: 'cafe', volume: 70 },
      { id: 'rain', volume: 25 },
      { id: 'city', volume: 15 },
    ],
    imageQuery: 'cozy cafe ambience evening',
  },
  {
    id: 'midnight-train-ride',
    title: 'Midnight Train Ride',
    description: 'A peaceful train journey through a rainy night.',
    moods: ['Sleep', 'Relax'],
    sounds: [
      { id: 'train', volume: 70 },
      { id: 'rain', volume: 40 },
      { id: 'thunder', volume: 15 },
    ],
    imageQuery: 'night train ride rain ambience',
  },
  {
    id: 'ocean-meditation',
    title: 'Ocean Meditation',
    description: 'Slow waves rolling onto a calm, breezy shore.',
    moods: ['Meditate', 'Sleep', 'Relax'],
    sounds: [
      { id: 'waves', volume: 70 },
      { id: 'wind', volume: 20 },
      { id: 'birds', volume: 10 },
    ],
    imageQuery: 'calm ocean beach waves ambience',
  },
  {
    id: 'forest-morning',
    title: 'Forest Morning',
    description: 'Birdsong and a trickling stream at sunrise.',
    moods: ['Meditate', 'Focus', 'Relax'],
    sounds: [
      { id: 'forest', volume: 55 },
      { id: 'birds', volume: 40 },
      { id: 'stream', volume: 40 },
    ],
    imageQuery: 'forest morning stream birds ambience',
  },
];
