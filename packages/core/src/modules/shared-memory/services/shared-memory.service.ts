import { EVENT_TYPES } from '../../../events/index.js';
import type { Database } from '@ai-brain/database';
import type { ServiceContext } from '../../../shared/types.js';
import { MemoryService } from '../../memory/services/memory.service.js';
import { NotificationService } from '../../notifications/services/notification.service.js';

type Workspace = Database['public']['Tables']['shared_workspaces']['Row'];

export class SharedMemoryService {
  private memoryService: MemoryService;
  private notifications: NotificationService;

  constructor(private readonly ctx: ServiceContext) {
    this.memoryService = new MemoryService(ctx);
    this.notifications = new NotificationService(ctx);
  }

  async createWorkspace(name: string, ownerId: string, description?: string): Promise<Workspace> {
    const { data: workspace, error } = await this.ctx.supabase
      .from('shared_workspaces')
      .insert({ name, owner_id: ownerId, description })
      .select()
      .single();

    if (error) throw new Error(`Failed to create workspace: ${error.message}`);

    await this.ctx.supabase.from('workspace_members').insert({
      workspace_id: workspace.id,
      user_id: ownerId,
      role: 'owner',
    });

    await this.ctx.supabase.from('projects').insert({
      workspace_id: workspace.id,
      name,
    });

    await this.ctx.eventBus.publish({
      type: EVENT_TYPES.WORKSPACE_CREATED,
      aggregateType: 'workspace',
      aggregateId: workspace.id,
      userId: ownerId,
      payload: { workspaceId: workspace.id, name },
    });

    return workspace;
  }

  async inviteByEmail(
    workspaceId: string,
    email: string,
    invitedBy: string,
    role: 'admin' | 'member' | 'viewer' = 'member',
  ) {
    const { data: invitation, error } = await this.ctx.supabase
      .from('workspace_invitations')
      .insert({ workspace_id: workspaceId, email, invited_by: invitedBy, role })
      .select()
      .single();

    if (error) throw new Error(`Failed to create invitation: ${error.message}`);

    const { data: workspace } = await this.ctx.supabase
      .from('shared_workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single();

    await this.notifications.sendEmail({
      to: email,
      subject: `Invitation to join ${workspace?.name ?? 'workspace'} on AI Brain`,
      html: `<p>You've been invited to collaborate on AI Brain.</p><p>Workspace: <strong>${workspace?.name}</strong></p><p>Use token: <code>${invitation.token}</code> to accept.</p>`,
    });

    await this.ctx.eventBus.publish({
      type: EVENT_TYPES.WORKSPACE_INVITATION_SENT,
      aggregateType: 'workspace',
      aggregateId: workspaceId,
      userId: invitedBy,
      payload: { invitationId: invitation.id, email },
    });

    return invitation;
  }

  async acceptInvitation(token: string, userId: string) {
    const { data: invitation, error } = await this.ctx.supabase
      .from('workspace_invitations')
      .select('*')
      .eq('token', token)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !invitation) throw new Error('Invalid or expired invitation');

    await this.ctx.supabase.from('workspace_members').insert({
      workspace_id: invitation.workspace_id,
      user_id: userId,
      role: invitation.role,
      invited_by: invitation.invited_by,
    });

    await this.ctx.supabase
      .from('workspace_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    await this.ctx.eventBus.publish({
      type: EVENT_TYPES.WORKSPACE_MEMBER_JOINED,
      aggregateType: 'workspace',
      aggregateId: invitation.workspace_id,
      userId,
      payload: { workspaceId: invitation.workspace_id },
    });
  }

  async listWorkspaces(userId: string) {
    const { data, error } = await this.ctx.supabase
      .from('workspace_members')
      .select('workspace_id, role, shared_workspaces(*)')
      .eq('user_id', userId);

    if (error) throw new Error(`Failed to list workspaces: ${error.message}`);
    return data ?? [];
  }
}
