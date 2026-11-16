import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { CatalogComponent, ComponentHostComponent } from '@a2ui/angular/v0_9';
import { TicketListApi } from '@demo/catalog';

/** TicketList, typed from the catalog's own ComponentApi. Each child is one ticket row. */
@Component({
  selector: 'app-ticket-list',
  imports: [ComponentHostComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ticket-list">
      <h2>{{ title() }}</h2>
      @for (child of children(); track child.basePath + '/' + child.id) {
        <div class="ticket-row">
          <a2ui-v09-component-host [componentKey]="child" [surfaceId]="surfaceId()" />
        </div>
      } @empty {
        <p class="empty">No tickets.</p>
      }
    </section>
  `,
  styles: `
    .ticket-list {
      border: 1px solid var(--line);
      border-radius: 14px;
      overflow: hidden;
      background: var(--paper);
    }
    h2 {
      margin: 0;
      padding: 20px 24px 16px;
      font-family: var(--font-display);
      font-size: var(--a2ui-font-size-xl);
      line-height: 1.05;
      font-weight: 600;
      font-variation-settings: 'opsz' 144, 'wdth' 100;
      letter-spacing: -0.04em;
      border-bottom: 1px solid var(--line);
    }
    .ticket-row { padding: 12px 24px; border-bottom: 1px solid var(--line-soft); }
    .ticket-row:last-child { border-bottom: none; }
    .empty { padding: 16px 24px; color: var(--muted); }
  `,
})
export class TicketListComponent extends CatalogComponent<typeof TicketListApi> {
  protected readonly title = computed(() => this.props().title?.value() ?? '');
  protected readonly children = computed(() => this.props().children?.value() ?? []);
}
