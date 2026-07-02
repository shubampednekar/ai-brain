import type { ServiceContext } from '../../../shared/types.js';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class NotificationService {
  constructor(private readonly ctx: ServiceContext) {}

  async sendEmail(options: EmailOptions): Promise<void> {
    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom } = this.ctx.config;

    if (!smtpUser || !smtpPass) {
      console.warn('SMTP not configured, skipping email send');
      return;
    }

    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: smtpFrom ?? smtpUser,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text ?? options.html.replace(/<[^>]*>/g, ''),
    });
  }

  async notifyUser(
    userId: string,
    title: string,
    body: string,
    channel: 'email' = 'email',
  ): Promise<void> {
    const { data: profile } = await this.ctx.supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    await this.ctx.supabase.from('notifications').insert({
      user_id: userId,
      channel,
      title,
      body,
      status: 'pending',
    });

    if (channel === 'email' && profile?.email) {
      await this.sendEmail({
        to: profile.email,
        subject: title,
        html: `<div style="font-family: sans-serif;"><h2>${title}</h2><p>${body}</p><hr><p style="color: #666; font-size: 12px;">Sent by AI Brain</p></div>`,
      });

      await this.ctx.supabase
        .from('notifications')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('title', title)
        .order('created_at', { ascending: false })
        .limit(1);
    }
  }

  async sendReminderEmail(
    userId: string,
    title: string,
    description?: string,
  ): Promise<void> {
    await this.notifyUser(
      userId,
      `Reminder: ${title}`,
      description ?? 'You have a scheduled reminder.',
    );
  }

  async sendTaskAssignmentEmail(
    assigneeId: string,
    taskTitle: string,
    assignerName?: string,
  ): Promise<void> {
    await this.notifyUser(
      assigneeId,
      `New Task: ${taskTitle}`,
      `${assignerName ?? 'Someone'} assigned you a task: ${taskTitle}`,
    );
  }

  async sendWorkspaceTaskCreatedEmail(
    memberId: string,
    taskTitle: string,
    creatorName: string,
    workspaceName: string,
    taskDescription?: string,
  ): Promise<void> {
    const body = [
      `${creatorName} created a new task in workspace "${workspaceName}".`,
      `Task: ${taskTitle}`,
      taskDescription ? `Details: ${taskDescription}` : '',
      'Open the Shared tab in AI Brain to view workspace memories and ask questions.',
    ]
      .filter(Boolean)
      .join('\n\n');

    await this.notifyUser(memberId, `New workspace task: ${taskTitle}`, body);
  }

  async sendWorkspaceQuestionEscalationEmail(
    targetUserId: string,
    details: {
      workspaceName: string;
      askerName: string;
      question: string;
      aiAnswer: string;
      confidence: number;
      relatedTaskTitle?: string;
      contextFound: string;
      frontendUrl?: string;
    },
  ): Promise<void> {
    const workspaceLink = details.frontendUrl
      ? `${details.frontendUrl.replace(/\/$/, '')}`
      : 'your AI Brain app';

    const body = [
      `${details.askerName} asked a question in workspace "${details.workspaceName}" that needs your input.`,
      details.relatedTaskTitle
        ? `Related task: ${details.relatedTaskTitle}`
        : '',
      `Question: ${details.question}`,
      `AI attempted answer (confidence ${Math.round(details.confidence * 100)}%): ${details.aiAnswer}`,
      `Context from shared memories:\n${details.contextFound}`,
      `Please add a shared memory or reply in the workspace so your teammate has a clear answer.`,
      `Open: ${workspaceLink}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    await this.notifyUser(
      targetUserId,
      `Clarification needed in ${details.workspaceName}`,
      body,
    );
  }
}
