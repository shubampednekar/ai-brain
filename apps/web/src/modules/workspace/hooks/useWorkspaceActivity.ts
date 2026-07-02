import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '@/shared/lib/api';

export interface ActivityItem {
  id: string;
  type:
    | 'memory_captured'
    | 'task_created'
    | 'question_escalated'
    | 'question_resolved'
    | 'member_joined'
    | 'invitation_sent';
  actorName: string;
  summary: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export function useWorkspaceActivity(workspaceId: string | null) {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    if (!workspaceId) {
      setActivity([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { activity: data } = await apiJson<{ activity: ActivityItem[] }>(
        `/workspaces/${workspaceId}/activity`,
      );
      setActivity(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void fetchActivity();
  }, [fetchActivity]);

  return { activity, loading, error, refetch: fetchActivity };
}
