import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '@/shared/lib/api';

export interface PreferenceMemory {
  id: string;
  originalText: string;
  summary: string | null;
  createdAt: string;
}

export interface PreferenceSettings {
  digestEnabled: boolean;
  digestHour: number;
}

export interface DigestUpdate {
  title: string;
  link: string;
  summary: string;
}

export interface DigestResearchItem {
  preference: string;
  memoryId: string;
  updates: DigestUpdate[];
}

export interface PreferenceDigestRun {
  id: string;
  runDate: string;
  researchResults: DigestResearchItem[];
  emailSentAt: string | null;
  createdAt: string;
}

export function usePreferences() {
  const [memories, setMemories] = useState<PreferenceMemory[]>([]);
  const [settings, setSettings] = useState<PreferenceSettings>({ digestEnabled: false, digestHour: 8 });
  const [latestDigest, setLatestDigest] = useState<PreferenceDigestRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<{
        memories: PreferenceMemory[];
        settings: PreferenceSettings;
        latestDigest: PreferenceDigestRun | null;
      }>('/preferences');
      setMemories(data.memories);
      setSettings(data.settings);
      setLatestDigest(data.latestDigest);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPreferences();
  }, [fetchPreferences]);

  const updateSettings = async (next: Partial<PreferenceSettings>) => {
    const { settings: updated } = await apiJson<{ settings: PreferenceSettings }>('/preferences/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        digestEnabled: next.digestEnabled,
        digestHour: next.digestHour,
      }),
    });
    setSettings(updated);
  };

  const runResearch = async () => {
    setResearching(true);
    setError(null);
    try {
      const data = await apiJson<{ sent: boolean; latestDigest: PreferenceDigestRun | null }>(
        '/preferences/research',
        { method: 'POST' },
      );
      setLatestDigest(data.latestDigest);
      if (!data.sent) {
        setError('No new research results found. Add preferences and ensure SERPER_API_KEY is configured.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research failed');
    } finally {
      setResearching(false);
    }
  };

  return {
    memories,
    settings,
    latestDigest,
    loading,
    researching,
    error,
    refetch: fetchPreferences,
    updateSettings,
    runResearch,
  };
}
