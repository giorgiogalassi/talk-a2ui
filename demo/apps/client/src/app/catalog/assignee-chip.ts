import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { CatalogComponent } from '@a2ui/angular/v0_9';
import { AssigneeChipApi } from '@demo/catalog';

/** AssigneeChip, typed from the catalog's own ComponentApi. */
@Component({
  selector: 'app-assignee-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="assignee-chip" [class.unassigned]="!name()">
      <span class="initials">{{ initials() }}</span>{{ name() || 'Unassigned' }}
    </span>
  `,
  styles: `
    .assignee-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-sizing: border-box;
      height: 26px; /* same height as PriorityBadge */
      padding: 2px 12px 2px 2px;
      line-height: 1;
      border-radius: 999px;
      background: var(--sand);
      color: var(--ink);
      font-size: 13px;
      white-space: nowrap;
    }
    .initials {
      display: inline-grid;
      place-items: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--ink);
      color: var(--cream);
      font-size: 11px;
      font-weight: 600;
    }
    .unassigned { background: transparent; color: var(--muted); outline: 1px dashed var(--muted); outline-offset: -1px; }
    .unassigned .initials { background: transparent; color: var(--muted); }
  `,
})
export class AssigneeChipComponent extends CatalogComponent<typeof AssigneeChipApi> {
  protected readonly name = computed(() => this.props().name?.value() ?? '');
  protected readonly initials = computed(
    () =>
      this.name()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0]!.toUpperCase())
        .slice(0, 2)
        .join('') || '?',
  );
}
