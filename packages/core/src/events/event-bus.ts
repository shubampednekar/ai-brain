import { randomUUID } from 'crypto';
import type { TypedSupabaseClient } from '@ai-brain/database';
import type { DomainEvent, EventBus, EventHandler, EventStore, EventType } from './types.js';

type HandlerEntry = {
  eventTypes: EventType[] | null;
  handler: EventHandler;
};

export class InMemoryEventBus implements EventBus {
  private handlers: HandlerEntry[] = [];

  async publish<T extends Record<string, unknown>>(
    event: Omit<DomainEvent<T>, 'id' | 'createdAt'>,
  ): Promise<DomainEvent<T>> {
    const fullEvent: DomainEvent<T> = {
      ...event,
      id: randomUUID(),
      createdAt: new Date(),
    };

    const relevantHandlers = this.handlers.filter(
      (entry) =>
        entry.eventTypes === null ||
        entry.eventTypes.includes(fullEvent.type as EventType),
    );

    await Promise.allSettled(
      relevantHandlers.map((entry) => entry.handler(fullEvent as DomainEvent)),
    );

    return fullEvent;
  }

  subscribe<T extends Record<string, unknown>>(
    eventType: EventType | EventType[],
    handler: EventHandler<T>,
  ): () => void {
    const eventTypes = Array.isArray(eventType) ? eventType : [eventType];
    const entry: HandlerEntry = {
      eventTypes,
      handler: handler as EventHandler,
    };
    this.handlers.push(entry);

    return () => {
      const index = this.handlers.indexOf(entry);
      if (index > -1) this.handlers.splice(index, 1);
    };
  }

  subscribeAll(handler: EventHandler): () => void {
    const entry: HandlerEntry = { eventTypes: null, handler };
    this.handlers.push(entry);

    return () => {
      const index = this.handlers.indexOf(entry);
      if (index > -1) this.handlers.splice(index, 1);
    };
  }
}

export class SupabaseEventStore implements EventStore {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  async save(event: DomainEvent): Promise<void> {
    const { error } = await this.supabase.from('domain_events').insert({
      id: event.id,
      event_type: event.type,
      aggregate_type: event.aggregateType,
      aggregate_id: event.aggregateId,
      user_id: event.userId ?? null,
      payload: event.payload as import('@ai-brain/database').Json,
      metadata: (event.metadata ?? {}) as import('@ai-brain/database').Json,
      idempotency_key: event.idempotencyKey ?? null,
    });

    if (error) throw new Error(`Failed to save event: ${error.message}`);
  }

  async getUnprocessed(limit = 100): Promise<DomainEvent[]> {
    const { data, error } = await this.supabase
      .from('domain_events')
      .select('*')
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch events: ${error.message}`);

    return (data ?? []).map((row) => ({
      id: row.id,
      type: row.event_type as EventType,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      userId: row.user_id ?? undefined,
      payload: row.payload as Record<string, unknown>,
      metadata: row.metadata as Record<string, unknown>,
      idempotencyKey: row.idempotency_key ?? undefined,
      createdAt: new Date(row.created_at),
    }));
  }

  async markProcessed(eventId: string): Promise<void> {
    const { error } = await this.supabase
      .from('domain_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', eventId);

    if (error) throw new Error(`Failed to mark event processed: ${error.message}`);
  }
}

export class PersistentEventBus implements EventBus {
  private handlers: HandlerEntry[] = [];

  constructor(
    private readonly eventStore: EventStore,
    private readonly inMemoryBus: InMemoryEventBus = new InMemoryEventBus(),
  ) {}

  async publish<T extends Record<string, unknown>>(
    event: Omit<DomainEvent<T>, 'id' | 'createdAt'>,
  ): Promise<DomainEvent<T>> {
    const fullEvent: DomainEvent<T> = {
      ...event,
      id: randomUUID(),
      createdAt: new Date(),
    };

    await this.eventStore.save(fullEvent);
    await this.inMemoryBus.publish(fullEvent);

    const relevantHandlers = this.handlers.filter(
      (entry) =>
        entry.eventTypes === null ||
        entry.eventTypes.includes(fullEvent.type as EventType),
    );

    await Promise.allSettled(
      relevantHandlers.map((entry) => entry.handler(fullEvent as DomainEvent)),
    );

    return fullEvent;
  }

  subscribe<T extends Record<string, unknown>>(
    eventType: EventType | EventType[],
    handler: EventHandler<T>,
  ): () => void {
    const eventTypes = Array.isArray(eventType) ? eventType : [eventType];
    const entry: HandlerEntry = {
      eventTypes,
      handler: handler as EventHandler,
    };
    this.handlers.push(entry);

    return () => {
      const index = this.handlers.indexOf(entry);
      if (index > -1) this.handlers.splice(index, 1);
    };
  }

  subscribeAll(handler: EventHandler): () => void {
    const entry: HandlerEntry = { eventTypes: null, handler };
    this.handlers.push(entry);

    return () => {
      const index = this.handlers.indexOf(entry);
      if (index > -1) this.handlers.splice(index, 1);
    };
  }
}
