import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { A2uiRendererService, BasicCatalog, provideA2Ui, provideMarkdownRenderer, SurfaceComponent } from '@a2ui/angular/v0_9';
import { renderMarkdown } from '@a2ui/markdown-it';
import { PriorityBadgeApi, TICKET_CATALOG_ID } from '@demo/catalog';
import { AgentClient } from './agent-client';
import { createTicketCatalog } from './catalog/ticket-catalog';
import { absolutePath, resolvedValueProblem } from './catalog/resolved-value';
import { ValidationIssues } from './validation-issues';

// Demo: phase 6. What the renderer does with a reply it partly rejects, and what it reports.

/** A ticket list as the agent sends it; `priority` is the PriorityBadge's prop. */
function ticketList(priority: unknown, dataPriority = 'urgent'): unknown[] {
  return [
    { version: 'v0.9', createSurface: { surfaceId: 'tickets', catalogId: TICKET_CATALOG_ID } },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'tickets',
        components: [
          { id: 'root', component: 'TicketList', title: 'Open tickets', children: { componentId: 'row', path: '/tickets' } },
          { id: 'row', component: 'Row', children: ['ticket_title', 'ticket_priority'] },
          { id: 'ticket_title', component: 'Text', text: { path: 'title' } },
          { id: 'ticket_priority', component: 'PriorityBadge', priority },
        ],
      },
    },
    {
      version: 'v0.9',
      updateDataModel: {
        surfaceId: 'tickets',
        path: '/',
        value: { tickets: [{ title: 'Checkout fails', priority: dataPriority }] },
      },
    },
  ];
}

/** A fetch that answers each POST /a2a with the next SSE body, and records the request bodies. */
function fakeAgent(replies: unknown[][]) {
  const bodies: Record<string, unknown>[] = [];
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(init.body as string));
    const messages = replies[bodies.length - 1] ?? [];
    const sse = `data: ${JSON.stringify({ messages, sessionId: 's1' })}\n\n`;
    return new Response(sse, { headers: { 'Content-Type': 'text/event-stream' } });
  });
  vi.stubGlobal('fetch', fetch);
  return bodies;
}

@Component({
  imports: [SurfaceComponent],
  template: `@for (entry of renderer.surfaceGroup.surfacesMap; track entry[0]) {
    <a2ui-v09-surface [surfaceId]="entry[0]" />
  }`,
})
class Host {
  protected readonly renderer = inject(A2uiRendererService);
}

describe('client-side validation (phase 6)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideA2Ui(() => ({ catalogs: [createTicketCatalog(), new BasicCatalog()] })),
        provideMarkdownRenderer(renderMarkdown as any),
      ],
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('resolvedValueProblem', () => {
    it('refuses a bound priority that resolves outside the enum, with its absolute path', () => {
      const problem = resolvedValueProblem(PriorityBadgeApi, 'priority', { path: 'priority' }, 'critical', '/tickets/0');
      expect(problem?.path).toBe('/tickets/0/priority');
      expect(problem?.message).toContain('priority resolved to "critical" from /tickets/0/priority');
      expect(problem?.message).toContain('low | medium | high | urgent');
    });

    it('passes a valid value, a value not streamed in yet, and a literal', () => {
      expect(resolvedValueProblem(PriorityBadgeApi, 'priority', { path: 'priority' }, 'high', '/tickets/0')).toBeNull();
      expect(resolvedValueProblem(PriorityBadgeApi, 'priority', { path: 'priority' }, undefined, '/tickets/0')).toBeNull();
      expect(resolvedValueProblem(PriorityBadgeApi, 'priority', 'high', 'high', '/')).toBeNull();
    });

    it('keeps an absolute binding as it is', () => {
      expect(absolutePath('/ticket/priority', '/')).toBe('/ticket/priority');
      expect(absolutePath('priority', '/')).toBe('/priority');
    });
  });

  it('web_core rejects a component: the rest renders, a placeholder takes its place, the agent is told', async () => {
    const bodies = fakeAgent([ticketList('critical'), ticketList({ path: 'priority' })]);
    const client = TestBed.inject(AgentClient);
    const renderer = TestBed.inject(A2uiRendererService);

    // web_core alone throws on this reply: the component check runs before anything is applied.
    await client.ask('Show me the open tickets');

    expect(bodies[0]).toEqual({ query: 'Show me the open tickets' });
    expect(bodies[1]).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        surfaceId: 'tickets',
        path: '/components/3/priority',
        message: expect.stringContaining("Validation failed for component 'PriorityBadge' (ticket_priority)"),
      },
      sessionId: 's1',
    });
    // The corrected reply replaced the surface: the badge is a PriorityBadge again.
    const components = renderer.surfaceGroup.getSurface('tickets')!.componentsModel;
    expect(components.get('ticket_priority')!.type).toBe('PriorityBadge');
    expect(bodies.length).toBe(2);
  });

  it('keeps the valid components and a placeholder when the retry is not corrected', async () => {
    const bodies = fakeAgent([ticketList('critical'), []]);
    const client = TestBed.inject(AgentClient);
    const renderer = TestBed.inject(A2uiRendererService);

    await client.ask('Show me the open tickets');

    expect(bodies.length).toBe(2);
    // The agent answered the report with no UI: the partly rejected surface is still there.
    const components = renderer.surfaceGroup.getSurface('tickets')!.componentsModel;
    expect(components.get('root')!.type).toBe('TicketList');
    expect(components.get('ticket_title')!.type).toBe('Text');
    expect(components.get('ticket_priority')!.type).toBe('Text');
    expect(components.get('ticket_priority')!.properties['text']).toContain('could not be shown');
  });

  it('a bound value the catalog forbids: the badge shows a placeholder and the agent is told', async () => {
    const fixture = TestBed.createComponent(Host);
    const bodies = fakeAgent([ticketList({ path: 'priority' }, 'critical'), []]);
    const client = TestBed.inject(AgentClient);

    await client.ask('Show me the open tickets');
    await fixture.whenStable();

    expect(bodies[1]).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        surfaceId: 'tickets',
        path: '/tickets/0/priority',
        message: expect.stringContaining('PriorityBadge (ticket_priority): priority resolved to "critical"'),
      },
      sessionId: 's1',
    });
    const html = fixture.nativeElement as HTMLElement;
    expect(html.textContent).toContain('Checkout fails');
    expect(html.querySelector('.priority-badge.invalid')?.textContent).toBe('?');
  });

  it('reports at most twice without a user action in between', async () => {
    TestBed.createComponent(Host);
    const bodies = fakeAgent([ticketList('critical'), ticketList('critical'), ticketList('critical')]);
    await TestBed.inject(AgentClient).ask('Show me the open tickets');
    expect(bodies.filter((b) => b['error']).length).toBe(2);
    expect(TestBed.inject(ValidationIssues).list().length).toBe(1);
  });
});
