import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject } from '@angular/core';
import { CatalogComponent } from '@a2ui/angular/v0_9';
import { PriorityBadgeApi } from '@demo/catalog';
import { ValidationIssues } from '../validation-issues';
import { resolvedValueProblem } from './resolved-value';

/**
 * PriorityBadge, typed from the catalog's own ComponentApi: `priority` is the enum.
 *
 * Demo: a bound priority is checked once it resolves (`resolved-value.ts`). A value outside the
 * enum shows a placeholder badge instead and is filed in `ValidationIssues`, which AgentClient
 * reports to the agent as VALIDATION_FAILED. The rest of the surface renders as usual.
 */
@Component({
  selector: 'app-priority-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (problem(); as p) {
      <span class="priority-badge invalid" [attr.title]="p.message">?</span>
    } @else {
      <span class="priority-badge" [attr.data-priority]="priority()">{{ priority() }}</span>
    }
  `,
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
    /* Demo: a value the catalog refuses (STUB_CLIENT_INVALID): dashed, uncoloured. */
    .invalid { border-style: dashed; background: transparent; color: var(--ink); }
  `,
})
export class PriorityBadgeComponent extends CatalogComponent<typeof PriorityBadgeApi> {
  /** 'low' | 'medium' | 'high' | 'urgent', inferred from the Zod enum. */
  protected readonly priority = computed(() => this.props().priority?.value());

  /** Demo: why the resolved priority is refused, or null. */
  protected readonly problem = computed(() =>
    resolvedValueProblem(PriorityBadgeApi, 'priority', this.props().priority?.raw, this.priority(), this.dataContextPath()),
  );

  constructor() {
    super();
    const issues = inject(ValidationIssues);
    let key: string | undefined;
    effect(() => {
      const problem = this.problem();
      const next = `${this.surfaceId()}#${this.componentId()}@${this.dataContextPath()}`;
      if (key && key !== next) issues.set(key, null);
      key = next;
      issues.set(
        key,
        problem && {
          surfaceId: this.surfaceId(),
          path: problem.path,
          message: `PriorityBadge (${this.componentId()}): ${problem.message}`,
        },
      );
    });
    inject(DestroyRef).onDestroy(() => key && issues.set(key, null));
  }
}
