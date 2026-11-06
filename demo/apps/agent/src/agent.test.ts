// Demo: proves that a prop outside the ticket catalog fails @a2ui/agent's validation and
// triggers the executor's one retry (MAX_ATTEMPTS = 2), on both the streamed and the
// non-streamed path. Runs the real RestaurantExecutor with the real catalogs; only the model
// is replaced, by a backend that answers each attempt with a scripted text.

import assert from 'node:assert/strict';
import path from 'node:path';
import {describe, it, type TestContext} from 'node:test';

import type {Message, TaskStatusUpdateEvent} from '@a2a-js/sdk';
import type {ExecutionEventBus, RequestContext} from '@a2a-js/sdk/server';
import {A2uiGenerator, CatalogConfig, DirectJsonFormatFactory} from '@a2ui/agent';
import {TICKET_CATALOG_ID} from '@demo/catalog';

import {RestaurantExecutor} from './agent.js';
import {loadBasicCatalogs, loadTicketCatalogs} from './catalogs.js';
import {readMessages, toResponseText} from './examples.js';
import {leakInternalNotes, type ModelBackend, type TurnInput} from './model.js';
import {FALLBACK_TEXT} from './prompt.js';
import {getPackageRootDir} from './tools.js';
import {V0_9} from './versions.js';

const ticketCatalog = loadTicketCatalogs().get('v0.9')!;

/** The ticket list example as the model would write it, optionally with a wrong priority. */
function ticketListText(priority?: unknown): string {
  const messages = readMessages(
    path.join(getPackageRootDir(), 'examples', 'v0.9', 'ticket_list.json'),
  );
  if (priority !== undefined) {
    const update = messages[1] as {updateComponents: {components: Record<string, unknown>[]}};
    const badge = update.updateComponents.components.find(c => c.component === 'PriorityBadge')!;
    badge.priority = priority;
  }
  return toResponseText(V0_9, ticketCatalog, 'direct_json', messages);
}

/** A model that answers attempt n with replies[n], in four chunks, and records each query. */
class ScriptedBackend implements ModelBackend {
  readonly queries: string[] = [];
  constructor(
    private readonly replies: string[],
    // Demo: a fixed chunk size instead of four chunks, for the policy tests.
    private readonly chunkSize?: number,
  ) {}
  async *streamTurn({query}: TurnInput): AsyncIterable<string> {
    const text = this.replies[this.queries.length];
    this.queries.push(query);
    const size = this.chunkSize ?? Math.ceil(text.length / 4);
    for (let i = 0; i < text.length; i += size) yield text.substring(i, i + size);
  }
}

/** Runs one turn through the executor and returns the published status updates. */
async function runTurn(backend: ModelBackend, useStreaming: boolean) {
  const executor = new RestaurantExecutor(
    'direct_json',
    backend,
    loadBasicCatalogs(),
    loadTicketCatalogs(),
  );
  const userMessage: Message = {
    kind: 'message',
    messageId: 'm1',
    role: 'user',
    parts: [
      {kind: 'text', text: 'Show me the open tickets'},
      {kind: 'data', data: {useStreaming}},
    ],
    metadata: {a2uiClientCapabilities: {'v0.9': {supportedCatalogIds: [TICKET_CATALOG_ID]}}},
  };
  const events: TaskStatusUpdateEvent[] = [];
  const bus = {
    publish: (e: TaskStatusUpdateEvent) => events.push(e),
  } as unknown as ExecutionEventBus;
  const context = {taskId: 't1', contextId: 'c1', userMessage} as unknown as RequestContext;
  await executor.execute(context, bus);
  return events.filter(e => e.kind === 'status-update');
}

/** The A2UI messages carried by the status updates, in order. */
function a2uiMessages(events: TaskStatusUpdateEvent[]): Record<string, unknown>[] {
  return events.flatMap(e =>
    (e.status.message?.parts ?? [])
      .filter(p => p.kind === 'data')
      .map(p => (p as {data: Record<string, unknown>}).data),
  );
}

/** Records console.warn calls and still prints them, so the log lines show in the test output. */
function recordWarnings(t: TestContext): string[] {
  const lines: string[] = [];
  const original = console.warn;
  t.mock.method(console, 'warn', (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
    original(...args);
  });
  return lines;
}

const PRIORITY_ERROR =
  "Validation failed for component 'PriorityBadge' (ticket_priority): priority: Invalid enum value. Expected low | medium | high | urgent, received 'critical'";

/** Demo: a model whose first call fails like Gemini under load, then answers with replies[0]. */
class OverloadedOnceBackend implements ModelBackend {
  readonly queries: string[] = [];
  constructor(private readonly reply: string) {}
  async *streamTurn({query}: TurnInput): AsyncIterable<string> {
    this.queries.push(query);
    if (this.queries.length === 1) {
      throw new Error(
        '{"error":{"message":"{\\n  \\"error\\": {\\n    \\"code\\": 503,\\n    \\"message\\": \\"This model is currently experiencing high demand.\\"}}","code":503,"status":"Service Unavailable"}}',
      );
    }
    yield this.reply;
  }
}

describe('a failed model call (Gemini 503)', () => {
  it('is logged as a model error, not a validation failure, and retries the original query', async t => {
    const warnings = recordWarnings(t);
    const backend = new OverloadedOnceBackend(ticketListText());

    const events = await runTurn(backend, true);

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /^--- Model call failed: 503 .*\(Attempt 1\) ---$/);
    assert.ok(!warnings[0].includes('A2UI validation failed'));
    assert.deepEqual(backend.queries, ['Show me the open tickets', 'Show me the open tickets']);
    assert.equal(events.at(-1)!.status.state, 'input-required');
  });
});

for (const useStreaming of [false, true]) {
  describe(`a prop outside the catalog (${useStreaming ? 'streamed' : 'non-streamed'})`, () => {
    it('fails validation on attempt 1 and is retried with the error', async t => {
      const warnings = recordWarnings(t);
      const backend = new ScriptedBackend([ticketListText('critical'), ticketListText()]);

      const events = await runTurn(backend, useStreaming);

      // Attempt 1 failed with the catalog's own enum error.
      assert.equal(warnings.length, 1);
      assert.ok(warnings[0].startsWith(`--- A2UI validation failed: ${PRIORITY_ERROR}`), warnings[0]);
      assert.ok(warnings[0].endsWith('(Attempt 1) ---'), warnings[0]);

      // Attempt 2 was asked with that error in its query.
      assert.equal(backend.queries.length, 2);
      assert.ok(
        backend.queries[1].startsWith(
          `Your previous response was invalid. Validation failed: ${PRIORITY_ERROR}`,
        ),
        backend.queries[1],
      );
      assert.ok(backend.queries[1].endsWith("Please retry the original request: 'Show me the open tickets'"));

      // The turn ends with attempt 2's valid UI, and no wrong priority reached the client.
      const final = events.at(-1)!;
      assert.equal(final.final, true);
      assert.equal(final.status.state, 'input-required');
      const messages = a2uiMessages(events);
      assert.ok(messages.some(m => JSON.stringify(m).includes('"component":"PriorityBadge"')));
      assert.ok(!messages.some(m => JSON.stringify(m).includes('critical')));
    });

    it('falls back to text when both attempts are invalid', async t => {
      const warnings = recordWarnings(t);
      t.mock.method(console, 'error', () => {});
      const backend = new ScriptedBackend([ticketListText('critical'), ticketListText('p0')]);

      const events = await runTurn(backend, useStreaming);

      assert.equal(backend.queries.length, 2);
      assert.equal(warnings.length, 2);
      assert.match(warnings[1], /received 'p0'.*\(Attempt 2\) ---$/);
      const final = events.at(-1)!;
      const texts = (final.status.message?.parts ?? []).filter(p => p.kind === 'text');
      assert.deepEqual(texts, [{kind: 'text', text: FALLBACK_TEXT}]);
    });
  });
}

// Demo: step 5. The policy runs in answer() on what the stream emits and on the validated
// whole reply, so a forbidden field never reaches the client, not even in a re-send of a
// message that is still growing.
describe('the server-side policy', () => {
  /** A leaky example, as a careless model would write it: notes in the data, Delete button. */
  function leakyText(name: string): string {
    const root = getPackageRootDir();
    const messages = leakInternalNotes(readMessages(path.join(root, 'examples', 'v0.9', `${name}.json`)), root);
    return toResponseText(V0_9, ticketCatalog, 'direct_json', messages);
  }
  const CHUNK = 80;
  const chunks = (text: string) => text.match(new RegExp(`[\\s\\S]{1,${CHUNK}}`, 'g'))!;
  const leaks = (m: unknown) => /internal_notes|delete_ticket/.test(JSON.stringify(m));
  const isData = (m: Record<string, unknown>) => 'updateDataModel' in m;

  function recordLog(t: TestContext): string[] {
    const lines: string[] = [];
    t.mock.method(console, 'log', (...args: unknown[]) => lines.push(args.map(String).join(' ')));
    return lines;
  }

  it('without it, the raw stream emits internal_notes in an intermediate re-send', () => {
    const processor = new A2uiGenerator([
      new CatalogConfig(loadBasicCatalogs().get('v0.9')!),
      new CatalogConfig(ticketCatalog),
    ]).createProcessor({supportedCatalogIds: [TICKET_CATALOG_ID]}, new DirectJsonFormatFactory());
    const stream = processor.openStream();
    const emitted: Record<string, unknown>[] = [];
    for (const chunk of chunks(leakyText('ticket_list'))) {
      for (const part of stream.feed(chunk)) if (part.type === 'a2ui') emitted.push(...(part.a2ui as never[]));
    }
    for (const part of stream.close()) if (part.type === 'a2ui') emitted.push(...(part.a2ui as never[]));

    const data = emitted.filter(isData);
    assert.ok(data.length > 2, `${data.length} updateDataModel re-sends`);
    // A re-send before the last one already carries a ticket's notes.
    assert.ok(data.slice(0, -1).some(m => JSON.stringify(m).includes('internal_notes')));
  });

  for (const name of ['ticket_list', 'ticket_detail']) {
    it(`streamed (${name}): no published message carries internal_notes or delete_ticket`, async t => {
      const log = recordLog(t);
      const events = await runTurn(new ScriptedBackend([leakyText(name)], CHUNK), true);

      const messages = a2uiMessages(events);
      assert.ok(messages.filter(isData).length > 1, 'the data model was re-sent as it grew');
      assert.deepEqual(messages.filter(leaks), []);
      assert.ok(log.some(l => /^--- policy: stripped \/tickets?\/(\d+\/)?internal_notes ---$/.test(l)), log.join('\n'));
      if (name === 'ticket_detail') {
        assert.ok(log.includes('--- policy: removed Button delete_button (action delete_ticket) ---'));
        assert.ok(messages.some(m => JSON.stringify(m).includes('resolve_button')));
      }
      assert.equal(events.at(-1)!.status.state, 'input-required');
    });

    it(`non-streamed (${name}): the validated reply is filtered the same way`, async t => {
      const log = recordLog(t);
      const events = await runTurn(new ScriptedBackend([leakyText(name)], CHUNK), false);

      const messages = a2uiMessages(events);
      assert.equal(messages.filter(isData).length, 1);
      assert.deepEqual(messages.filter(leaks), []);
      assert.ok(log.some(l => l.startsWith('--- policy: stripped ')), log.join('\n'));
      if (name === 'ticket_detail') {
        assert.ok(log.includes('--- policy: removed Button delete_button (action delete_ticket) ---'));
      }
    });
  }
});
