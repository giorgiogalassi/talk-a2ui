import { Injectable, inject, signal } from '@angular/core';
import { A2uiRendererService } from '@a2ui/angular/v0_9';
import { A2uiClientAction, A2uiMessage } from '@a2ui/web_core/v0_9';

/**
 * Talks to this app's own server (POST /a2a), never to the agent directly.
 * Reads the server-sent events, unwraps the A2UI messages from each part and
 * hands them to the renderer. Adapted from the official A2UI Angular sample (Apache-2.0).
 */
@Injectable({ providedIn: 'root' })
export class AgentClient {
  private readonly renderer = inject(A2uiRendererService);
  private contextId?: string;

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  /** A new prompt replaces whatever the agent rendered before. */
  ask(query: string): Promise<void> {
    for (const surfaceId of Array.from(this.renderer.surfaceGroup.surfacesMap.keys())) {
      this.renderer.surfaceGroup.deleteSurface(surfaceId);
    }
    return this.send({ query });
  }

  /** A button action goes back to the agent, which answers with more A2UI messages. */
  handleAction(event: A2uiClientAction): Promise<void> {
    return this.send({ event });
  }

  private async send(body: { query?: string; event?: unknown }): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const response = await fetch('/a2a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, contextId: this.contextId }),
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
    }
  }

  private handleEvent(event: { parts?: { kind: string; data?: unknown }[]; contextId?: string; error?: string }) {
    if (event.error) throw new Error(event.error);
    if (event.contextId) this.contextId = event.contextId;

    // Each data part holds one A2UI message (or, in A2A v1.0, a list of them).
    const messages = (event.parts ?? [])
      .filter((part) => part.kind === 'data' && part.data)
      .flatMap((part) => (Array.isArray(part.data) ? part.data : [part.data])) as A2uiMessage[];
    if (messages.length > 0) this.renderer.processMessages(messages);
  }
}
