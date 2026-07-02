export const EVENT_TYPES = {
  MEMORY_CREATED: 'memory.created',
  MEMORY_UPDATED: 'memory.updated',
  MEMORY_MERGED: 'memory.merged',
  MEMORY_DELETED: 'memory.deleted',

  REMINDER_DETECTED: 'reminder.detected',
  REMINDER_SCHEDULED: 'reminder.scheduled',
  REMINDER_SENT: 'reminder.sent',

  TASK_EXTRACTED: 'task.extracted',
  TASK_ASSIGNED: 'task.assigned',
  TASK_COMPLETED: 'task.completed',

  DECISION_RECORDED: 'decision.recorded',
  APPROVAL_RECORDED: 'approval.recorded',
  REQUIREMENT_VERSIONED: 'requirement.versioned',

  METADATA_EXTRACTED: 'metadata.extracted',
  EMBEDDING_GENERATED: 'embedding.generated',
  DUPLICATE_DETECTED: 'duplicate.detected',
  RELATIONSHIP_CREATED: 'relationship.created',

  MESSAGE_SENT: 'message.sent',
  WORKSPACE_CREATED: 'workspace.created',
  WORKSPACE_INVITATION_SENT: 'workspace.invitation_sent',
  WORKSPACE_MEMBER_JOINED: 'workspace.member_joined',

  QUESTION_ASKED: 'question.asked',
  QUESTION_RESOLVED: 'question.resolved',
  QUESTION_ESCALATED: 'question.escalated',

  JOB_CREATED: 'job.created',
  JOB_COMPLETED: 'job.completed',
  JOB_FAILED: 'job.failed',

  NOTIFICATION_SENT: 'notification.sent',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export interface DomainEvent<T = Record<string, unknown>> {
  id: string;
  type: EventType;
  aggregateType: string;
  aggregateId: string;
  userId?: string;
  payload: T;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  createdAt: Date;
}

export type EventHandler<T = Record<string, unknown>> = (
  event: DomainEvent<T>,
) => void | Promise<void>;

export interface EventBus {
  publish<T extends Record<string, unknown>>(event: Omit<DomainEvent<T>, 'id' | 'createdAt'>): Promise<DomainEvent<T>>;
  subscribe<T extends Record<string, unknown>>(eventType: EventType | EventType[], handler: EventHandler<T>): () => void;
  subscribeAll(handler: EventHandler): () => void;
}

export interface EventStore {
  save(event: DomainEvent): Promise<void>;
  getUnprocessed(limit?: number): Promise<DomainEvent[]>;
  markProcessed(eventId: string): Promise<void>;
}
