import { TestBed } from '@angular/core/testing';
import { A2uiRendererService, BasicCatalog, provideA2Ui, provideMarkdownRenderer } from '@a2ui/angular/v0_9';
import { renderMarkdown } from '@a2ui/markdown-it';
import { AgentClient } from './agent-client';
import { createTicketCatalog } from '../catalog/ticket-catalog';
import { JsonLog } from '../demo/json-log';
import { TICKET_CATALOG_ID } from '@demo/catalog';

// Demo: AgentClient on the paths that matter on stage: one turn at a time, and readable errors.

describe('AgentClient', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideA2Ui(() => ({ catalogs: [createTicketCatalog(), new BasicCatalog()] })),
        provideMarkdownRenderer(renderMarkdown as any),
      ],
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('ignores a click while a turn is still running', async () => {
    let release!: () => void;
    const fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(new Response('data: {"messages":[],"sessionId":"s1"}\n\n'));
        }),
    );
    vi.stubGlobal('fetch', fetch);
    const agent = TestBed.inject(AgentClient);

    const first = agent.ask('Show me the open tickets');
    await agent.handleAction({ name: 'open_ticket', surfaceId: 's', sourceComponentId: 'b', timestamp: '', context: {} } as any);
    await agent.ask('again');
    release();
    await first;

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('shows the server message, or the status when the body is not JSON', async () => {
    const agent = TestBed.inject(AgentClient);

    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'The agent is not reachable. Is it running?' }, { status: 502 })));
    await agent.ask('x');
    expect(agent.error()).toBe('The agent is not reachable. Is it running?');

    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' })));
    await agent.ask('x');
    expect(agent.error()).toBe('The server answered 502 Bad Gateway.');

    vi.stubGlobal('fetch', vi.fn(async () => Response.json({}, { status: 500 })));
    await agent.ask('x');
    expect(agent.error()).toBe('The server answered 500.');
  });

  describe('the previous turn\'s surfaces', () => {
    /** An SSE body: each event is `{ messages, text? }`, as server.ts writes it. */
    const sse = (...events: { messages: unknown[]; text?: string; error?: string }[]) =>
      new Response(events.map((e) => `data: ${JSON.stringify({ ...e, sessionId: 's1' })}\n\n`).join(''));
    const create = (surfaceId: string) => ({ version: 'v0.9', createSurface: { surfaceId, catalogId: TICKET_CATALOG_ID } });
    const surfaces = () => Array.from(TestBed.inject(A2uiRendererService).surfaceGroup.surfacesMap.keys());

    /** A Stub turn's screen: the notice and the ticket list. */
    async function stubTurn(agent: AgentClient) {
      vi.stubGlobal('fetch', vi.fn(async () => sse({ messages: [create('stub-notice'), create('tickets')] })));
      await agent.ask('Show me the open tickets');
      expect(surfaces()).toEqual(['stub-notice', 'tickets']);
    }

    it('go when a prompt is answered with text only (the fallback after a model failure)', async () => {
      const agent = TestBed.inject(AgentClient);
      await stubTurn(agent);

      vi.stubGlobal('fetch', vi.fn(async () => sse({ messages: [], text: 'Please try again in a moment.' })));
      await agent.ask('Show me the open tickets');

      expect(agent.agentText()).toBe('Please try again in a moment.');
      expect(surfaces()).toEqual([]);
    });

    it('go when the turn fails before any A2UI: an error event, or a failed request', async () => {
      const agent = TestBed.inject(AgentClient);
      await stubTurn(agent);
      vi.stubGlobal('fetch', vi.fn(async () => sse({ messages: [], error: 'Agent error' })));
      await agent.ask('again');
      expect(agent.error()).toBe('Agent error');
      expect(surfaces()).toEqual([]);

      await stubTurn(agent);
      vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'The agent is not reachable. Is it running?' }, { status: 502 })));
      await agent.handleAction({ name: 'open_ticket', surfaceId: 'tickets', sourceComponentId: 'b', timestamp: '', context: {} } as any);
      expect(agent.error()).toBe('The agent is not reachable. Is it running?');
      expect(surfaces()).toEqual([]);
    });

    it('are swapped for the new ones when the reply carries A2UI, text or not', async () => {
      const agent = TestBed.inject(AgentClient);
      await stubTurn(agent);
      const before = TestBed.inject(A2uiRendererService).surfaceGroup.getSurface('tickets');

      vi.stubGlobal('fetch', vi.fn(async () => sse({ messages: [create('ticket-detail')] }, { messages: [], text: 'Done.' })));
      await agent.ask('Open the first one');

      expect(surfaces()).toEqual(['ticket-detail']);
      expect(agent.agentText()).toBe('Done.');

      // A reply re-creating the same id gets a new surface, as before.
      vi.stubGlobal('fetch', vi.fn(async () => sse({ messages: [create('tickets')] })));
      await agent.ask('Show me the open tickets');
      expect(surfaces()).toEqual(['tickets']);
      expect(TestBed.inject(A2uiRendererService).surfaceGroup.getSurface('tickets')).not.toBe(before);
    });

    it('stay on screen, dimmed, while the turn has sent nothing yet', async () => {
      const agent = TestBed.inject(AgentClient);
      await stubTurn(agent);
      let release!: () => void;
      vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => (release = () => resolve(sse({ messages: [], text: 'Sorry.' }))))));

      const turn = agent.ask('again');
      await Promise.resolve();
      expect(agent.waitingForUi()).toBe(true);
      expect(surfaces()).toEqual(['stub-notice', 'tickets']);

      release();
      await turn;
      expect(surfaces()).toEqual([]);
    });
  });

  it('logs each event of the last turn for the JSON drawer, and starts over on the next request', async () => {
    const reply = (surfaceId: string) =>
      new Response(
        `data: ${JSON.stringify({ messages: [{ version: 'v0.9', createSurface: { surfaceId, catalogId: TICKET_CATALOG_ID } }], sessionId: 's1' })}\n\n` +
          `data: ${JSON.stringify({ messages: [], text: 'Done.', sessionId: 's1' })}\n\n`,
      );
    vi.stubGlobal('fetch', vi.fn(async () => reply('first')));
    const agent = TestBed.inject(AgentClient);
    const log = TestBed.inject(JsonLog);
    await agent.ask('Show me the open tickets');
    expect(log.turn()).toBe('Prompt: "Show me the open tickets"');
    expect(log.events().map((e) => [e.messages.length, e.text])).toEqual([[1, undefined], [0, 'Done.']]);
    expect(log.events()[0].messages[0].json).toContain('"first"');

    vi.stubGlobal('fetch', vi.fn(async () => reply('second')));
    await agent.handleAction({ name: 'open_ticket', surfaceId: 's', sourceComponentId: 'b', timestamp: '', context: {} } as any);
    expect(log.turn()).toBe('Action: open_ticket');
    expect(JSON.stringify(log.events())).not.toContain('"first"');
    expect(log.events()[0].messages[0].json).toContain('"second"');
  });
});
