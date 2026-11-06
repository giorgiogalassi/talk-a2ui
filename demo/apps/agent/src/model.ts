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

import type {AgentToRendererMessage} from '@a2ui/agent';
import {Chat, FunctionCall, GoogleGenAI, PartListUnion, type ThinkingLevel} from '@google/genai';

import type {BasicCatalogs} from './catalogs.js';
import type {A2uiFormat} from './config.js';
import {readMessages, toResponseText} from './examples.js';
import {LruCache} from './lru-cache.js';
import {executeGetTickets, getPackageRootDir, getTicketsDeclaration} from './tools.js';
import {VERSIONS, type VersionProfile} from './versions.js';

/** One model turn, as the executor asks for it. */
export interface TurnInput {
  contextId: string;
  query: string;
  actionName?: string;
  profile: VersionProfile;
  systemPrompt: string;
}

/** Where the text of a turn comes from: a real model or the canned response. */
export interface ModelBackend {
  /** Streams the model's text for one turn. Tool calls are handled inside. */
  streamTurn(input: TurnInput): AsyncIterable<string>;
}

/** Demo: MINIMAL unless GEMINI_THINKING_LEVEL says otherwise; DEFAULT omits the setting. */
export function thinkingConfig(raw: string | undefined): {thinkingConfig?: {thinkingLevel: ThinkingLevel}} {
  const level = raw?.trim().toUpperCase() || 'MINIMAL';
  if (level === 'DEFAULT') return {};
  if (!['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'].includes(level)) {
    throw new Error(`GEMINI_THINKING_LEVEL must be MINIMAL, LOW, MEDIUM, HIGH or DEFAULT, but it is "${raw}".`);
  }
  return {thinkingConfig: {thinkingLevel: level as ThinkingLevel}};
}

/** Calls Gemini, keeping one chat per conversation and answering its tool calls. */
export class GeminiBackend implements ModelBackend {
  private readonly client: GoogleGenAI;
  private readonly chats = new LruCache<Chat>(1000);

  constructor(
    private readonly options: {
      apiKey: string;
      modelName: string;
      /** Base URL the restaurant image links should point at. Demo: unused by the ticket tool. */
      baseUrl: string;
      pythonSampleDir: string;
    },
  ) {
    this.client = new GoogleGenAI({apiKey: options.apiKey});
  }

  async *streamTurn({contextId, query, profile, systemPrompt}: TurnInput): AsyncIterable<string> {
    // The system prompt differs by version, so a conversation gets one chat per version.
    const chat = this.chats.getOrCreate(`${contextId}:${profile.version}`, () =>
      this.client.chats.create({
        model: this.options.modelName,
        config: {
          systemInstruction: systemPrompt,
          tools: [{functionDeclarations: [getTicketsDeclaration]}],
          // Demo: the model thinks before its first token on every call; MINIMAL cut the time to
          // the first UI token from ~10 s to ~3 s (README, "Latency"). GEMINI_THINKING_LEVEL
          // overrides it (MINIMAL | LOW | MEDIUM | HIGH); DEFAULT leaves the model's own setting.
          ...thinkingConfig(process.env.GEMINI_THINKING_LEVEL),
        },
      }),
    );

    let input: PartListUnion = query;
    // Demo: timing per model call, to see where the wait before the first stream goes.
    const turnStart = Date.now();
    let call = 0;
    while (true) {
      call++;
      const callStart = Date.now();
      let first = 0;
      const responseStream = await chat.sendMessageStream({message: input});
      const toolCalls: FunctionCall[] = [];
      for await (const chunk of responseStream) {
        if (!first) first = Date.now();
        if (chunk.text) {
          yield chunk.text;
        }
        toolCalls.push(...(chunk.functionCalls ?? []));
      }
      console.log(
        `--- timing: call ${call} first chunk ${first ? first - callStart : -1} ms, done ${Date.now() - callStart} ms ` +
          `(turn ${Date.now() - turnStart} ms)${toolCalls.length ? ', then tool call' : ''} ---`,
      );
      if (toolCalls.length === 0) {
        return;
      }
      input = toolCalls.map(fc => ({
        functionResponse: {
          name: fc.name ?? 'get_tickets',
          response: {
            // Demo: the ticket tool needs no base URL; it serves no images.
            result: executeGetTickets(
              (fc.args ?? {}) as Record<string, unknown>,
              this.options.pythonSampleDir,
            ),
          },
        },
      }));
    }
  }
}

/**
 * Answers without a model. Each turn is the stub notice (a separate `stub-notice`
 * surface saying no model was called) followed by the example that matches the action,
 * written in the configured format and cut into four chunks like a model stream.
 */
export class StubBackend implements ModelBackend {
  /** Response text by version, then by example name. */
  private readonly responses = new Map<string, Record<string, string>>();
  /** Demo: the same responses with a priority outside the catalog, by version and example. */
  private readonly invalidResponses = new Map<string, Record<string, string>>();

  constructor(
    format: A2uiFormat,
    // Demo: the ticket catalogs, which the canned responses use (only Express reads them).
    catalogs: BasicCatalogs,
    packageRoot: string = getPackageRootDir(),
    /**
     * Demo: when true (`STUB_INVALID_FIRST=true`), a turn's first attempt answers with a
     * PriorityBadge whose priority is `critical`, outside the catalog's enum, so validation
     * fails and the retry answers with the valid response. Shows the retry without a model.
     */
    private readonly invalidFirstAttempt = false,
    /**
     * Demo: when true (`STUB_LEAKY=true`), the replies are what a careless model would write:
     * every ticket in the data model keeps its `internal_notes`, and the detail view shows
     * them in an extra Text (the Delete button is in the example already). Valid against the
     * catalog, so only the policy (src/policy.ts) stops them. The reply streams in small
     * chunks, so each message is re-sent many times as it grows and the notes appear mid-stream.
     */
    private readonly leaky = false,
  ) {
    for (const profile of VERSIONS) {
      const catalog = catalogs.get(profile.version)!;
      const notice = readMessages(path.join(packageRoot, 'stub_notice', `${profile.version}.json`));
      const byExample: Record<string, string> = {};
      const invalid: Record<string, string> = {};
      // Demo: the ticket flow: list, then one ticket, then the resolved confirmation.
      for (const name of ['ticket_list', 'ticket_detail', 'ticket_resolved']) {
        const read = readMessages(
          path.join(packageRoot, 'examples', profile.version, `${name}.json`),
        );
        const example = leaky ? leakInternalNotes(read, packageRoot) : read;
        byExample[name] = toResponseText(profile, catalog, format, [...notice, ...example]);
        invalid[name] = toResponseText(profile, catalog, format, [
          ...notice,
          ...JSON.parse(JSON.stringify(example).replace(/"priority":\{"path":"[^"]*"\}/g, '"priority":"critical"')),
        ]);
      }
      this.responses.set(profile.version, byExample);
      this.invalidResponses.set(profile.version, invalid);
    }
  }

  async *streamTurn({actionName, profile, query}: TurnInput): AsyncIterable<string> {
    console.log('Using stub LLM response...');
    const exampleName =
      actionName === 'open_ticket'
        ? 'ticket_detail'
        : actionName === 'resolve_ticket'
          ? 'ticket_resolved'
          : 'ticket_list';
    // Demo: a retry's query starts with this (prompt.ts, retryQuery).
    const isRetry = query.startsWith('Your previous response was invalid.');
    const responses = this.invalidFirstAttempt && !isRetry ? this.invalidResponses : this.responses;
    const text = responses.get(profile.version)![exampleName];
    // Demo: STUB_LEAKY streams 80-character chunks, so the notes show up in re-sends.
    const chunkSize = this.leaky ? 80 : Math.ceil(text.length / 4);
    for (let start = 0; start < text.length; start += chunkSize) {
      yield text.substring(start, start + chunkSize);
    }
  }
}

/**
 * Demo: the example messages with each ticket's `internal_notes` (from assets/tickets.json)
 * put back into the data model, and, where a detail view binds `/ticket`, a Text showing them.
 * What `STUB_LEAKY=true` serves.
 */
export function leakInternalNotes(messages: AgentToRendererMessage[], packageRoot: string): AgentToRendererMessage[] {
  const tickets = JSON.parse(fs.readFileSync(path.join(packageRoot, 'assets', 'tickets.json'), 'utf-8')) as {
    id: string;
    internal_notes: string;
  }[];
  const notes = new Map(tickets.map(t => [t.id, t.internal_notes]));
  const withNotes = (t: Record<string, unknown>) => ({...t, internal_notes: notes.get(t.id as string) ?? ''});
  return (JSON.parse(JSON.stringify(messages)) as Record<string, any>[]).map(message => {
    const value = message.updateDataModel?.value;
    if (Array.isArray(value?.tickets)) value.tickets = value.tickets.map(withNotes);
    if (value?.ticket) value.ticket = withNotes(value.ticket);
    const components = message.updateComponents?.components as Record<string, any>[] | undefined;
    const column = components?.find(c => c.id === 'detail_column');
    if (components && column) {
      column.children.splice(column.children.indexOf('detail_description') + 1, 0, 'detail_notes');
      const at = components.findIndex(c => c.id === 'detail_description') + 1;
      components.splice(at, 0, {id: 'detail_notes', component: 'Text', variant: 'caption', text: {path: '/ticket/internal_notes'}});
    }
    return message;
  }) as AgentToRendererMessage[];
}
