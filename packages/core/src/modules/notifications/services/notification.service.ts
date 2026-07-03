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
      escalationId?: string;
    },
  ): Promise<void> {
    const baseUrl = details.frontendUrl?.replace(/\/$/, '') ?? '';
    const answerLink =
      baseUrl && details.escalationId
        ? `${baseUrl}/answer?escalation=${encodeURIComponent(details.escalationId)}`
        : baseUrl || 'your AI Brain app';

    const body = [
      `${details.askerName} asked a question in workspace "${details.workspaceName}" that needs your input.`,
      details.relatedTaskTitle ? `Related task: ${details.relatedTaskTitle}` : '',
      `Question: ${details.question}`,
      `AI attempted answer (confidence ${Math.round(details.confidence * 100)}%): ${details.aiAnswer}`,
      `Context from shared memories:\n${details.contextFound}`,
      `Please add a shared memory to answer your teammate.`,
      `Answer here: ${answerLink}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const htmlAnswerLink =
      baseUrl && details.escalationId
        ? `<p><a href="${answerLink}" style="display:inline-block;padding:10px 16px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Answer this question</a></p>
           <p style="font-size:13px;color:#666;">Or open: <a href="${answerLink}">${answerLink}</a></p>`
        : `<p>Open AI Brain to add a shared memory in the workspace.</p>`;

    const { data: profile } = await this.ctx.supabase
      .from('profiles')
      .select('email')
      .eq('id', targetUserId)
      .single();

    if (profile?.email) {
      await this.sendEmail({
        to: profile.email,
        subject: `Clarification needed in ${details.workspaceName}`,
        html: `<div style="font-family:sans-serif;max-width:520px;">
          <p>${details.askerName} asked a question in workspace <strong>${details.workspaceName}</strong> that needs your input.</p>
          ${details.relatedTaskTitle ? `<p>Related task: <strong>${details.relatedTaskTitle}</strong></p>` : ''}
          <p><strong>Question:</strong> ${details.question}</p>
          <p><strong>AI attempted answer</strong> (confidence ${Math.round(details.confidence * 100)}%): ${details.aiAnswer}</p>
          <p><strong>Context from shared memories:</strong><br/>${details.contextFound.replace(/\n/g, '<br/>')}</p>
          ${htmlAnswerLink}
        </div>`,
        text: body,
      });
    }
  }

  async sendEscalationResolvedEmail(
    askerId: string,
    details: {
      workspaceName: string;
      resolverName: string;
      question: string;
      answer: string;
      frontendUrl?: string;
    },
  ): Promise<void> {
    const link = details.frontendUrl ? `${details.frontendUrl.replace(/\/$/, '')}` : 'AI Brain';

    await this.notifyUser(
      askerId,
      `Your question was answered in ${details.workspaceName}`,
      [
        `${details.resolverName} clarified your question in workspace "${details.workspaceName}".`,
        `Your question: ${details.question}`,
        `Their answer: ${details.answer}`,
        `Open ${link} and use Ask this workspace to get an updated AI answer.`,
      ].join('\n\n'),
    );
  }

  async sendPreferenceDigestEmail(
    userId: string,
    email: string,
    items: Array<{
      preference: string;
      updates: Array<{ title: string; link: string; summary: string }>;
    }>,
  ): Promise<void> {
    const sections = items
      .filter((item) => item.updates.length > 0)
      .map((item) => {
        const bullets = item.updates
          .map(
            (u) =>
              `<li><a href="${u.link}" style="color:#6366f1;">${u.title}</a><br/><span style="color:#666;font-size:13px;">${u.summary}</span></li>`,
          )
          .join('');
        return `<h3 style="margin:16px 0 8px;font-size:15px;">${item.preference}</h3><ul style="margin:0;padding-left:20px;">${bullets}</ul>`;
      })
      .join('');

    const textSections = items
      .filter((item) => item.updates.length > 0)
      .map((item) => {
        const bullets = item.updates.map((u) => `- ${u.title}: ${u.summary} (${u.link})`).join('\n');
        return `${item.preference}\n${bullets}`;
      })
      .join('\n\n');

    const html = `<div style="font-family:sans-serif;max-width:560px;">
      <h2 style="margin:0 0 12px;">Your daily preference digest</h2>
      <p style="color:#666;font-size:14px;">Here's what's new based on your saved preferences.</p>
      ${sections}
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee;"/>
      <p style="color:#999;font-size:12px;">Sent by AI Brain. Manage preferences in the Preferences tab.</p>
    </div>`;

    await this.sendEmail({
      to: email,
      subject: 'Your AI Brain preference digest',
      html,
      text: `Your daily preference digest\n\n${textSections}`,
    });

    await this.ctx.supabase.from('notifications').insert({
      user_id: userId,
      channel: 'email',
      title: 'Your AI Brain preference digest',
      body: textSections,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });
  }
}
