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

import type {InboundMessage} from './a2a.js';
import {executeGetTickets} from './tools.js';

/** What the agent needs from one inbound A2A message. */
export interface UserQuery {
  /** The text sent to the model. */
  query: string;
  /** The name of the UI action the user took, if the message carries one. */
  actionName?: string;
  /** False when the client wants every part in the final status instead of streamed. */
  useStreaming: boolean;
}

/**
 * Turns an inbound message into a model query. UI actions from the ticket surfaces
 * become the sentences the prompt expects; plain text is passed through.
 */
export function buildUserQuery({text, action, useStreaming}: InboundMessage): UserQuery {
  if (!action) {
    return {query: text || 'Hello!', useStreaming};
  }

  const {name: actionName, context: ctx} = action;
  let query: string;
  // Demo: the ticket actions replace book_restaurant and submit_booking.
  if (actionName === 'open_ticket') {
    const ticketId = (ctx.ticketId as string) ?? 'Unknown ticket';
    // Demo: the click already names the ticket, so the agent fetches it here instead of
    // letting the model spend a whole call deciding to call get_tickets (6-10 s each,
    // README "Latency"). Free-text questions still go through the model's tool call.
    const ticket = executeGetTickets({ticketId}, undefined, 'prefetched for open_ticket');
    query =
      `USER_WANTS_TICKET_DETAILS: ${ticketId}\n` +
      `TICKET_DATA (already fetched with get_tickets; do not call it again): ${ticket}`;
  } else if (actionName === 'resolve_ticket') {
    const ticketId = (ctx.ticketId as string) ?? 'Unknown ticket';
    const title = (ctx.title as string) ?? '';
    query = `User resolved ticket ${ticketId}: "${title}". Confirm that it is marked as resolved.`;
  } else {
    query = `User submitted an event: ${actionName} with data: ${JSON.stringify(ctx)}`;
  }
  return {query, actionName, useStreaming};
}
