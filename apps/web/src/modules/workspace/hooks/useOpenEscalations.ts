import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '@/shared/lib/api';

export interface OpenEscalation {
  id: string;
  workspaceId: string;
  workspaceName: string;
  askerName: string;
  question: string;
  confidence: number | null;
  createdAt: string;
}

export function useOpenEscalations() {
  const [escalations, setEscalations] = useState<OpenEscalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEscalations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { escalations: data } = await apiJson<{ escalations: OpenEscalation[] }>('/escalations');
      setEscalations(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load escalations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEscalations();
  }, [fetchEscalations]);

  return { escalations, loading, error, refetch: fetchEscalations };
}
