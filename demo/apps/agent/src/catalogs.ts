/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Modified for the talk-a2ui demo (2026): changes are marked "Demo:".
 * Original: https://github.com/a2ui-project/a2ui/blob/3a64be7/samples/agent/node/restaurant_finder/src/catalogs.ts
 */

import {type CatalogApi} from '@a2ui/web_core/catalog';
import {basicCatalog} from '@a2ui/web_core/v0_9/basic_catalog';
import {ticketCatalog} from '@demo/catalog';

import {VERSIONS, type VersionProfile} from './versions.js';

/** The basic catalog of each served version, keyed by version. */
export type BasicCatalogs = ReadonlyMap<VersionProfile['version'], CatalogApi>;

/** Demo: the ticket catalog of each served version, keyed by version. */
export type TicketCatalogs = ReadonlyMap<VersionProfile['version'], CatalogApi>;

/**
 * Loads the basic catalog of every served version.
 *
 * Demo: only v0.9 is served, from `@a2ui/web_core`'s own Zod catalog, the one the renderer
 * validates with, instead of the published JSON document the sample loads. Loaded from JSON, an
 * action's `context` comes back as `Record<unknown>`, so the agent accepted values the renderer
 * rejects, and the stream published a binding cut mid-chunk as `{}` (demo/README.md, incident 2).
 * Both produce the same catalog document, so the model's prompt is unchanged.
 */
export function loadBasicCatalogs(): BasicCatalogs {
  const catalogs = new Map<VersionProfile['version'], CatalogApi>();
  for (const profile of VERSIONS) {
    if (basicCatalog.id !== profile.basicCatalogId) {
      throw new Error(`No basic catalog for ${profile.version} (${profile.basicCatalogId}).`);
    }
    catalogs.set(profile.version, basicCatalog);
  }
  return catalogs;
}

/**
 * Demo: loads the ticket catalog, built in packages/catalog from one Zod `ComponentApi` per
 * component. The Angular client registers its components with the same objects.
 *
 * The agent registers the Zod `Catalog` itself rather than its `toJson()` document loaded back
 * with `InMemoryCatalogProvider`. The model reads the document either way: the prompt
 * generator writes `catalog.toJson()` into the prompt. But a catalog loaded from a document
 * rebuilds its Zod from JSON Schema, and a Button's action `context` comes back as
 * `Record<unknown>`, the gap behind incident 2 (demo/README.md). The document does load
 * cleanly; `catalogs.test.ts` checks both, and the gap.
 */
export function loadTicketCatalogs(): TicketCatalogs {
  return new Map([['v0.9', ticketCatalog]]);
}
