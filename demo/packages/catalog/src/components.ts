/**
 * The ticket catalog's components, one Zod `ComponentApi` each.
 *
 * These objects are the single source of truth: the agent builds its catalog (prompt and
 * validation) from them, and the Angular client types and registers its components with the
 * same objects. Zod 3, the version `@a2ui/web_core` is written in.
 */
import {type ComponentApi} from '@a2ui/web_core/catalog';
import {
  ButtonApi,
  CardApi,
  ColumnApi,
  DividerApi,
  RowApi,
  TextApi,
} from '@a2ui/web_core/v0_9/basic_catalog';
import {ChildListSchema, DataBindingSchema} from '@a2ui/web_core/v0_9';
import {z} from 'zod';

/** The id a renderer names in `supportedCatalogIds` to receive ticket UIs. */
export const TICKET_CATALOG_ID =
  'https://github.com/giorgiogalassi/talk-a2ui/demo/catalogs/tickets/v0_9/catalog.json';

/** The priorities a ticket can have. Anything else fails validation. */
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** A literal string, or a binding to one in the data model. */
const StringOrBinding = z.union([z.string(), DataBindingSchema]);

export const TicketListApi = {
  name: 'TicketList',
  schema: z
    .object({
      title: StringOrBinding.describe('The heading shown above the tickets.'),
      children: ChildListSchema,
    })
    .strict()
    .describe(
      'A list of support tickets, one row per child. Bind the children to the tickets array with a template.',
    ),
} satisfies ComponentApi;

export const PriorityBadgeApi = {
  name: 'PriorityBadge',
  schema: z
    .object({
      priority: z
        .union([z.enum(PRIORITIES), DataBindingSchema])
        .describe("The ticket's priority, or a binding to it."),
    })
    .strict()
    .describe("A coloured badge showing a ticket's priority."),
} satisfies ComponentApi;

export const AssigneeChipApi = {
  name: 'AssigneeChip',
  schema: z
    .object({
      name: StringOrBinding.describe(
        "The assignee's display name, or a binding to it. An empty value shows 'Unassigned'.",
      ),
    })
    .strict()
    .describe('A chip with the initials and name of the person a ticket is assigned to.'),
} satisfies ComponentApi;

/** The basic catalog components the ticket UI composes with, reused as they are. */
export const TICKET_BASIC_COMPONENTS = [TextApi, RowApi, ColumnApi, CardApi, DividerApi, ButtonApi];

/** The components this demo adds. */
export const TICKET_CUSTOM_COMPONENTS = [TicketListApi, PriorityBadgeApi, AssigneeChipApi];
