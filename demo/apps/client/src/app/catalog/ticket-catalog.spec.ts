import { AssigneeChipApi, PriorityBadgeApi, TICKET_CATALOG_ID, TicketListApi, ticketCatalog } from '@demo/catalog';
import { AssigneeChipComponent } from './assignee-chip';
import { PriorityBadgeComponent } from './priority-badge';
import { createTicketCatalog } from './ticket-catalog';
import { TicketListComponent } from './ticket-list';

describe('the renderer ticket catalog', () => {
  const catalog = createTicketCatalog();

  it('has the id the agent serves and the same components', () => {
    expect(catalog.id).toBe(TICKET_CATALOG_ID);
    expect([...catalog.components.keys()].sort()).toEqual([...ticketCatalog.components.keys()].sort());
  });

  it('validates with the very Zod schemas the agent validates with', () => {
    for (const name of catalog.components.keys()) {
      expect(catalog.components.get(name)!.schema).toBe(ticketCatalog.components.get(name)!.schema);
    }
    expect(catalog.components.get('PriorityBadge')!.schema).toBe(PriorityBadgeApi.schema);
  });

  it('draws the custom components with the demo Angular components', () => {
    expect(catalog.components.get(TicketListApi.name)!.component).toBe(TicketListComponent);
    expect(catalog.components.get(PriorityBadgeApi.name)!.component).toBe(PriorityBadgeComponent);
    expect(catalog.components.get(AssigneeChipApi.name)!.component).toBe(AssigneeChipComponent);
  });
});
