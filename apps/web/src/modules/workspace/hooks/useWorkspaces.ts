import { useCallback, useEffect, useState } from 'react';
import type { Database } from '@ai-brain/database';
import { apiJson } from '@/shared/lib/api';

type Workspace = Database['public']['Tables']['shared_workspaces']['Row'];

export interface WorkspaceWithRole extends Workspace {
  role: Database['public']['Tables']['workspace_members']['Row']['role'];
}

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<WorkspaceWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { workspaces: data } = await apiJson<{ workspaces: WorkspaceWithRole[] }>('/workspaces');
      setWorkspaces(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWorkspaces();
  }, [fetchWorkspaces]);

  const createWorkspace = async (name: string, description?: string) => {
    const { workspace } = await apiJson<{ workspace: Workspace }>('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
    await fetchWorkspaces();
    return workspace;
  };

  const inviteMember = async (
    workspaceId: string,
    email: string,
    role: 'admin' | 'member' | 'viewer' = 'member',
  ) => {
    return apiJson('/workspaces/' + workspaceId + '/invite', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  };

  const acceptInvitation = async (token: string) => {
    const { workspace } = await apiJson<{ workspace: Workspace }>('/workspaces/accept', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    await fetchWorkspaces();
    return workspace;
  };

  return {
    workspaces,
    loading,
    error,
    refetch: fetchWorkspaces,
    createWorkspace,
    inviteMember,
    acceptInvitation,
  };
}
