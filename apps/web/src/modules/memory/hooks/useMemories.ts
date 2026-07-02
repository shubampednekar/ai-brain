import { useEffect, useState } from 'react';
import type { Database } from '@ai-brain/database';
import { supabase } from '@/shared/lib/supabase';
import { INTENT_COLORS } from '../constants';

type Memory = Database['public']['Tables']['memories']['Row'];

export function useMemories() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMemories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) setMemories(data);
    setLoading(false);
  };

  useEffect(() => {
    void fetchMemories();

    const channel = supabase
      .channel('memories')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'memories' },
        (payload) => {
          setMemories((prev) => [payload.new as Memory, ...prev]);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return { memories, loading, refetch: fetchMemories, intentColors: INTENT_COLORS };
}
