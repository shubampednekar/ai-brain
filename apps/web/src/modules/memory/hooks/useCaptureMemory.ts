import { useState } from 'react';
import type { Database } from '@ai-brain/database';
import { apiUrl, supabase } from '@/shared/lib/supabase';

type Memory = Database['public']['Tables']['memories']['Row'];

export function useCaptureMemory() {
  const [loading, setLoading] = useState(false);
  const [lastMemory, setLastMemory] = useState<Memory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const capture = async (text: string, workspaceId?: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${apiUrl}/capture-memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ text, workspaceId }),
      });

      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? 'Failed to capture memory');
      }

      const { memory } = await response.json() as { memory: Memory };
      setLastMemory(memory);
      return memory;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Capture failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { capture, loading, lastMemory, error };
}
