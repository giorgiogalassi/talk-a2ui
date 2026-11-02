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
 */

import path from 'path';

import {FileSystemCatalogProvider} from '@a2ui/agent';
import {type CatalogApi} from '@a2ui/web_core/catalog';
import {basicCatalog} from '@a2ui/web_core/v0_9/basic_catalog';

import {getRepoRootDir} from './tools.js';
import {VERSIONS, type VersionProfile} from './versions.js';

/** The basic catalog of each served version, keyed by version. */
export type BasicCatalogs = ReadonlyMap<VersionProfile['version'], CatalogApi>;

/**
 * Loads the basic catalog of every served version.
 *
 * Demo: v0.9 uses `@a2ui/web_core`'s own Zod catalog, the one the renderer validates with,
 * instead of the published JSON document. Loaded from JSON, an action's `context` comes back
 * as `Record<unknown>`, so the agent accepted values the renderer rejects, and the stream
 * published a binding cut mid-chunk as `{}` (demo/README.md, incident 2). Both produce the
 * same catalog document, so the model's prompt is unchanged.
 *
 * Other versions load the published document, as in the sample. It states neither a
 * `catalogId` nor a `protocolVersion`, so both come from the version profile.
 */
export function loadBasicCatalogs(repoRoot: string = getRepoRootDir()): BasicCatalogs {
  const catalogs = new Map<VersionProfile['version'], CatalogApi>();
  for (const profile of VERSIONS) {
    if (profile.version === 'v0.9' && basicCatalog.id === profile.basicCatalogId) {
      catalogs.set(profile.version, basicCatalog);
      continue;
    }
    const provider = new FileSystemCatalogProvider(
      path.join(repoRoot, profile.basicCatalogPath),
      profile.version,
      profile.basicCatalogId,
    );
    catalogs.set(profile.version, provider.load());
  }
  return catalogs;
}
