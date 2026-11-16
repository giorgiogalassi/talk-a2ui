import { TestBed } from '@angular/core/testing';
import { BasicCatalog, provideA2Ui, provideMarkdownRenderer } from '@a2ui/angular/v0_9';
import { renderMarkdown } from '@a2ui/markdown-it';
import { AgentClient } from './agent-client';
import { createTicketCatalog } from '../catalog/ticket-catalog';

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
});
