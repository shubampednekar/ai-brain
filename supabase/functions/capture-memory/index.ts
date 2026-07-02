import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createContainer } from 'npm:@ai-brain/core@0.1.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' },
        },
      },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json() as { text: string; workspaceId?: string };
    if (!body.text?.trim()) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const container = createContainer({
      SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY'),
      OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY'),
      GROQ_API_KEY: Deno.env.get('GROQ_API_KEY'),
      AI_PROVIDER: Deno.env.get('AI_PROVIDER'),
      EMBEDDING_PROVIDER: Deno.env.get('EMBEDDING_PROVIDER'),
    });

    const memory = await container.memory.capture({
      text: body.text.trim(),
      userId: user.id,
      workspaceId: body.workspaceId,
      visibility: body.workspaceId ? 'shared' : 'private',
    });

    return new Response(JSON.stringify({ memory }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
