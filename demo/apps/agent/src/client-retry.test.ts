// Demo: the renderer's VALIDATION_FAILED, back at the agent (phase 6). How the inbound error is
// read, the one-retry rule, and a whole exchange through the real executor with the stub that
// sends a value only the renderer rejects (STUB_CLIENT_INVALID).

import assert from 'node:assert/strict';
import {describe, it, type TestContext} from 'node:test';

import type {Message, Part, TaskStatusUpdateEvent} from '@a2a-js/sdk';
import type {ExecutionEventBus, RequestContext} from '@a2a-js/sdk/server';
import {TICKET_CATALOG_ID} from '@demo/catalog';

import {readInboundMessage} from './a2a.js';
import {RestaurantExecutor} from './agent.js';
import {loadBasicCatalogs, loadTicketCatalogs} from './catalogs.js';
import {ClientRetries} from './client-retry.js';
import {StubBackend, type TurnInput} from './model.js';
import {FALLBACK_TEXT} from './prompt.js';

const ERROR = {
  code: 'VALIDATION_FAILED',
  surfaceId: 'tickets',
  path: '/tickets/0/priority',
  message: "PriorityBadge (ticket_priority): priority resolved to 'critical', which the catalog does not allow.",
};

function message(parts: Part[]): Message {
  return {
    kind: 'message',
    messageId: crypto.randomUUID(),
    role: 'user',
    parts,
    metadata: {a2uiClientCapabilities: {'v0.9': {supportedCatalogIds: [TICKET_CATALOG_ID]}}},
  };
}

const errorPart = (error: Record<string, unknown>, version = 'v0.9'): Part => ({
  kind: 'data',
  data: {version, error},
});

describe('readInboundMessage: a client error', () => {
  it('reads a v0.9 VALIDATION_FAILED error', () => {
    const inbound = readInboundMessage(message([errorPart(ERROR)]), 'v0.9');
    assert.deepEqual(inbound.clientError, ERROR);
    assert.equal(inbound.action, undefined);
    assert.equal(inbound.text, '');
  });

  it('reads a generic error, which has no path', () => {
    const generic = {code: 'RENDER_FAILED', surfaceId: 'tickets', message: 'boom'};
    assert.deepEqual(readInboundMessage(message([errorPart(generic)]), 'v0.9').clientError, generic);
  });

  it('ignores an error in another version, or with a field missing', () => {
    assert.equal(readInboundMessage(message([errorPart(ERROR, 'v1.0')]), 'v0.9').clientError, undefined);
    const {path: _path, ...noPath} = ERROR;
    assert.equal(readInboundMessage(message([errorPart(noPath)]), 'v0.9').clientError, undefined);
    const {surfaceId: _s, ...noSurface} = ERROR;
    assert.equal(readInboundMessage(message([errorPart(noSurface)]), 'v0.9').clientError, undefined);
  });

  it('still reads an action next to it', () => {
    const inbound = readInboundMessage(
      message([{kind: 'data', data: {version: 'v0.9', action: {name: 'open_ticket', context: {}}}}]),
      'v0.9',
    );
    assert.equal(inbound.action?.name, 'open_ticket');
    assert.equal(inbound.clientError, undefined);
  });
});

describe('ClientRetries: one client-triggered retry per turn', () => {
  it('retries the last turn once, with the error in the query', () => {
    const retries = new ClientRetries();
    retries.remember('c1', {query: 'Show me the open tickets'});

    const first = retries.plan('c1', ERROR, 'direct_json');
    assert.equal(first.retry, true);
    assert.ok(first.retry);
    assert.equal(first.query, 'Show me the open tickets');
    assert.match(first.retryQuery, /^Your previous response was invalid\./);
    assert.ok(first.retryQuery.includes("VALIDATION_FAILED on surface 'tickets' at /tickets/0/priority"));
    assert.ok(first.retryQuery.includes("'Show me the open tickets'"));

    const second = retries.plan('c1', ERROR, 'direct_json');
    assert.deepEqual(second, {retry: false, reason: 'This turn was already retried once after a client report.'});
  });

  it('allows a retry again after a new user turn', () => {
    const retries = new ClientRetries();
    retries.remember('c1', {query: 'q1'});
    assert.equal(retries.plan('c1', ERROR, 'direct_json').retry, true);
    retries.remember('c1', {query: 'q2', actionName: 'open_ticket'});
    const plan = retries.plan('c1', ERROR, 'direct_json');
    assert.ok(plan.retry);
    assert.equal(plan.actionName, 'open_ticket');
  });

  it('does not retry without an earlier turn, or for an error that is not a validation failure', () => {
    const retries = new ClientRetries();
    assert.equal(retries.plan('c1', ERROR, 'direct_json').retry, false);
    retries.remember('c1', {query: 'q1'});
    assert.equal(retries.plan('c1', {code: 'RENDER_FAILED', surfaceId: 's', message: 'm'}, 'direct_json').retry, false);
    // The refused generic error did not use up the turn's retry.
    assert.equal(retries.plan('c1', ERROR, 'direct_json').retry, true);
  });
});

/** The stub that writes `critical` into the data model on a turn's first attempt. */
class RecordingStub extends StubBackend {
  readonly queries: string[] = [];
  constructor() {
    super('direct_json', loadTicketCatalogs(), undefined, false, false, true);
  }
  override async *streamTurn(input: TurnInput): AsyncIterable<string> {
    this.queries.push(input.query);
    yield* super.streamTurn(input);
  }
}

function recordConsole(t: TestContext, method: 'warn' | 'error'): string[] {
  const lines: string[] = [];
  const original = console[method];
  t.mock.method(console, method, (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
    original(...args);
  });
  return lines;
}

describe('the executor with STUB_CLIENT_INVALID', () => {
  async function turn(executor: RestaurantExecutor, parts: Part[]) {
    const events: TaskStatusUpdateEvent[] = [];
    const bus = {publish: (e: TaskStatusUpdateEvent) => events.push(e)} as unknown as ExecutionEventBus;
    const context = {taskId: crypto.randomUUID(), contextId: 'c1', userMessage: message(parts)} as unknown as RequestContext;
    await executor.execute(context, bus);
    const updates = events.filter(e => e.kind === 'status-update');
    const parts_ = updates.flatMap(e => e.status.message?.parts ?? []);
    return {
      updates,
      data: JSON.stringify(parts_.filter(p => p.kind === 'data')),
      texts: parts_.filter(p => p.kind === 'text').map(p => (p as {text: string}).text),
    };
  }

  it('lets the bad value through, retries once on the report, then falls back to text', async t => {
    const warnings = recordConsole(t, 'warn');
    const errors = recordConsole(t, 'error');
    const stub = new RecordingStub();
    const executor = new RestaurantExecutor('direct_json', stub, loadBasicCatalogs(), loadTicketCatalogs());

    // Turn 1: the agent's validation passes the reply; the data model carries `critical`.
    const first = await turn(executor, [{kind: 'text', text: 'Show me the open tickets'}]);
    assert.ok(first.data.includes('"priority":"critical"'));
    assert.ok(first.data.includes('"priority":{"path":"priority"}'));
    assert.equal(stub.queries.length, 1);
    assert.ok(!warnings.some(w => w.includes('A2UI validation failed')));

    // Turn 2: the renderer reports it; one retry, with the error, answers with a valid list.
    const second = await turn(executor, [errorPart(ERROR)]);
    assert.ok(
      warnings.includes(
        `--- A2UI client reported VALIDATION_FAILED on surface 'tickets' at /tickets/0/priority: ${ERROR.message} ---`,
      ),
    );
    assert.equal(stub.queries.length, 2);
    assert.match(stub.queries[1], /^Your previous response was invalid\. Validation failed: the renderer reported VALIDATION_FAILED/);
    assert.ok(stub.queries[1].endsWith("Please retry the original request: 'Show me the open tickets'"));
    assert.ok(second.data.includes('"priority":"urgent"'));
    assert.ok(!second.data.includes('critical'));
    assert.equal(second.updates.at(-1)!.status.state, 'input-required');

    // Turn 3: another report about the same turn: no model call, a text answer.
    const third = await turn(executor, [errorPart(ERROR)]);
    assert.equal(stub.queries.length, 2);
    assert.equal(third.data, '[]');
    assert.deepEqual(third.texts, [FALLBACK_TEXT]);
    assert.ok(errors.some(e => e.includes('already retried once after a client report')));
    assert.equal(third.updates.at(-1)!.status.state, 'input-required');
  });

  it('keeps the action name, so the detail view is the one retried', async () => {
    const stub = new RecordingStub();
    const executor = new RestaurantExecutor('direct_json', stub, loadBasicCatalogs(), loadTicketCatalogs());
    const open = {version: 'v0.9', action: {name: 'open_ticket', context: {ticketId: 'TCK-1042'}}};
    const first = await turn(executor, [{kind: 'data', data: open}]);
    assert.ok(first.data.includes('"priority":"critical"'));
    const second = await turn(executor, [errorPart({...ERROR, surfaceId: 'ticket-detail', path: '/ticket/priority'})]);
    assert.ok(second.data.includes('detail_priority'));
    assert.ok(!second.data.includes('critical'));
  });
});
