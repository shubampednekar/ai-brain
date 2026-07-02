import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '@/shared/lib/api';

export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueAt: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  memoryId: string | null;
  createdAt: string;
}

export function useTasks(workspaceId?: string) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const path = workspaceId
        ? `/workspaces/${workspaceId}/tasks`
        : '/tasks';
      const { tasks: data } = await apiJson<{ tasks: TaskItem[] }>(path);
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const updateStatus = async (taskId: string, status: TaskItem['status']) => {
    const { task } = await apiJson<{ task: TaskItem }>(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setTasks((prev) => prev.map((t) => (t.id === taskId ? task : t)));
    return task;
  };

  return { tasks, loading, error, refetch: fetchTasks, updateStatus };
}
