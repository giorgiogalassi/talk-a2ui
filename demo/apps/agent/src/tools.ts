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
 */

import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {FunctionDeclaration, Type} from '@google/genai';

/** Resolves the package root directory across both tsx and compiled dist/src. */
export function getPackageRootDir(): string {
  const dirname = fileURLToPath(new URL('.', import.meta.url));
  if (fs.existsSync(path.join(dirname, '../package.json'))) {
    return path.resolve(dirname, '..');
  }
  return path.resolve(dirname, '../..');
}

/** Resolves the Python ADK restaurant finder sample directory. */
export function resolvePythonSampleDir(): string {
  // Demo: the sample's shared data and images are vendored into assets/.
  return path.join(getPackageRootDir(), 'assets');
}

/** Resolves the repository root, which holds the published catalog documents. */
export function getRepoRootDir(): string {
  // Demo: the basic catalog is vendored into catalogs/, relative to the package root.
  return getPackageRootDir();
}

/** Verifies that the shared Python assets exist at startup. */
export function verifyPythonSampleAssets(pythonDir: string = resolvePythonSampleDir()): void {
  // Demo: the ticket data replaces the sample's restaurant data and images.
  const dataPath = path.join(pythonDir, 'tickets.json');
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Required ticket data file not found at ${dataPath}.`);
  }
}

// Demo: the support-ticket domain replaces the sample's get_restaurants tool.
export const getTicketsDeclaration: FunctionDeclaration = {
  name: 'get_tickets',
  description:
    "Call this tool to get support tickets. Every filter is optional: 'ticketId' returns one ticket, 'status' and 'priority' narrow the list, 'count' caps it.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      ticketId: {
        type: Type.STRING,
        description: 'The id of one ticket, e.g. TCK-1042.',
      },
      status: {
        type: Type.STRING,
        description: 'One of open, in_progress, resolved.',
      },
      priority: {
        type: Type.STRING,
        description: 'One of low, medium, high, urgent.',
      },
      count: {
        type: Type.INTEGER,
        description: 'The maximum number of tickets to return.',
      },
    },
  },
};

export interface GetTicketsArgs {
  ticketId?: string;
  status?: string;
  priority?: string;
  count?: number;
}

/**
 * Executes the get_tickets tool over the vendored sample data.
 *
 * Demo: it returns whole tickets, `internal_notes` included, as a real backend would. Keeping
 * that field away from the browser is the server-side policy's job (step 5), not the tool's.
 */
export function executeGetTickets(
  args: GetTicketsArgs,
  pythonDir: string = resolvePythonSampleDir(),
  /** Demo: why the agent called it itself, when the model didn't (logged instead of "TOOL CALLED"). */
  reason?: string,
): string {
  const count = typeof args.count === 'number' ? args.count : 8;
  console.log(
    reason
      ? `--- get_tickets ${JSON.stringify(args)}, ${reason} ---`
      : `--- TOOL CALLED: get_tickets ${JSON.stringify(args)} ---`,
  );

  let items: Record<string, unknown>[] = [];
  const filePath = path.join(pythonDir, 'tickets.json');
  try {
    const all = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>[];
    items = all
      .filter(t => !args.ticketId || t.id === args.ticketId)
      .filter(t => !args.status || t.status === args.status)
      .filter(t => !args.priority || t.priority === args.priority)
      .slice(0, count);
    console.log(`  - Success: Found ${all.length} tickets, returning ${items.length}.`);
  } catch (e) {
    console.error(`  - Error reading/parsing tickets.json: ${e}`);
  }

  return JSON.stringify(items);
}
