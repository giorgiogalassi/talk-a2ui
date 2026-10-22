import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { A2uiRendererService, SurfaceComponent } from '@a2ui/angular/v0_9';
import { A2uiMessage } from '@a2ui/web_core/v0_9';
import bookingForm from './booking-form.json';

@Component({
  selector: 'app-root',
  imports: [SurfaceComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (entry of renderer.surfaceGroup.surfacesMap; track entry[0]) {
      <a2ui-v09-surface [surfaceId]="entry[0]" />
    }
  `,
})
export class App {
  protected readonly renderer = inject(A2uiRendererService);

  constructor() {
    this.renderer.processMessages(bookingForm as unknown as A2uiMessage[]);
  }
}
