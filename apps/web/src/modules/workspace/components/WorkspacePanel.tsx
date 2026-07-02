import { useEffect, useState } from 'react';
import {
  FolderOpen,
  Loader2,
  Mail,
  MessageSquarePlus,
  Plus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useWorkspaces } from '../hooks/useWorkspaces';
import { WorkspaceCapture } from './WorkspaceCapture';
import { WorkspaceMemoryFeed } from './WorkspaceMemoryFeed';
import { PageLayout } from '@/shared/components/layout/PageLayout';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/utils';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

export function WorkspacePanel() {
  const { workspaces, loading, error, createWorkspace, inviteMember } = useWorkspaces();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [feedKey, setFeedKey] = useState(0);

  const selected = workspaces.find((w) => w.id === selectedId) ?? workspaces[0] ?? null;

  useEffect(() => {
    setInviteMessage('');
    setInviteEmail('');
  }, [selected?.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || creating) return;

    setCreating(true);
    try {
      const workspace = await createWorkspace(createName.trim(), createDescription.trim() || undefined);
      setCreateName('');
      setCreateDescription('');
      setSelectedId(workspace.id);
      setShowCreateForm(false);
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
      setInviteMessage('Invitation sent!');
    } catch (err) {
      setInviteMessage(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sidebar = (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        {workspaces.length === 0 ? (
          <CardContent className="p-6 text-center">
            <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No workspaces yet</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create one
            </Button>
          </CardContent>
        ) : (
          <ul className="p-2 space-y-0.5" role="listbox" aria-label="Workspaces">
            {workspaces.map((workspace) => {
              const isSelected = selected?.id === workspace.id;
              return (
                <li key={workspace.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => setSelectedId(workspace.id)}
                    className={cn(
                      'w-full flex items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
                      isSelected
                        ? 'bg-primary/10 text-foreground ring-1 ring-primary/20'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Users className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{workspace.name}</p>
                      <p className="text-xs opacity-70 capitalize">
                        {ROLE_LABELS[workspace.role] ?? workspace.role}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {showCreateForm ? (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Create workspace</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
              <Input
                placeholder="Workspace name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                autoFocus
              />
              <Input
                placeholder="Description (optional)"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
              />
              <Button type="submit" className="w-full" size="sm" disabled={!createName.trim() || creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {selected ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Invite teammates
            </CardTitle>
            <CardDescription className="text-xs">
              They&apos;ll receive an email with a join link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-3">
              <Input
                type="email"
                placeholder="collaborator@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <Button
                type="submit"
                className="w-full"
                size="sm"
                disabled={!inviteEmail.trim() || inviting}
              >
                {inviting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Send invitation
              </Button>
            </form>
            {inviteMessage ? (
              <p
                className={cn(
                  'text-xs mt-3',
                  inviteMessage.includes('sent') ? 'text-primary' : 'text-destructive',
                )}
              >
                {inviteMessage}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );

  return (
    <PageLayout
      title="Shared Workspaces"
      description="Collaborate with your team on a shared knowledge base."
      sidebarTitle="Workspaces"
      sidebar={sidebar}
      banner={
        error ? (
          <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
            {error}
          </p>
        ) : null
      }
      action={
        <Button
          type="button"
          onClick={() => setShowCreateForm((open) => !open)}
        >
          {showCreateForm ? (
            <>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              New workspace
            </>
          )}
        </Button>
      }
    >
      {!selected ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-medium text-base">Select a workspace</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Choose a workspace from the sidebar, or create a new one to start collaborating.
            </p>
            <Button
              type="button"
              className="mt-6"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              New workspace
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold tracking-tight truncate">{selected.name}</h3>
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize">
                {ROLE_LABELS[selected.role] ?? selected.role}
              </span>
            </div>
            {selected.description ? (
              <p className="text-sm text-muted-foreground mt-1.5">{selected.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1.5 italic">No description</p>
            )}
          </div>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquarePlus className="h-4 w-4" />
                Add to workspace
              </CardTitle>
              <CardDescription>
                Capture a memory visible to everyone in this workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WorkspaceCapture
                workspaceId={selected.id}
                onCaptured={() => setFeedKey((k) => k + 1)}
              />
            </CardContent>
          </Card>

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 px-1">
              Shared memories
            </p>
            <WorkspaceMemoryFeed key={feedKey} workspaceId={selected.id} />
          </div>
        </>
      )}
    </PageLayout>
  );
}
