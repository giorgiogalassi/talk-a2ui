import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AgentClient } from '../agent/agent-client';
import { JsonLog } from './json-log';

/**
 * Demo: the A2UI messages the UI was just rendered from (stage 2, "the answer is JSON"), one
 * block per server-sent event so the streaming shows, plus the agent's text and any error event
 * (stage 6). Shown next to the surfaces while the panel's "Show JSON" switch is on; app.ts
 * renders it only then. On a narrow window it drops below the UI instead.
 */
@Component({
  selector: 'app-json-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <strong>A2UI messages</strong>
      <span class="count">{{ log.events().length }} {{ log.events().length === 1 ? 'event' : 'events' }}</span>
      <button type="button" class="close" (click)="log.visible.set(false)" aria-label="Hide the JSON">×</button>
    </header>
    @if (log.turn(); as turn) {
      <p class="turn">Last turn · {{ turn }}</p>
    }

    <div class="events" aria-live="off">
      @for (event of log.events(); track event.n) {
        <section class="event">
          <h3>event {{ event.n }}<small>{{ summary(event.messages.length) }}</small></h3>
          @for (message of event.messages; track $index) {
            <p class="kind">{{ message.kind }}</p>
            <pre>{{ message.json }}</pre>
          }
          @if (event.text; as text) {
            <p class="kind">text</p>
            <pre class="text">{{ text }}</pre>
          }
          @if (event.error; as error) {
            <p class="kind err">error</p>
            <pre class="text err">{{ error }}</pre>
          }
        </section>
      } @empty {
        <p class="empty">
          {{ !log.turn() ? 'Ask something: its messages show here.' : agent.isLoading() ? 'Waiting for the first event…' : 'No A2UI in this reply.' }}
        </p>
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--paper);
      font-size: 14px;
      line-height: 1.4;
    }
    /* Wide screens: a column of its own on the right, the page keeps the rest (styles.css). */
    @media (min-width: 900px) {
      :host {
        position: fixed;
        top: 16px;
        right: 16px;
        bottom: 16px;
        width: var(--json-drawer-width);
        z-index: 5;
      }
    }
    header { display: flex; align-items: baseline; gap: 10px; padding: 14px 16px 0; }
    header strong { font: 600 16px var(--font-display); letter-spacing: -0.02em; }
    .count { color: var(--muted); font-size: 12px; }
    .close { margin-left: auto; border: 0; background: none; font-size: 20px; line-height: 1; color: var(--muted); cursor: pointer; }
    .turn { margin: 4px 16px 10px; color: var(--muted); font-size: 13px; overflow-wrap: anywhere; }
    .events { flex: 1; min-height: 0; overflow: auto; padding: 0 16px 16px; }
    .event { padding-top: 12px; border-top: 1px solid var(--line-soft); }
    .event + .event { margin-top: 12px; }
    h3 { margin: 0 0 6px; font: 600 13px var(--font-body); color: var(--accent-text); text-transform: uppercase; letter-spacing: 0.04em; }
    h3 small { margin-left: 8px; color: var(--muted); font-weight: 400; text-transform: none; letter-spacing: 0; }
    .kind { margin: 8px 0 4px; font: 600 13px var(--font-body); color: var(--ink); }
    .kind.err, .err { color: var(--accent-text); }
    pre {
      margin: 0;
      padding: 10px 12px;
      border-radius: 8px;
      background: var(--cream);
      color: var(--ink);
      font: 15px/1.45 ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
      /* Wrapped, not scrolled sideways: long ids and URLs stay readable on a projector. */
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    pre.text { font-family: var(--font-body); }
    pre.err { background: var(--accent-tint); }
    .empty { margin: 12px 0 0; color: var(--muted); }
  `,
})
export class JsonDrawer {
  protected readonly log = inject(JsonLog);
  protected readonly agent = inject(AgentClient);

  protected summary(count: number): string {
    return count === 1 ? '1 message' : `${count} messages`;
  }
}
