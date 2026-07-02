-- Fix RLS infinite recursion on workspace_members
-- Also fixes signup trigger and profiles INSERT policy

-- ============================================================================
-- SECURITY DEFINER helpers (bypass RLS for membership checks)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_workspace_member(workspace_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = workspace_uuid AND user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.shared_workspaces
    WHERE id = workspace_uuid AND owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(workspace_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_workspaces
    WHERE id = workspace_uuid AND owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = workspace_uuid
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(org_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_uuid AND user_id = auth.uid()
  );
$$;

-- ============================================================================
-- Signup: fix profile creation on auth.users insert
-- ============================================================================

DROP POLICY IF EXISTS "Service role can insert profiles" ON profiles;
CREATE POLICY "Service role can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Fix workspace_members policies (remove self-referencing subqueries)
-- ============================================================================

DROP POLICY IF EXISTS "Members can view workspace membership" ON workspace_members;
DROP POLICY IF EXISTS "Admins can manage workspace members" ON workspace_members;

CREATE POLICY "Users can view own membership row"
  ON workspace_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Workspace owners can view all members"
  ON workspace_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shared_workspaces sw
      WHERE sw.id = workspace_members.workspace_id AND sw.owner_id = auth.uid()
    )
  );

CREATE POLICY "Workspace owners can manage members"
  ON workspace_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM shared_workspaces sw
      WHERE sw.id = workspace_members.workspace_id AND sw.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- Fix shared_workspaces policy
-- ============================================================================

DROP POLICY IF EXISTS "Members can view workspaces" ON shared_workspaces;
CREATE POLICY "Members can view workspaces" ON shared_workspaces FOR SELECT
  USING (owner_id = auth.uid() OR public.is_workspace_member(id));

-- ============================================================================
-- Fix workspace_invitations policy
-- ============================================================================

DROP POLICY IF EXISTS "Workspace admins can manage invitations" ON workspace_invitations;
CREATE POLICY "Workspace admins can manage invitations" ON workspace_invitations FOR ALL
  USING (public.is_workspace_admin(workspace_id));

-- ============================================================================
-- Fix organization policies (same recursion pattern)
-- ============================================================================

DROP POLICY IF EXISTS "Members can view their organizations" ON organizations;
CREATE POLICY "Members can view their organizations" ON organizations FOR SELECT
  USING (public.is_org_member(id));

DROP POLICY IF EXISTS "Members can view org membership" ON organization_members;
CREATE POLICY "Members can view org membership" ON organization_members FOR SELECT
  USING (user_id = auth.uid() OR public.is_org_member(organization_id));

-- ============================================================================
-- Fix memories policy
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own private memories" ON memories;
CREATE POLICY "Users can view own private memories" ON memories FOR SELECT
  USING (
    (user_id = auth.uid() AND visibility = 'private')
    OR
    (visibility = 'shared' AND workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id))
  );

-- ============================================================================
-- Fix tasks, decisions, approvals
-- ============================================================================

DROP POLICY IF EXISTS "Users can view relevant tasks" ON tasks;
CREATE POLICY "Users can view relevant tasks" ON tasks FOR SELECT
  USING (
    user_id = auth.uid()
    OR assignee_id = auth.uid()
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id))
  );

DROP POLICY IF EXISTS "Users can view workspace decisions" ON decisions;
CREATE POLICY "Users can view workspace decisions" ON decisions FOR SELECT
  USING (
    user_id = auth.uid()
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id))
  );

DROP POLICY IF EXISTS "Users can view workspace approvals" ON approvals;
CREATE POLICY "Users can view workspace approvals" ON approvals FOR SELECT
  USING (
    user_id = auth.uid()
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id))
  );

-- ============================================================================
-- Fix requirements
-- ============================================================================

DROP POLICY IF EXISTS "Workspace members can view requirements" ON requirements;
CREATE POLICY "Workspace members can view requirements" ON requirements FOR SELECT
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members can view requirement versions" ON requirement_versions;
CREATE POLICY "Workspace members can view requirement versions" ON requirement_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM requirements r
      WHERE r.id = requirement_id AND public.is_workspace_member(r.workspace_id)
    )
  );

-- ============================================================================
-- Fix conversations, messages, projects
-- ============================================================================

DROP POLICY IF EXISTS "Workspace members can view conversations" ON conversations;
CREATE POLICY "Workspace members can view conversations" ON conversations FOR SELECT
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members can view messages" ON messages;
CREATE POLICY "Workspace members can view messages" ON messages FOR SELECT
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members can send messages" ON messages;
CREATE POLICY "Workspace members can send messages" ON messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members can view projects" ON projects;
CREATE POLICY "Workspace members can view projects" ON projects FOR SELECT
  USING (public.is_workspace_member(workspace_id));
