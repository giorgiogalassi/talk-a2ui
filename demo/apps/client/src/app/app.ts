import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { A2uiRendererService, SurfaceComponent } from '@a2ui/angular/v0_9';
import { AgentClient } from './agent-client';

@Component({
  selector: 'app-root',
  imports: [SurfaceComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form (submit)="submit($event, prompt.value)">
      <input #prompt name="prompt" value="Show me the open tickets" [disabled]="agent.isLoading()" />
      <button type="submit" [disabled]="agent.isLoading()">Ask</button>
    </form>

    @if (agent.waitingForUi()) {
      <p class="working" role="status" aria-live="polite">Agent is working…</p>
    }

    @if (agent.error(); as error) {
      <p class="error">{{ error }}</p>
    }

    @for (entry of renderer.surfaceGroup.surfacesMap; track entry[0]) {
      <a2ui-v09-surface [surfaceId]="entry[0]" />
    }
  `,
  // Demo: a quiet pulse while the agent works, so a long live turn doesn't read as broken.
  styles: `
    .working { color: var(--muted); animation: pulse 1.2s ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: 0.35; } }
    @media (prefers-reduced-motion: reduce) { .working { animation: none; } }
  `,
})
export class App {
  protected readonly agent = inject(AgentClient);
  protected readonly renderer = inject(A2uiRendererService);

  protected submit(event: Event, prompt: string) {
    event.preventDefault();
    if (prompt.trim()) this.agent.ask(prompt);
  }
}
