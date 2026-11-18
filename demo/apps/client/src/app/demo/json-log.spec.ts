import { TestBed } from '@angular/core/testing';
import { JsonLog } from './json-log';

// Demo: the "Show JSON" drawer's state: one turn at a time, events in arrival order.

describe('JsonLog', () => {
  const createSurface = { version: 'v0.9', createSurface: { surfaceId: 'tickets', catalogId: 'c' } };
  const updateDataModel = { version: 'v0.9', updateDataModel: { surfaceId: 'tickets', path: '/', value: { n: 1 } } };

  it('is off by default', () => {
    expect(TestBed.inject(JsonLog).visible()).toBe(false);
  });

  it('accumulates the events of a turn in arrival order, without the session id', () => {
    const log = TestBed.inject(JsonLog);
    log.start('Prompt: "Show me the open tickets"');
    log.add({ messages: [createSurface], sessionId: 's1' });
    log.add({ messages: [updateDataModel], sessionId: 's1' });

    const events = log.events();
    expect(log.turn()).toBe('Prompt: "Show me the open tickets"');
    expect(events.map((e) => e.n)).toEqual([1, 2]);
    expect(events.map((e) => e.messages.map((m) => m.kind))).toEqual([['createSurface'], ['updateDataModel']]);
    expect(JSON.parse(events[0].messages[0].json)).toEqual(createSurface);
    expect(events[0].messages[0].json).toContain('\n  "createSurface"');
    expect(JSON.stringify(events)).not.toContain('s1');
  });

  it('keeps the text and the error, and skips an event that only carries the session id', () => {
    const log = TestBed.inject(JsonLog);
    log.start('VALIDATION_FAILED report (/tickets/0/priority)');
    log.add({ messages: [], sessionId: 's1' });
    log.add({ messages: [], text: 'Here are the tickets as text.', sessionId: 's1' });
    log.add({ error: 'The agent failed.' });

    expect(log.events()).toEqual([
      { n: 1, messages: [], text: 'Here are the tickets as text.' },
      { n: 2, messages: [], error: 'The agent failed.' },
    ]);
  });

  it('forgets the previous turn when a new one starts', () => {
    const log = TestBed.inject(JsonLog);
    log.start('Prompt: "first"');
    log.add({ messages: [createSurface] });
    log.start('Action: open_ticket');

    expect(log.turn()).toBe('Action: open_ticket');
    expect(log.events()).toEqual([]);
    log.add({ messages: [updateDataModel] });
    expect(log.events()[0].n).toBe(1);
  });
});
