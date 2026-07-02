import { describe, it, expect } from 'vitest';
import { InMemoryEventBus, EVENT_TYPES } from '../events/index.js';

describe('InMemoryEventBus', () => {
  it('publishes events to subscribers', async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];

    bus.subscribe(EVENT_TYPES.MEMORY_CREATED, (event) => {
      received.push(event.aggregateId);
    });

    await bus.publish({
      type: EVENT_TYPES.MEMORY_CREATED,
      aggregateType: 'memory',
      aggregateId: 'test-123',
      payload: { text: 'hello' },
    });

    expect(received).toEqual(['test-123']);
  });

  it('unsubscribes correctly', async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];

    const unsubscribe = bus.subscribe(EVENT_TYPES.MEMORY_CREATED, (event) => {
      received.push(event.aggregateId);
    });

    unsubscribe();

    await bus.publish({
      type: EVENT_TYPES.MEMORY_CREATED,
      aggregateType: 'memory',
      aggregateId: 'test-456',
      payload: {},
    });

    expect(received).toEqual([]);
  });
});
