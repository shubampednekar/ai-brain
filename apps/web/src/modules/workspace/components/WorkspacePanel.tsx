import { useState } from 'react';
import { Loader2, Mail, Plus, Users } from 'lucide-react';
import { useWorkspaces } from '../hooks/useWorkspaces';
import { WorkspaceCapture } from './WorkspaceCapture';
import { WorkspaceMemoryFeed } from './WorkspaceMemoryFeed';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

export function WorkspacePanel() {
  const { workspaces, loading, error, createWorkspace, inviteMember } = useWorkspaces();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [feedKey, setFeedKey] = useState(0);

  const selected = workspaces.find((w) => w.id === selectedId) ?? workspaces[0] ?? null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || creating) return;

    setCreating(true);
    try {
      const workspace = await createWorkspace(createName.trim(), createDescription.trim() || undefined);
      setCreateName('');
      setCreateDescription('');
      setSelectedId(workspace.id);
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !inviteEmail.trim() || inviting) return;

    setInviting(true);
    setInviteMessage('');
    try {
      await inviteMember(selected.id, inviteEmail.trim());
      setInviteEmail('');
      setInviteMessage('Invitation sent! They can accept with the token from their email.');
    } catch (err) {
      setInviteMessage(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Shared Workspaces</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Collaborate with your team on a shared knowledge base.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          {error}
        </p>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create workspace
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-3">
            <Input
              placeholder="Workspace name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
            />
            <Input
              placeholder="Description (optional)"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
            />
            <Button type="submit" disabled={!createName.trim() || creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create workspace
            </Button>
          </form>
        </CardContent>
      </Card>

      {workspaces.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Your workspaces
          </p>
          <div className="flex flex-wrap gap-2">
            {workspaces.map((workspace) => (
              <Button
                key={workspace.id}
                variant={(selected?.id ?? selectedId) === workspace.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedId(workspace.id)}
              >
                <Users className="h-3 w-3 mr-1.5" />
                {workspace.name}
                <span className="ml-1.5 text-xs opacity-70">({workspace.role})</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div className="space-y-6 border-t pt-6">
          <div>
            <h3 className="font-medium">{selected.name}</h3>
            {selected.description && (
              <p className="text-sm text-muted-foreground mt-1">{selected.description}</p>
            )}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Invite member
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="collaborator@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={!inviteEmail.trim() || inviting}>
                  {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Invite'}
                </Button>
              </form>
              {inviteMessage && (
                <p className="text-xs text-muted-foreground mt-2">{inviteMessage}</p>
              )}
            </CardContent>
          </Card>

          <div>
            <h4 className="text-sm font-medium mb-3">Capture shared memory</h4>
            <WorkspaceCapture
              workspaceId={selected.id}
              onCaptured={() => setFeedKey((k) => k + 1)}
            />
          </div>

          <div>
            <h4 className="text-sm font-medium mb-3">Shared memories</h4>
            <WorkspaceMemoryFeed key={feedKey} workspaceId={selected.id} />
          </div>
        </div>
      )}

      {!workspaces.length && !loading && (
        <p className="text-center text-sm text-muted-foreground py-6">
          Create a workspace above to get started, or accept an invitation from a teammate.
        </p>
      )}
    </div>
  );
}
