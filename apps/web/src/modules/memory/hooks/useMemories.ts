import { useEffect, useState } from 'react';
import type { Database } from '@ai-brain/database';
import { supabase } from '@/shared/lib/supabase';

type Memory = Database['public']['Tables']['memories']['Row'];

const INTENT_COLORS: Record<string, string> = {
  reminder: 'bg-amber-500/20 text-amber-400',
  memory: 'bg-indigo-500/20 text-indigo-400',
  task: 'bg-emerald-500/20 text-emerald-400',
  idea: 'bg-purple-500/20 text-purple-400',
  preference: 'bg-pink-500/20 text-pink-400',
  meeting: 'bg-blue-500/20 text-blue-400',
  shopping: 'bg-teal-500/20 text-teal-400',
  decision: 'bg-red-500/20 text-red-400',
  approval: 'bg-green-500/20 text-green-400',
};

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
