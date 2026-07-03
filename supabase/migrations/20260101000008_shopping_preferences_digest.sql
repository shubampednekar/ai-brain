-- Shopping lists, preference digest runs

CREATE TABLE shopping_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  memory_id UUID REFERENCES memories(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT 'Shopping list',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE shopping_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  memory_id UUID REFERENCES memories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  quantity TEXT,
  store TEXT,
  is_purchased BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE preference_digest_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  preferences_snapshot JSONB NOT NULL DEFAULT '[]',
  research_results JSONB NOT NULL DEFAULT '[]',
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, run_date)
);

CREATE INDEX idx_shopping_lists_user ON shopping_lists(user_id);
CREATE INDEX idx_shopping_items_list ON shopping_items(list_id);
CREATE INDEX idx_shopping_items_purchased ON shopping_items(is_purchased);
CREATE INDEX idx_preference_digest_runs_user ON preference_digest_runs(user_id, run_date DESC);

ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE preference_digest_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own shopping lists" ON shopping_lists FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can manage own shopping items" ON shopping_items FOR ALL
  USING (EXISTS (SELECT 1 FROM shopping_lists sl WHERE sl.id = shopping_items.list_id AND sl.user_id = auth.uid()));

CREATE POLICY "Users can view own preference digest runs" ON preference_digest_runs FOR SELECT USING (user_id = auth.uid());

UPDATE feature_flags SET is_enabled = true WHERE slug IN ('research_agent', 'daily_digest');
