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
    .invalid { background: none; color: #5f6368; outline: 1px dashed #9aa0a6; }
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
