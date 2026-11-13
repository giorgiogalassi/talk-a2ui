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
      display: inline-flex;
      align-items: center;
      box-sizing: border-box;
      height: 26px; /* same height as AssigneeChip, so a row's pills line up */
      padding: 0 12px;
      line-height: 1;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      /* low: outline only; the scale gets louder up to urgent. */
      border: 1px solid var(--ink);
      background: transparent;
      color: var(--ink);
    }
    [data-priority='medium'] { background: var(--sand); border-color: var(--sand); }
    [data-priority='high'] { background: var(--accent-tint); border-color: var(--accent-tint); color: var(--accent-text); }
    [data-priority='urgent'] { background: var(--accent-fill); border-color: var(--accent-fill); color: #ffffff; }
  `,
})
export class PriorityBadgeComponent extends CatalogComponent<typeof PriorityBadgeApi> {
  /** 'low' | 'medium' | 'high' | 'urgent', inferred from the Zod enum. */
  protected readonly priority = computed(() => this.props().priority?.value());
}
