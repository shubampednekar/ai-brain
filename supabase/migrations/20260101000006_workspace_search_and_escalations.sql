-- Workspace-wide memory search (all members' shared memories) for collaborative Q&A

CREATE OR REPLACE FUNCTION search_workspace_memories(
  p_workspace_id UUID,
  p_query TEXT,
  p_query_embedding vector(1536) DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  original_text TEXT,
  summary TEXT,
  intent_slug TEXT,
  similarity REAL,
  text_rank REAL,
  combined_score REAL,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.user_id,
    m.original_text,
    m.summary,
    m.intent_slug,
    CASE WHEN p_query_embedding IS NOT NULL AND m.embedding IS NOT NULL
      THEN (1 - (m.embedding <=> p_query_embedding))::REAL
      ELSE 0::REAL
    END AS similarity,
    ts_rank(to_tsvector('english', m.original_text), plainto_tsquery('english', p_query))::REAL AS text_rank,
    (
      COALESCE(CASE WHEN p_query_embedding IS NOT NULL AND m.embedding IS NOT NULL
        THEN ((1 - (m.embedding <=> p_query_embedding)) * 0.8)::REAL
        ELSE 0::REAL END, 0) +
      COALESCE((ts_rank(to_tsvector('english', m.original_text), plainto_tsquery('english', p_query)) * 0.2)::REAL, 0)
    )::REAL AS combined_score,
    m.created_at
  FROM memories m
  WHERE m.is_active = true
    AND m.workspace_id = p_workspace_id
    AND m.visibility = 'shared'
    AND (
      p_query_embedding IS NULL
      OR m.embedding IS NOT NULL
      OR to_tsvector('english', m.original_text) @@ plainto_tsquery('english', p_query)
    )
  ORDER BY combined_score DESC, m.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
