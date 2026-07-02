import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '@/shared/lib/api';

export interface ReminderItem {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: string;
  timezone: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'scheduled' | 'sent' | 'cancelled' | 'failed';
  memoryId: string | null;
  createdAt: string;
}

export function useReminders() {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { reminders: data } = await apiJson<{ reminders: ReminderItem[] }>('/reminders');
      setReminders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reminders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReminders();
  }, [fetchReminders]);

  const cancel = async (reminderId: string) => {
    const { reminder } = await apiJson<{ reminder: ReminderItem }>(`/reminders/${reminderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled' }),
    });
    setReminders((prev) => prev.map((r) => (r.id === reminderId ? reminder : r)));
  };

  const snooze = async (reminderId: string, hours: number) => {
    const scheduledAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    const { reminder } = await apiJson<{ reminder: ReminderItem }>(`/reminders/${reminderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ scheduledAt }),
    });
    setReminders((prev) => prev.map((r) => (r.id === reminderId ? reminder : r)));
  };

  return { reminders, loading, error, refetch: fetchReminders, cancel, snooze };
}
