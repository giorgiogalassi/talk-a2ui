/**
 * The ticket catalog, assembled from the Zod `ComponentApi`s with `@a2ui/web_core`'s own
 * `Catalog`, and its catalog document from `toJson()`.
 */
import {Catalog, type ComponentApi} from '@a2ui/web_core/catalog';
import {BasicCatalogThemeSchema} from '@a2ui/web_core/v0_9/basic_catalog';

import {TICKET_BASIC_COMPONENTS, TICKET_CATALOG_ID, TICKET_CUSTOM_COMPONENTS} from './components.js';

export const ticketCatalog = new Catalog<ComponentApi>(
  TICKET_CATALOG_ID,
  'v0.9',
  [...TICKET_BASIC_COMPONENTS, ...TICKET_CUSTOM_COMPONENTS],
  [],
  {
    themeSchema: BasicCatalogThemeSchema,
    title: 'Support ticket catalog',
    description: 'Basic layout components plus the ticket dashboard components of the A2UI demo.',
    commonTypesUri: 'https://a2ui.org/specification/v0_9/common_types.json',
  },
);

/** The catalog JSON Schema document: what the model reads, generated from the Zod source. */
export function ticketCatalogDocument(): Record<string, unknown> {
  return ticketCatalog.toJson();
}
