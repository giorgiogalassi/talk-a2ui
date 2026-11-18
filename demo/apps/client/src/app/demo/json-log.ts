import { Injectable, signal } from '@angular/core';

/** One A2UI message as the drawer prints it: its type (createSurface, ...) and the JSON. */
export interface LoggedMessage {
  kind: string;
  json: string;
}

/** One server-sent event of the reply, without the session id. */
export interface LoggedEvent {
  /** 1-based, in arrival order. */
  n: number;
  messages: LoggedMessage[];
  text?: string;
  error?: string;
}

/** What one SSE `data:` line of POST /api/agent carries (server.ts). */
export interface ReplyEvent {
  messages?: object[];
  text?: string;
  error?: string;
  sessionId?: string;
}

/**
 * Demo: the A2UI messages of the last turn, for the "Show JSON" drawer (stage 2). DevTools can't
 * show them: AgentClient reads POST /api/agent with fetch() and a stream reader, so Network has
 * no EventStream tab and no response body. AgentClient starts a turn on every request (prompt,
 * click, VALIDATION_FAILED retry) and adds each event as it arrives. Client-only: the switch is
 * not one of the agent's /demo/flags.
 */
@Injectable({ providedIn: 'root' })
export class JsonLog {
  /** The panel's "Show JSON" switch. Off by default. */
  readonly visible = signal(false);
  /** What started the last turn, e.g. `Prompt: "Show me the open tickets"`. */
  readonly turn = signal<string | null>(null);
  readonly events = signal<LoggedEvent[]>([]);

  /** A new request: forgets the previous turn. */
  start(turn: string): void {
    this.turn.set(turn);
    this.events.set([]);
  }

  /** One event of the reply, in arrival order. The session id is left out. */
  add(event: ReplyEvent): void {
    const logged: LoggedEvent = {
      n: this.events().length + 1,
      messages: (event.messages ?? []).map((message) => ({ kind: kindOf(message), json: JSON.stringify(message, null, 2) })),
    };
    if (event.text) logged.text = event.text;
    if (event.error) logged.error = event.error;
    if (!logged.messages.length && !logged.text && !logged.error) return;
    this.events.update((events) => [...events, logged]);
  }
}

/** A v0.9 message has `version` and one key that names it. */
function kindOf(message: object): string {
  return Object.keys(message).find((key) => key !== 'version') ?? 'message';
}
