-- Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirement_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Intent categories & feature flags (read-only for authenticated users)
CREATE POLICY "Authenticated users can read intent categories" ON intent_categories FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Authenticated users can read feature flags" ON feature_flags FOR SELECT TO authenticated USING (true);

-- Organizations
CREATE POLICY "Members can view their organizations" ON organizations FOR SELECT
  USING (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = id AND om.user_id = auth.uid()));

CREATE POLICY "Members can view org membership" ON organization_members FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM organization_members om WHERE om.organization_id = organization_members.organization_id AND om.user_id = auth.uid()
  ));

-- Shared workspaces
CREATE POLICY "Members can view workspaces" ON shared_workspaces FOR SELECT
  USING (
    owner_id = auth.uid() OR
    EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = id AND wm.user_id = auth.uid())
  );

CREATE POLICY "Owners can create workspaces" ON shared_workspaces FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update workspaces" ON shared_workspaces FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Members can view workspace membership" ON workspace_members FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid())
  );

CREATE POLICY "Admins can manage workspace members" ON workspace_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      JOIN shared_workspaces sw ON sw.id = wm.workspace_id
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND (wm.role IN ('owner', 'admin') OR sw.owner_id = auth.uid())
    )
  );

-- Workspace invitations
CREATE POLICY "Workspace admins can manage invitations" ON workspace_invitations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM shared_workspaces sw
      WHERE sw.id = workspace_id AND sw.owner_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- Memories: private memories only accessible by owner; shared by workspace members
CREATE POLICY "Users can view own private memories" ON memories FOR SELECT
  USING (
    (user_id = auth.uid() AND visibility = 'private') OR
    (visibility = 'shared' AND workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = memories.workspace_id AND wm.user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can create memories" ON memories FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own memories" ON memories FOR UPDATE
  USING (user_id = auth.uid());

-- Memory versions
CREATE POLICY "Users can view memory versions" ON memory_versions FOR SELECT
  USING (EXISTS (SELECT 1 FROM memories m WHERE m.id = memory_id AND m.user_id = auth.uid()));

-- Memory entities & metadata
CREATE POLICY "Users can view memory entities" ON memory_entities FOR SELECT
  USING (EXISTS (SELECT 1 FROM memories m WHERE m.id = memory_id AND m.user_id = auth.uid()));

CREATE POLICY "Users can view memory metadata" ON memory_metadata FOR SELECT
  USING (EXISTS (SELECT 1 FROM memories m WHERE m.id = memory_id AND m.user_id = auth.uid()));

-- Memory relationships
CREATE POLICY "Users can view memory relationships" ON memory_relationships FOR SELECT
  USING (EXISTS (SELECT 1 FROM memories m WHERE m.id = source_memory_id AND m.user_id = auth.uid()));

-- Reminders
CREATE POLICY "Users can manage own reminders" ON reminders FOR ALL USING (user_id = auth.uid());

-- Tasks
CREATE POLICY "Users can view relevant tasks" ON tasks FOR SELECT
  USING (
    user_id = auth.uid() OR assignee_id = auth.uid() OR
    (workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = tasks.workspace_id AND wm.user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can create tasks" ON tasks FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE USING (user_id = auth.uid() OR assignee_id = auth.uid());

-- Decisions & Approvals
CREATE POLICY "Users can view workspace decisions" ON decisions FOR SELECT
  USING (
    user_id = auth.uid() OR
    (workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = decisions.workspace_id AND wm.user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can create decisions" ON decisions FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view workspace approvals" ON approvals FOR SELECT
  USING (
    user_id = auth.uid() OR
    (workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = approvals.workspace_id AND wm.user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can create approvals" ON approvals FOR INSERT WITH CHECK (user_id = auth.uid());

-- Requirements
CREATE POLICY "Workspace members can view requirements" ON requirements FOR SELECT
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = requirements.workspace_id AND wm.user_id = auth.uid()));

CREATE POLICY "Workspace members can view requirement versions" ON requirement_versions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM requirements r
    JOIN workspace_members wm ON wm.workspace_id = r.workspace_id
    WHERE r.id = requirement_id AND wm.user_id = auth.uid()
  ));

-- Conversations & Messages
CREATE POLICY "Workspace members can view conversations" ON conversations FOR SELECT
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversations.workspace_id AND wm.user_id = auth.uid()));

CREATE POLICY "Workspace members can view messages" ON messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = messages.workspace_id AND wm.user_id = auth.uid()));

CREATE POLICY "Workspace members can send messages" ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = messages.workspace_id AND wm.user_id = auth.uid())
  );

-- Projects
CREATE POLICY "Workspace members can view projects" ON projects FOR SELECT
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = projects.workspace_id AND wm.user_id = auth.uid()));

-- Notifications
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- Domain events & jobs: service role only (no user policies)
-- Audit logs: users can view their own
CREATE POLICY "Users can view own audit logs" ON audit_logs FOR SELECT USING (user_id = auth.uid());
