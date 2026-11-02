import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { A2uiRendererService, SurfaceComponent } from '@a2ui/angular/v0_9';
import { AgentClient } from './agent-client';

@Component({
  selector: 'app-root',
  imports: [SurfaceComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form (submit)="submit($event, prompt.value)">
      <input #prompt name="prompt" value="Top 3 Chinese restaurants in New York" [disabled]="agent.isLoading()" />
      <button type="submit" [disabled]="agent.isLoading()">Ask</button>
    </form>

    @if (agent.error(); as error) {
      <p class="error">{{ error }}</p>
    }

    @for (entry of renderer.surfaceGroup.surfacesMap; track entry[0]) {
      <a2ui-v09-surface [surfaceId]="entry[0]" />
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
