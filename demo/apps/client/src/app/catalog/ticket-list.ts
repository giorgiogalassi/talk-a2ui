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
      border: 1px solid #dadce0;
      border-radius: 12px;
      overflow: hidden;
      background: #ffffff;
    }
    h2 { margin: 0; padding: 12px 16px; font-size: 18px; border-bottom: 1px solid #dadce0; }
    .ticket-row { padding: 4px 16px; border-bottom: 1px solid #f1f3f4; }
    .ticket-row:last-child { border-bottom: none; }
    .empty { padding: 12px 16px; color: #5f6368; }
  `,
})
export class TicketListComponent extends CatalogComponent<typeof TicketListApi> {
  protected readonly title = computed(() => this.props().title?.value() ?? '');
  protected readonly children = computed(() => this.props().children?.value() ?? []);
}
