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
      padding: 2px 10px 2px 2px;
      border-radius: 999px;
      background: #e8f0fe;
      color: #0b3d91;
      font-size: 13px;
      white-space: nowrap;
    }
    .initials {
      display: inline-grid;
      place-items: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #1a73e8;
      color: #ffffff;
      font-size: 11px;
      font-weight: 600;
    }
    .unassigned { background: #f1f3f4; color: #5f6368; }
    .unassigned .initials { background: #9aa0a6; }
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
