# A2UI demo — AngularDay 2026

Demo for the talk *Your AI Should Not Generate HTML*. Plan and decisions: `../IMPLEMENTATION-PLAN.md`.

```
apps/client      Angular 22 app (SSR server = the A2A client, POST /a2a), renders A2UI via @a2ui/angular
apps/agent       A2A agent (official Node sample pattern: @google/genai + @a2ui/agent), A2UI v0.9
packages/catalog the ticket catalog: Zod 3 ComponentApis, shared by agent and client (@demo/catalog)
```

The browser never speaks A2A: the client will call the app's own server, which is the A2A client
(decided 2026-10-22, same shape as the official Angular sample).

## Status

One Mermaid diagram per phase, drawn as frames of the same graph: `FLOW.md`.

**Step 1, render without an agent — done (2026-10-22).** The client renders a hardcoded A2UI v0.9
message (`apps/client/src/app/booking-form.json`, copied from the official Node agent sample) with the
basic catalog. Checked in a browser: typing into fields sends nothing; *Submit Reservation* fires one
`submit_booking` action whose `context` carries the typed values. Actions are logged to the console.

**Step 2, the full chain in stub mode — done (2026-10-22).** Browser → `POST /a2a` (the client's
own server) → A2A `message/stream` → agent → A2UI messages back as SSE → renderer. Checked in a
browser: prompt → restaurant list → *Book Now* → booking form → *Submit* → confirmation.
- Gotcha found: the agent reads a UI action inside a v0.9 envelope, `{ version: 'v0.9', action }`,
  or as the legacy `{ userAction }` (fallback in `apps/agent/src/a2a.ts`). A bare action, which is
  what the renderer hands the client, is ignored and the agent answers as if it were a new query.
  The bridge wraps it (`apps/client/src/server.ts`). Corrected 2026-11-02 after testing all three
  shapes against the stub agent: envelope and `userAction` both return the booking form, the bare
  action returns the restaurant list again. (This note first said `userAction` was ignored too.)
- Angular 22 SSR rejects unlisted hosts: `localhost` is in `angular.json` → `security.allowedHosts`.

**Step 3, live model — done (2026-10-31).** `GEMINI_API_KEY` in `apps/agent/.env` (gitignored),
model `gemini-3.6-flash`. Checked in a browser, live: prompt → 3 real restaurants (via the
`get_restaurants` tool) → *Book Now* → booking form → *Submit* → confirmation, with the action's
`context` carrying the resolved values. Stub mode re-checked end to end. Two incidents on the way
(below): `@a2ui/agent` upgraded 0.0.1 → 0.0.2, and the agent now validates with `@a2ui/web_core`'s
Zod basic catalog, the one the renderer uses.
- Stub only: the canned confirmation's `[ImageUrl]` placeholder 404s. Stub data, not code.

**Step 4, Zod catalog + ticket domain — done (2026-11-06), checked in stub mode.**
`packages/catalog` (`@demo/catalog`, `zod@3.25.76`, the copy `@a2ui/web_core` uses) defines one
`ComponentApi` per custom component (`TicketList`, `PriorityBadge`, `AssigneeChip`) and reuses the
basic `TextApi`/`RowApi`/`ColumnApi`/`CardApi`/`DividerApi`/`ButtonApi` as they are, assembled with
`new Catalog(TICKET_CATALOG_ID, 'v0.9', components, [], { themeSchema, … })`;
`ticketCatalogDocument()` returns `toJson()`. Id:
`https://github.com/giorgiogalassi/talk-a2ui/demo/catalogs/tickets/v0_9/catalog.json`.
- *Agent:* registers that Zod `Catalog` next to the basic one (`src/catalogs.ts`); the prompt carries
  its `toJson()` document, validation runs on its Zod. Restaurants replaced: `get_tickets` over
  `assets/tickets.json` (8 tickets, with `internal_notes` for step 5's policy to strip; the tool
  returns them whole), ticket examples (`ticket_list`, `ticket_detail`, `ticket_resolved`), actions
  `open_ticket` and `resolve_ticket`, agent card. The stub notice moved to the ticket catalog.
- *Client:* `apps/client/src/app/catalog/`: three components extending
  `CatalogComponent<typeof XApi>` (props typed from the Zod schemas, e.g. `priority` is
  `'low' | 'medium' | 'high' | 'urgent'`), registered with `createComponentImplementation(XApi, …)`
  in an `AngularCatalog` with the same id. `server.ts` sends `supportedCatalogIds: [TICKET_CATALOG_ID]`
  only; `BasicCatalog` stays registered in the renderer.
- *Checked:* `npm test -w agent` (13 node:test tests: a `PriorityBadge` priority of `critical`
  fails validation, the retry query carries the error, attempt 2's UI is published and `critical`
  never is, on the streamed and the non-streamed path; both attempts invalid → text fallback; the
  `toJson()` document loads with `InMemoryCatalogProvider`; examples valid). `ng test` (the renderer
  catalog holds the agent catalog's schema objects). Stub chain in a headless browser: prompt →
  ticket list (badges, chips, "Unassigned") → *Open* → detail → *Mark as resolved* → confirmation,
  no console errors. `STUB_INVALID_FIRST=true` (first attempt sends `critical`) renders the retried
  list. Express format checked with the stub too.
- Two things the plan didn't expect: incidents 3 and 4 below.

**Next:** server-side policy, `applyPolicy` (step 5).

## Incidents

**1 · Live list rendered empty: `@a2ui/agent` 0.0.1 dropped `path` from streamed data (2026-10-31, fixed).**
- *Symptom:* live mode showed the list title and nothing else. Stub mode never hit it (4 big chunks).
- *Cause:* `sniffPartialDataModel` in `direct-json/streaming.js` builds streaming deltas from the
  keys of `value` and drops `path`. The model sent `{ path: "/items", value: [...] }`, so the
  deltas landed at the data-model root as `"0"`, `"1"`, `"2"`. When the complete message closed,
  its dedupe check compared it to those same keys, found nothing new, and never sent it.
- *Fix:* upgraded to **0.0.2** (2026-10-24), which rewrote the streaming parser
  (`DirectJsonResponseStream`, whole messages re-sent as they grow, `path` kept). `src/agent.ts` replaced
  with the sample's file at the release commit `409ded29cc`; ours was the unmodified 0.0.1-release file, and
  the other `src/` files are unchanged upstream between the two releases.
- *Knock-on:* 0.0.2 checks each reply against a fresh renderer state, so every reply carries its
  `createSurface` again. The client cleared surfaces only on a new prompt, so the first action failed
  with "Surface stub-notice already exists". `agent-client.ts` now clears them before every request,
  as the official Angular sample does.

**2 · Booking form fails client validation: agent and renderer check different schemas (2026-10-31, fixed).**
- *Symptom:* after *Book Now* (live), the renderer shows "Validation failed for component 'Button'
  (submit_button): action.event.context.imageUrl …" and the form renders with an empty title and an
  unlabelled button. The complete button, its label and the data arrive afterwards; the surface
  does not recover.
- *What streamed:* event 12 of the reply carries the button with `"imageUrl": {}`, the model's
  `{"path": "/imageUrl"}` cut at the chunk boundary right after `{`. Event 13 has the complete
  binding. The model's final message is valid.
- *The parser behaves as designed:* it emits a growing message only if the agent's renderer
  state accepts it, and holds it back otherwise ("Held back, and checked again as it grows",
  `response-stream.js`). So a `{}` the agent rejected would have waited for event 13.
- *Cause:* the agent's state accepted `{}`. The agent loads the basic catalog from JSON
  (`catalogs/v0_9/basic_catalog.json` via `FileSystemCatalogProvider`); after conversion to Zod,
  an action's `context` is `Record<unknown>`. The renderer uses `@a2ui/web_core`'s hand-written
  Zod, where it is `Record<string | number | boolean | array | {path} | function call>`. Checked
  with the same button sent to both (2026-10-31): `{path}` passes both; `{}` and `{zz: 1}` pass the
  agent and fail the renderer; `action: 42` fails both.
- *Takeaway:* validation is only as strong as the schema each side holds. Two copies of "the same"
  catalog drifted; one shared Zod source (step 4, `packages/catalog`) removes the gap.
- *Fix:* `apps/agent/src/catalogs.ts` serves v0.9 with `basicCatalog` from
  `@a2ui/web_core/v0_9/basic_catalog` instead of the JSON file. Both produce the same catalog
  document (equal ignoring key order), so the prompt is unchanged. With it, the agent rejects `{}`
  and `{zz: 1}`, a stream cut inside the binding holds the message back, and the live booking form
  streams with no `{}` binding (0 in 12 events). Same version on both sides: `@a2ui/web_core@0.14.0`,
  deduped. Step 4 extends the same idea to the custom catalog.
- *Upstream:* the official Node sample loads the same JSON, so it has the same gap. Not reported yet.

**3 · The plan's `InMemoryCatalogProvider` would reopen incident 2 (2026-11-06, decided in code).**
- *Plan:* load `catalog.toJson()` with `InMemoryCatalogProvider` in the agent.
- *Found:* it loads cleanly (same id, version `v0.9`, same 9 components; the `PriorityBadge` enum
  survives). But the provider rebuilds Zod from JSON Schema, so a `Button`'s action `context` is
  `Record<unknown>` again: `{ ticketId: {} }` passes the reloaded catalog and fails the Zod one,
  exactly incident 2. `catalogs.test.ts` shows both.
- *Done instead:* the agent registers the Zod `Catalog` object itself with `CatalogConfig`. The model
  still reads the generated document (`@a2ui/agent`'s prompt generator writes `catalog.toJson()`),
  so one Zod source feeds prompt, agent validation and renderer. Switching to the provider is one
  line in `src/catalogs.ts` if wanted.

**4 · A streamed retry broke the client: "Surface stub-notice already exists." (2026-11-06, fixed).**
- *Symptom:* with the first attempt invalid (`STUB_INVALID_FIRST=true`), the browser showed that
  error and no ticket list.
- *Cause:* when streaming, attempt 1 publishes its `createSurface` messages before the bad component
  arrives; the retry re-sends them; `MessageProcessor` throws on a second `createSurface` for the
  same id, and the exception ends the SSE read loop. The agent did its part: `critical` never left it.
- *Fix:* `agent-client.ts` deletes a surface when a new `createSurface` for its id arrives, so the
  retry replaces what the failed attempt drew. Checked in the browser with and without the fix.

## Versions

- Angular **22.2.3**. `@a2ui/angular@0.13.0` declares `@angular/*@^21.2.5` as peers, so the root
  `package.json` overrides them to `^22.2.3`. Builds and renders with no console errors. Drop the
  override once the package lists Angular 22.
- `zod@3.25.76` in `packages/catalog`, deduped with `@a2ui/web_core`'s and `@a2ui/angular`'s
  (Zod 3, not 4: `ComponentApi` is typed against Zod 3).
- `@a2ui/web_core@0.14.0`, `@a2ui/markdown-it@0.2.2`, `@a2ui/agent@0.0.2` (pinned; was 0.0.1 until
  2026-10-31, see incident 1. `src/agent.ts` must match the sample at the pinned release's commit).
- `@a2a-js/sdk@^0.3.13` on both sides (A2A v0.3), like the official samples (decided 2026-10-22).

## Run

```bash
npm install
npm run build -w agent && npm run start:stub -w agent     # terminal 1, :10002 (builds packages/catalog too)
npm run start:client                                       # terminal 2, http://localhost:4200
npm test -w agent                                          # catalog + validate-and-retry tests
STUB_INVALID_FIRST=true npm run start:stub -w agent        # stub whose first attempt fails validation
```
