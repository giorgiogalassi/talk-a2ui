// Demo: the latency changes of 2026-11-06 (README, "Latency").
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {thinkingConfig} from './model.js';
import {buildUserQuery} from './user-query.js';

describe('thinking level', () => {
  it('defaults to MINIMAL', () => {
    assert.deepEqual(thinkingConfig(undefined), {thinkingConfig: {thinkingLevel: 'MINIMAL'}});
    assert.deepEqual(thinkingConfig(' '), {thinkingConfig: {thinkingLevel: 'MINIMAL'}});
  });
  it('takes GEMINI_THINKING_LEVEL, and DEFAULT leaves the model its own setting', () => {
    assert.deepEqual(thinkingConfig('high'), {thinkingConfig: {thinkingLevel: 'HIGH'}});
    assert.deepEqual(thinkingConfig('DEFAULT'), {});
  });
  it('rejects anything else', () => {
    assert.throws(() => thinkingConfig('max'), /GEMINI_THINKING_LEVEL must be/);
  });
});

describe('open_ticket', () => {
  it('carries the ticket already fetched, so the model needs no tool call', () => {
    const {query, actionName} = buildUserQuery({
      text: '',
      action: {name: 'open_ticket', context: {ticketId: 'TCK-1042'}} as never,
      useStreaming: true,
    });
    assert.equal(actionName, 'open_ticket');
    assert.ok(query.startsWith('USER_WANTS_TICKET_DETAILS: TCK-1042\n'), query);
    const data = JSON.parse(query.split('do not call it again): ')[1]) as {id: string}[];
    assert.deepEqual(data.map(t => t.id), ['TCK-1042']);
  });
});
