import { useCallback, useState } from 'react';
import { searchVideos, type Duration, type VideoResult } from '../lib/youtube';

export function useYouTubeSearch() {
  const [results, setResults] = useState<VideoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (query: string, duration: Duration = 'long') => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResults(await searchVideos(query, { duration, maxResults: 15 }));
    } catch (e) {
      setError((e as Error).message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, run };
}
