/*
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Modified for the talk-a2ui demo (2026): changes are marked "Demo:".
 * Original: https://github.com/a2ui-project/a2ui/blob/0af1b1e7/samples/client/angular/projects/restaurant/src/app/client.ts
 */

import { ApplicationRef, Injectable, inject, signal } from '@angular/core';
import { A2uiRendererService } from '@a2ui/angular/v0_9';
import { A2uiClientAction, A2uiClientError, A2uiMessage, A2uiValidationError } from '@a2ui/web_core/v0_9';
import { ValidationIssue, ValidationIssues } from './validation-issues';
import { JsonLog } from '../demo/json-log';

/** Demo: what the renderer reports to the agent, the v0.9 client-to-server `error`. */
type ValidationFailed = Extract<A2uiClientError, { code: 'VALIDATION_FAILED' }>;

/** One `data:` event of POST /api/agent, as server.ts writes it. */
type ServerEvent = { messages?: A2uiMessage[]; text?: string; sessionId?: string; error?: string };

/**
 * Demo: reports in a row without a user action in between. The agent allows one retry per
 * turn and answers a second report with text (no UI, so nothing left to report); this cap only
 * stops a loop with an agent that doesn't.
 */
const MAX_REPORTS = 2;

/**
 * Demo: how long the browser waits for a whole reply. The agent gives each model call 30 s and a
 * turn up to two attempts of two calls, so this only fires when something is truly stuck.
 */
const REPLY_TIMEOUT_MS = 150_000;

/** Demo: what a component web_core rejected becomes, so the rest of the surface still renders. */
const PLACEHOLDER_TEXT = '⚠ This part of the answer could not be shown.';

/**
 * Talks to this app's own server (POST /api/agent), never to the agent directly.
 * Reads the server-sent events, each carrying plain A2UI messages, and hands them to the
 * renderer. Knows nothing of the transport between the server and the agent: `/api/agent` is
 * the contract with server.ts, and nothing on it is A2A. Adapted from the official A2UI Angular sample (Apache-2.0).
 */
@Injectable({ providedIn: 'root' })
export class AgentClient {
  private readonly renderer = inject(A2uiRendererService);
  private readonly issues = inject(ValidationIssues);
  private readonly appRef = inject(ApplicationRef);
  /** Demo: the last turn's messages, for the panel's "Show JSON" drawer. */
  private readonly jsonLog = inject(JsonLog);
  /** Demo: VALIDATION_FAILED reports sent since the user's last prompt or action. */
  private reports = 0;
  /** The conversation's id, opaque here: the server maps it to the transport's own. */
  private sessionId?: string;

  readonly isLoading = signal(false);
  /**
   * Demo: true from the request until the first A2UI message arrives. A live turn can take
   * 10+ s before anything streams (README, "Latency"); the old UI stays, dimmed, meanwhile.
   */
  readonly waitingForUi = signal(false);
  readonly error = signal<string | null>(null);
  /** Demo: what the agent said in text, when it had no UI to send (e.g. the fallback). */
  readonly agentText = signal<string | null>(null);
  /** The old surfaces are still on screen and go when the reply's first A2UI message arrives. */
  private clearOnFirstMessage = false;

  /** A new prompt replaces whatever the agent rendered before. */
  ask(query: string): Promise<void> {
    // Demo: one turn at a time. Two at once would write two replies into one renderer and one
    // conversation (app.ts also makes the surfaces inert while a turn runs).
    if (this.isLoading()) return Promise.resolve();
    this.reports = 0;
    return this.send({ query });
  }

  /** A button action goes back to the agent, which answers with more A2UI messages. */
  handleAction(event: A2uiClientAction): Promise<void> {
    if (this.isLoading()) {
      console.warn('[a2ui] action ignored while the agent is answering:', event.name);
      return Promise.resolve();
    }
    this.reports = 0;
    return this.send({ event });
  }

  private async send(body: { query?: string; event?: unknown; error?: ValidationFailed }): Promise<void> {
    // Every reply carries its whole UI, createSurface included (@a2ui/agent 0.0.2 checks each
    // reply against a fresh state), so the old surfaces must go. The official Angular sample
    // clears them here, before the request; demo: they stay until the reply's first A2UI message
    // and are swapped in one go, so a fast (stub) reply doesn't flash an empty screen, a slow
    // (live) one keeps the old view, dimmed, and an error report keeps the partly rejected surface
    // until the corrected reply arrives (or under the agent's text fallback). app.ts tracks
    // surfaces by object, not id, so a surface re-created under the same id is drawn afresh.
    // A prompt or action whose reply carries no A2UI at all clears them at the end (finally).
    this.clearOnFirstMessage = true;
    // Demo: only this reply's problems are reported.
    this.issues.clear();
    this.jsonLog.start(turnLabel(body));
    let complete = false;
    let reader: ReadableStreamDefaultReader<string> | undefined;
    this.isLoading.set(true);
    this.waitingForUi.set(true);
    this.error.set(null);
    this.agentText.set(null);
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, sessionId: this.sessionId }),
        signal: AbortSignal.timeout(REPLY_TIMEOUT_MS),
      });
      if (!response.ok || !response.body) {
        throw new Error(await errorMessage(response));
      }

      reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const event of events) {
          if (!event.startsWith('data: ')) continue;
          const parsed: ServerEvent = JSON.parse(event.slice(6));
          this.jsonLog.add(parsed);
          this.handleEvent(parsed);
        }
      }
      complete = true;
    } catch (error) {
      this.error.set(
        error instanceof DOMException && error.name === 'TimeoutError'
          ? `No reply after ${REPLY_TIMEOUT_MS / 1000} s. Try again, or switch to the stub (Alt+Shift+D).`
          : (error instanceof Error && error.message) || 'The request failed.',
      );
      void reader?.cancel().catch(() => undefined);
    } finally {
      // Demo: a prompt or action whose reply had no A2UI at all (the agent's text fallback after
      // a model failure, an error, a timeout) is not an answer the old view belongs to: it goes,
      // so the text or error stands alone instead of above the previous turn's surfaces. Decided
      // here, when the whole turn is known to have carried none. An error report keeps the partly
      // rejected surface: it is this question's own answer, shown under the fallback.
      if (this.clearOnFirstMessage && !body.error) this.clearSurfaces();
      this.clearOnFirstMessage = false;
      this.isLoading.set(false);
      this.waitingForUi.set(false);
    }
    if (complete) await this.reportIssues();
  }

  private clearSurfaces(): void {
    for (const surfaceId of Array.from(this.renderer.surfaceGroup.surfacesMap.keys())) {
      this.renderer.surfaceGroup.deleteSurface(surfaceId);
    }
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

  private handleEvent(event: ServerEvent) {
    if (event.error) throw new Error(event.error);
    if (event.sessionId) this.sessionId = event.sessionId;
    if (this.clearOnFirstMessage && event.messages?.length) {
      this.clearOnFirstMessage = false;
      this.clearSurfaces();
    }
    if (event.text) {
      this.agentText.set(event.text);
      this.waitingForUi.set(false);
    }

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

/** Demo: the server's `{ error }` message, or a plain one when the body isn't that JSON. */
async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string' && body.error) return body.error;
  } catch {
    // Not JSON: a proxy page, or an empty body.
  }
  return `The server answered ${response.status}${response.statusText ? ` ${response.statusText}` : ''}.`;
}

/** Demo: what started a turn, as the "Show JSON" drawer heads it. */
function turnLabel(body: { query?: string; event?: unknown; error?: ValidationFailed }): string {
  if (body.error) return `VALIDATION_FAILED report (${body.error.path})`;
  if (body.event) return `Action: ${(body.event as { name?: string }).name ?? 'click'}`;
  return `Prompt: "${body.query ?? ''}"`;
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
