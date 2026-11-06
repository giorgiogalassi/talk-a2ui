import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { CatalogComponent } from '@a2ui/angular/v0_9';
import { PriorityBadgeApi } from '@demo/catalog';

/** PriorityBadge, typed from the catalog's own ComponentApi: `priority` is the enum. */
@Component({
  selector: 'app-priority-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="priority-badge" [attr.data-priority]="priority()">{{ priority() }}</span>`,
  styles: `
    .priority-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background: #e8eaed;
      color: #3c4043;
    }
    [data-priority='medium'] { background: #fef7e0; color: #8a5a00; }
    [data-priority='high'] { background: #fde7d9; color: #b3261e; }
    [data-priority='urgent'] { background: #b3261e; color: #ffffff; }
  `,
})
export class PriorityBadgeComponent extends CatalogComponent<typeof PriorityBadgeApi> {
  /** 'low' | 'medium' | 'high' | 'urgent', inferred from the Zod enum. */
  protected readonly priority = computed(() => this.props().priority?.value());
}
