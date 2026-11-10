import { Injectable, inject, signal } from '@angular/core';
import { A2uiRendererService } from '@a2ui/angular/v0_9';
import { A2uiClientAction, A2uiMessage } from '@a2ui/web_core/v0_9';

/**
 * Talks to this app's own server (POST /a2a), never to the agent directly.
 * Reads the server-sent events, each carrying plain A2UI messages, and hands them to the
 * renderer. Knows nothing of the transport between the server and the agent (A2A today). Adapted from the official A2UI Angular sample (Apache-2.0).
 */
@Injectable({ providedIn: 'root' })
export class AgentClient {
  private readonly renderer = inject(A2uiRendererService);
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
    return this.send({ query });
  }

  /** A button action goes back to the agent, which answers with more A2UI messages. */
  handleAction(event: A2uiClientAction): Promise<void> {
    return this.send({ event });
  }

  private async send(body: { query?: string; event?: unknown }): Promise<void> {
    // Every reply carries its whole UI, createSurface included (@a2ui/agent 0.0.2 checks each
    // reply against a fresh state), so any interaction clears the old surfaces first, as the
    // official Angular sample does.
    for (const surfaceId of Array.from(this.renderer.surfaceGroup.surfacesMap.keys())) {
      this.renderer.surfaceGroup.deleteSurface(surfaceId);
    }
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
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.isLoading.set(false);
      this.waitingForUi.set(false);
    }
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
      this.renderer.processMessages(messages);
    }
  }
}
