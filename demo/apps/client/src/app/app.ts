import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { A2uiRendererService, SurfaceComponent } from '@a2ui/angular/v0_9';
import { AgentClient } from './agent-client';
import { DemoPanel } from './demo-panel';

@Component({
  selector: 'app-root',
  imports: [SurfaceComponent, DemoPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form (submit)="submit($event, prompt.value)">
      <input #prompt name="prompt" value="Show me the open tickets" [disabled]="agent.isLoading()" />
      <button type="submit" [disabled]="agent.isLoading()" [class.working]="agent.waitingForUi()">
        <span class="label">Ask</span>
        <span class="busy" role="status" aria-live="polite">{{ agent.waitingForUi() ? 'Working…' : '' }}</span>
      </button>
    </form>

    @if (agent.error(); as error) {
      <p class="error">{{ error }}</p>
    }

    <div class="surfaces" [class.stale]="agent.waitingForUi()">
      @for (entry of renderer.surfaceGroup.surfacesMap; track entry[0]) {
        <a2ui-v09-surface [surfaceId]="entry[0]" />
      }
    </div>

    <app-demo-panel />
  `,
  // Demo: while the agent works, the Ask button pulses "Working…" and the old view dims, so a
  // long live turn doesn't read as broken. Both wait 250 ms: a stub reply lands before that,
  // so nothing flashes. No line is added or removed, so nothing below moves.
  styles: `
    button { display: grid; }
    button > * { grid-area: 1 / 1; }
    .busy { visibility: hidden; }
    button.working .label { animation: hide 0s 250ms both; }
    button.working .busy { animation: show 0s 250ms both, pulse 1.2s 250ms ease-in-out infinite; }
    .surfaces { display: flex; flex-direction: column; gap: 20px; }
    /* Dims on the way in only: the new view must arrive at full strength. */
    .surfaces.stale { opacity: 0.45; transition: opacity 0.2s 250ms; }
    @keyframes hide { to { visibility: hidden; } }
    @keyframes show { to { visibility: visible; } }
    @keyframes pulse { 50% { opacity: 0.35; } }
    @media (prefers-reduced-motion: reduce) {
      button.working .busy { animation: show 0s 250ms both; }
    }
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
