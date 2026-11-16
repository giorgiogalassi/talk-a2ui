/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Modified for the talk-a2ui demo (2026): changes are marked "Demo:".
 * Original: https://github.com/a2ui-project/a2ui/blob/3a64be7/samples/agent/node/restaurant_finder/src/pick-a2ui.ts
 */

import type {Message} from '@a2a-js/sdk';
import {A2uiVersionCapabilitiesSchema} from '@a2ui/web_core/v0_9';

import {V0_9, type VersionProfile} from './versions.js';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Picks the A2UI version and catalogs to answer a message with.
 *
 * The renderer lists what it can show in the message metadata, keyed by protocol version:
 * `a2uiClientCapabilities: { "v0.9": { supportedCatalogIds: [...] } }`. The client's server.ts
 * adds this to every A2A message. Demo: only v0.9 is served, so this reads that one entry and
 * checks it with web_core's own `A2uiVersionCapabilitiesSchema` (the sample loops over every
 * version it serves). A message with no capabilities gets v0.9 and the basic catalog, as in
 * the sample.
 *
 * @throws Error if the renderer lists capabilities, but not valid ones for v0.9.
 */
export function pickA2ui(message: Message): {profile: VersionProfile; catalogIds: string[]} {
  const byVersion = asRecord(asRecord(message.metadata)?.[V0_9.capabilitiesKey]);
  if (!byVersion) return {profile: V0_9, catalogIds: [V0_9.basicCatalogId]};
  const caps = A2uiVersionCapabilitiesSchema.safeParse(byVersion[V0_9.version]);
  if (!caps.success) {
    throw new Error(
      `The renderer lists A2UI capabilities for ${Object.keys(byVersion).join(', ') || 'no version'}, ` +
        `but this agent needs valid ${V0_9.version} capabilities (supportedCatalogIds).`,
    );
  }
  return {profile: V0_9, catalogIds: caps.data.supportedCatalogIds};
}
