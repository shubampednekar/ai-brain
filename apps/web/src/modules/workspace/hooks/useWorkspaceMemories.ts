import { useCallback, useEffect, useState } from 'react';
import type { Database } from '@ai-brain/database';
import { apiJson } from '@/shared/lib/api';

type Memory = Database['public']['Tables']['memories']['Row'];

export function useWorkspaceMemories(workspaceId: string | null) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMemories = useCallback(async () => {
    if (!workspaceId) {
      setMemories([]);
      return;
    }

    setLoading(true);
    try {
      const { memories: data } = await apiJson<{ memories: Memory[] }>(
        `/workspaces/${workspaceId}/memories`,
      );
      setMemories(data);
    } catch {
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void fetchMemories();
  }, [fetchMemories]);

  return { memories, loading, refetch: fetchMemories };
}
