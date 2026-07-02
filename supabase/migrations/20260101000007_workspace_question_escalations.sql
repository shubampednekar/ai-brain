-- Track open workspace question escalations for answer flow

CREATE TABLE workspace_question_escalations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES shared_workspaces(id) ON DELETE CASCADE,
  asker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  ai_answer TEXT,
  confidence REAL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_memory_id UUID REFERENCES memories(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_escalations_workspace ON workspace_question_escalations(workspace_id, status);
CREATE INDEX idx_workspace_escalations_target ON workspace_question_escalations(target_id, status);
