import { ApplicationRef, Injectable, inject, signal } from '@angular/core';
import { A2uiRendererService } from '@a2ui/angular/v0_9';
import { A2uiClientAction, A2uiClientError, A2uiMessage, A2uiValidationError } from '@a2ui/web_core/v0_9';
import { ValidationIssue, ValidationIssues } from './validation-issues';

/** Demo: what the renderer reports to the agent, the v0.9 client-to-server `error`. */
type ValidationFailed = Extract<A2uiClientError, { code: 'VALIDATION_FAILED' }>;

/**
 * Demo: reports in a row without a user action in between. The agent allows one retry per
 * turn and answers a second report with text (no UI, so nothing left to report); this cap only
 * stops a loop with an agent that doesn't.
 */
const MAX_REPORTS = 2;

/** Demo: what a component web_core rejected becomes, so the rest of the surface still renders. */
const PLACEHOLDER_TEXT = '⚠ This part of the answer could not be shown.';

/**
 * Talks to this app's own server (POST /a2a), never to the agent directly.
 * Reads the server-sent events, each carrying plain A2UI messages, and hands them to the
 * renderer. Knows nothing of the transport between the server and the agent: `/a2a` is only
 * the route's name, kept as the contract with server.ts. Adapted from the official A2UI Angular sample (Apache-2.0).
 */
@Injectable({ providedIn: 'root' })
export class AgentClient {
  private readonly renderer = inject(A2uiRendererService);
  private readonly issues = inject(ValidationIssues);
  private readonly appRef = inject(ApplicationRef);
  /** Demo: VALIDATION_FAILED reports sent since the user's last prompt or action. */
  private reports = 0;
  /** The conversation's id, opaque here: the server maps it to the transport's own. */
  private sessionId?: string;

  readonly isLoading = signal(false);
  /**
   * Demo: true from the request until the first A2UI message arrives. A live turn can take
   * 10+ s before anything streams (README, "Latency"), and the old UI is already cleared.
   */
  readonly waitingForUi = signal(false);
  readonly error = signal<string | null>(null);

  /** A new prompt replaces whatever the agent rendered before. */
  ask(query: string): Promise<void> {
    this.reports = 0;
    return this.send({ query });
  }

  /** A button action goes back to the agent, which answers with more A2UI messages. */
  handleAction(event: A2uiClientAction): Promise<void> {
    this.reports = 0;
    return this.send({ event });
  }

  private async send(body: { query?: string; event?: unknown; error?: ValidationFailed }): Promise<void> {
    // Every reply carries its whole UI, createSurface included (@a2ui/agent 0.0.2 checks each
    // reply against a fresh state), so any interaction clears the old surfaces first, as the
    // official Angular sample does.
    // Demo: not for an error report. The surface the renderer partly rejected stays on screen
    // until the corrected one replaces it (its createSurface does, see handleEvent).
    if (!body.error) {
      for (const surfaceId of Array.from(this.renderer.surfaceGroup.surfacesMap.keys())) {
        this.renderer.surfaceGroup.deleteSurface(surfaceId);
      }
    }
    // Demo: only this reply's problems are reported.
    this.issues.clear();
    let complete = false;
    this.isLoading.set(true);
    this.waitingForUi.set(true);
    this.error.set(null);
    try {
      const response = await fetch('/a2a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, sessionId: this.sessionId }),
      });
      if (!response.ok || !response.body) {
        throw new Error(((await response.json()) as { error: string }).error);
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const event of events) {
          if (event.startsWith('data: ')) this.handleEvent(JSON.parse(event.slice(6)));
        }
      }
      complete = true;
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.isLoading.set(false);
      this.waitingForUi.set(false);
    }
    if (complete) await this.reportIssues();
  }

  /**
   * Demo: once the reply has rendered, tells the agent what the renderer could not show, as
   * one v0.9 `VALIDATION_FAILED` error (the first issue; the message counts the others).
   * web_core 0.14.0 does not send this itself: it throws, or (for a bound value) checks
   * nothing, and has no channel to the agent for errors.
   */
  private async reportIssues(): Promise<void> {
    // The components of this reply check their resolved values as they render.
    await this.appRef.whenStable();
    const [first, ...rest] = this.issues.list();
    if (!first) return;
    if (this.reports >= MAX_REPORTS) {
      console.warn('[a2ui] VALIDATION_FAILED not reported again:', first);
      return;
    }
    this.reports++;
    const error: ValidationFailed = {
      code: 'VALIDATION_FAILED',
      surfaceId: first.surfaceId,
      path: first.path,
      message: rest.length ? `${first.message} (and ${rest.length} more like it)` : first.message,
    };
    console.warn('[a2ui] reporting VALIDATION_FAILED to the agent:', error);
    await this.send({ error });
  }

  private handleEvent(event: { messages?: A2uiMessage[]; sessionId?: string; error?: string }) {
    if (event.error) throw new Error(event.error);
    if (event.sessionId) this.sessionId = event.sessionId;

    const messages = event.messages ?? [];
    // A retried reply starts over with its own createSurface, while the failed attempt may have
    // created that surface already when streaming. The newer createSurface replaces it.
    for (const message of messages) {
      const surfaceId = 'createSurface' in message ? message.createSurface.surfaceId : undefined;
      if (surfaceId && this.renderer.surfaceGroup.surfacesMap.has(surfaceId)) {
        this.renderer.surfaceGroup.deleteSurface(surfaceId);
      }
    }
    if (messages.length > 0) {
      this.waitingForUi.set(false);
      // Demo: one message at a time, so a rejected one doesn't take the rest of the event with it.
      for (const message of messages) this.process(message);
    }
  }

  /**
   * Demo: hands one message to the renderer. web_core validates an `updateComponents` against
   * the catalog's Zod and, if any component fails, throws an A2uiValidationError and applies
   * none of them. Then each component is applied on its own and the ones that fail are replaced
   * by a placeholder Text with the same id, so the surface keeps the valid ones; each failure
   * is filed for the report. Other errors end the reply, as before.
   */
  private process(message: A2uiMessage): void {
    if (!('updateComponents' in message)) {
      this.renderer.processMessages([message]);
      return;
    }
    const { surfaceId, components } = message.updateComponents;
    try {
      this.renderer.processMessages([message]);
      // A later, valid re-send of a growing message withdraws an earlier rejection.
      for (const component of components) this.issues.set(rejectedKey(surfaceId, component['id']), null);
      return;
    } catch (error) {
      if (!(error instanceof A2uiValidationError)) throw error;
    }
    components.forEach((component, index) => {
      const id = component['id'];
      const one = (c: typeof component): A2uiMessage => ({ ...message, updateComponents: { surfaceId, components: [c] } });
      try {
        this.renderer.processMessages([one(component)]);
        this.issues.set(rejectedKey(surfaceId, id), null);
      } catch (error) {
        if (!(error instanceof A2uiValidationError)) throw error;
        this.issues.set(rejectedKey(surfaceId, id), rejection(surfaceId, index, error));
        console.warn(`[a2ui] web_core rejected component '${id}':`, error.message);
        this.renderer.processMessages([one({ id, component: 'Text', variant: 'caption', text: PLACEHOLDER_TEXT })]);
      }
    });
  }
}

function rejectedKey(surfaceId: string, componentId: unknown): string {
  return `${surfaceId}#${componentId}`;
}

/**
 * Demo: the issue for a component web_core rejected. The path points into the message, as in
 * the spec's example (`/components/0/text`), down to the first failing prop when Zod names it.
 */
function rejection(surfaceId: string, index: number, error: A2uiValidationError): ValidationIssue {
  const issues = Array.isArray(error.details) ? (error.details as { path?: (string | number)[] }[]) : [];
  const prop = issues[0]?.path?.length ? `/${issues[0].path.join('/')}` : '';
  return { surfaceId, path: `/components/${index}${prop}`, message: error.message };
}
