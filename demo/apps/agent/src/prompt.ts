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

// Demo: the support-ticket domain replaces the sample's restaurant finder.
export const ROLE_DESCRIPTION =
  'You are a helpful support desk assistant. You show support tickets to an agent on the support team. Your final output MUST be an A2UI UI definition.';

export const UI_DESCRIPTION_DIRECT_JSON = `
-   Build every surface with the ticket catalog. Use \`TicketList\`, \`PriorityBadge\` and \`AssigneeChip\` for tickets; never write a priority or an assignee as plain text.
-   If the query is for a list of tickets, call the \`get_tickets\` tool first, then use the tickets it returns to populate the \`updateDataModel\` message. You MUST use the \`TICKET_LIST_EXAMPLE\` template.
-   IMPORTANT: When using updateDataModel to update the tickets, you MUST specify \`path: "/"\` with a \`value\` holding \`title\` and \`tickets\`, or \`path: "/tickets"\` with an array of tickets.
-   IMPORTANT: Always specify the path when using updateDataModel. The part message is ignored when the path is missing.
-   A ticket's priority is one of \`low\`, \`medium\`, \`high\`, \`urgent\`. An unassigned ticket has an empty assignee.
-   If the query asks for one ticket's details (e.g., "USER_WANTS_TICKET_DETAILS..."), use the \`TICKET_DATA\` in the query if present (do not call \`get_tickets\` again), otherwise call \`get_tickets\` with its id; then you MUST use the \`TICKET_DETAIL_EXAMPLE\` template.
-   If the query is a resolved ticket (e.g., "User resolved ticket..."), you MUST use the \`TICKET_RESOLVED_EXAMPLE\` template.
`;

export const UI_DESCRIPTION_EXPRESS = `
-   Build every surface with the ticket catalog. Use \`TicketList\`, \`PriorityBadge\` and \`AssigneeChip\` for tickets; never write a priority or an assignee as plain text.
-   If the query is for a list of tickets, call the \`get_tickets\` tool first, then use the tickets it returns to populate the data model. You MUST use the \`TICKET_LIST_EXAMPLE\` template.
-   A ticket's priority is one of \`low\`, \`medium\`, \`high\`, \`urgent\`. An unassigned ticket has an empty assignee.
-   If the query asks for one ticket's details (e.g., "USER_WANTS_TICKET_DETAILS..."), use the \`TICKET_DATA\` in the query if present (do not call \`get_tickets\` again), otherwise call \`get_tickets\` with its id; then you MUST use the \`TICKET_DETAIL_EXAMPLE\` template.
-   If the query is a resolved ticket (e.g., "User resolved ticket..."), you MUST use the \`TICKET_RESOLVED_EXAMPLE\` template.
`;

/** Returns the UI description for the chosen format. */
export function getUiDescription(format: 'direct_json' | 'express'): string {
  return format === 'express' ? UI_DESCRIPTION_EXPRESS : UI_DESCRIPTION_DIRECT_JSON;
}

/**
 * Builds the system prompt around the SDK's prompt snippet.
 *
 * The snippet tells the model how to write A2UI for the negotiated catalogs: the format's
 * rules, the catalog schemas and the examples. The role and the UI description around it
 * are this agent's own.
 */
export function buildSystemPrompt(
  format: 'direct_json' | 'express',
  promptSnippet: string,
): string {
  return [ROLE_DESCRIPTION, getUiDescription(format), promptSnippet].join('\n\n');
}

/** The answer when no attempt produced valid A2UI. */
export const FALLBACK_TEXT =
  "I'm sorry, I'm having trouble generating the interface for that request right now. Please try again in a moment.";

/** The follow-up query sent after a response failed validation. */
export function retryQuery(
  format: 'direct_json' | 'express',
  error: string,
  query: string,
): string {
  return format === 'direct_json'
    ? `Your previous response was invalid. Validation failed: ${error}. You MUST generate a valid response that strictly follows the A2UI JSON SCHEMA. The response MUST be a JSON list of A2UI messages. Ensure each JSON part is wrapped in '<a2ui-json>' and '</a2ui-json>' tags. Please retry the original request: '${query}'`
    : `Your previous response was invalid. Validation failed: ${error}. You MUST generate a valid response that is valid A2UI Express wrapped in the '<a2ui>' and '</a2ui>' tags. Please retry the original request: '${query}'`;
}
