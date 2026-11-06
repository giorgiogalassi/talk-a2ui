import { AngularCatalog, BASIC_COMPONENTS, createComponentImplementation } from '@a2ui/angular/v0_9';
import { BasicCatalogThemeSchema } from '@a2ui/web_core/v0_9/basic_catalog';
import {
  AssigneeChipApi,
  PriorityBadgeApi,
  TICKET_BASIC_COMPONENTS,
  TICKET_CATALOG_ID,
  TicketListApi,
} from '@demo/catalog';
import { AssigneeChipComponent } from './assignee-chip';
import { PriorityBadgeComponent } from './priority-badge';
import { TicketListComponent } from './ticket-list';

const basicNames = new Set(TICKET_BASIC_COMPONENTS.map((api) => api.name));

/**
 * The renderer's side of the ticket catalog: the same ComponentApi objects the agent validates
 * with, each paired with the Angular component that draws it. The basic components are the
 * library's own Angular ones, limited to those the catalog lists.
 */
export function createTicketCatalog(): AngularCatalog {
  return new AngularCatalog(
    TICKET_CATALOG_ID,
    'v0.9',
    [
      ...BASIC_COMPONENTS.filter((impl) => basicNames.has(impl.name)),
      createComponentImplementation(TicketListApi, TicketListComponent),
      createComponentImplementation(PriorityBadgeApi, PriorityBadgeComponent),
      createComponentImplementation(AssigneeChipApi, AssigneeChipComponent),
    ],
    [],
    BasicCatalogThemeSchema,
  );
}
