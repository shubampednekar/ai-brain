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
    await this.assertMember(workspaceId, invitedBy);

    const { data: membership } = await this.ctx.supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', invitedBy)
      .maybeSingle();

    const canInvite =
      membership?.role === 'owner' ||
      membership?.role === 'admin' ||
      (await this.ctx.supabase
        .from('shared_workspaces')
        .select('id')
        .eq('id', workspaceId)
        .eq('owner_id', invitedBy)
        .maybeSingle()).data;

    if (!canInvite) throw new Error('Not authorized to invite members');

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

    const workspaceName = workspace?.name ?? 'workspace';
    const frontendUrl = this.ctx.config.frontendUrl?.replace(/\/$/, '');
    const inviteLink = frontendUrl
      ? `${frontendUrl}/invite?token=${encodeURIComponent(invitation.token)}`
      : null;

    const inviteInstructions = inviteLink
      ? `<p><a href="${inviteLink}" style="display:inline-block;padding:10px 16px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Accept invitation</a></p>
         <p style="font-size:13px;color:#666;">Or open this link: <a href="${inviteLink}">${inviteLink}</a></p>
         <p style="font-size:13px;color:#666;">Token (manual fallback): <code>${invitation.token}</code></p>`
      : `<p>Use token: <code>${invitation.token}</code> to accept at your AI Brain app's /invite page.</p>`;

    await this.notifications.sendEmail({
      to: email,
      subject: `Invitation to join ${workspaceName} on AI Brain`,
      html: `<div style="font-family:sans-serif;max-width:520px;">
        <p>You've been invited to collaborate on AI Brain.</p>
        <p>Workspace: <strong>${workspaceName}</strong></p>
        ${inviteInstructions}
        <p style="font-size:12px;color:#888;margin-top:24px;">Sign in or create an account first, then accept the invite. Expires in 7 days.</p>
      </div>`,
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

  async acceptInvitation(token: string, userId: string): Promise<Workspace> {
    const { data: invitation, error } = await this.ctx.supabase
      .from('workspace_invitations')
      .select('*')
      .eq('token', token)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !invitation) throw new Error('Invalid or expired invitation');

    const { data: existingMember } = await this.ctx.supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', invitation.workspace_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingMember) {
      await this.ctx.supabase.from('workspace_members').insert({
        workspace_id: invitation.workspace_id,
        user_id: userId,
        role: invitation.role,
        invited_by: invitation.invited_by,
      });
    }

    await this.ctx.supabase
      .from('workspace_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    const { data: workspace, error: workspaceError } = await this.ctx.supabase
      .from('shared_workspaces')
      .select('*')
      .eq('id', invitation.workspace_id)
      .single();

    if (workspaceError || !workspace) {
      throw new Error('Failed to load workspace after accepting invitation');
    }

    await this.ctx.eventBus.publish({
      type: EVENT_TYPES.WORKSPACE_MEMBER_JOINED,
      aggregateType: 'workspace',
      aggregateId: invitation.workspace_id,
      userId,
      payload: { workspaceId: invitation.workspace_id },
    });

    return workspace;
  }

  async assertMember(workspaceId: string, userId: string): Promise<void> {
    const { data: member } = await this.ctx.supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle();

    if (member) return;

    const { data: workspace } = await this.ctx.supabase
      .from('shared_workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('owner_id', userId)
      .maybeSingle();

    if (!workspace) throw new Error('Not a member of this workspace');
  }

  async listWorkspaces(userId: string) {
    const { data, error } = await this.ctx.supabase
      .from('workspace_members')
      .select('workspace_id, role, shared_workspaces(*)')
      .eq('user_id', userId);

    if (error) throw new Error(`Failed to list workspaces: ${error.message}`);
    return data ?? [];
  }

  async listWorkspaceMemories(
    workspaceId: string,
    userId: string,
    limit = 20,
    offset = 0,
  ) {
    await this.assertMember(workspaceId, userId);
    return this.memoryService.listByWorkspace(workspaceId, limit, offset);
  }
}
