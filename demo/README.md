# A2UI demo — AngularDay 2026

Demo for the talk *Your AI Should Not Generate HTML*. Plan and decisions: `../IMPLEMENTATION-PLAN.md`.

```
apps/client      Angular 22 app (SSR server = the A2A client, POST /a2a), renders A2UI via @a2ui/angular
apps/agent       A2A agent (official Node sample pattern: @google/genai + @a2ui/agent), A2UI v0.9
packages/catalog the ticket catalog: Zod 3 ComponentApis, shared by agent and client (@demo/catalog)
```

The browser never speaks A2A: it calls the app's own server, which is the A2A client
(decided 2026-10-22, same shape as the official Angular sample).

**How data moves through the demo, step by step:** [`docs/data-flow/`](docs/data-flow/README.md)
(diagrams and exact payloads; `index.html` there is the interactive map).

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

**Step 5, server-side policy — done (2026-11-06), checked in stub mode.** `apps/agent/src/policy.ts`:
`applyPolicy(messages, policy)` is pure and per message; `enforcePolicy(parts)` wraps it for
`@a2ui/agent`'s response parts and logs one line per strip. `answer()` in `src/agent.ts` calls it in
the two places the plan names: the streaming path's `send()` (every `stream.feed(chunk)` and the
`stream.close()` result, so each re-send of a growing message is filtered) and the
`processor.parseResponse(fullText)` result. Policy (`DEMO_POLICY`): `forbiddenDataPaths:
['/tickets/*/internal_notes', '/ticket/internal_notes']`, `disabledActions: ['delete_ticket']`.
- *What it removes:* from an `updateDataModel` value, every forbidden path (a write whose own path is
  forbidden is dropped whole); from an `updateComponents`, every component carrying a disabled
  action or binding `{path}` to a forbidden path (a relative template path such as `internal_notes`
  counts if it could resolve to one). The tree is mended so the surface stays valid against the
  catalog: the component's subtree goes too (a button's label), parents drop it from `children`, a
  parent holding it in a required single reference (`Card.child`, `Button.child`, `Modal.trigger`
  or `content`) is removed as well, a tab whose `child` goes is dropped from `Tabs.tabs` (and a
  `Tabs` left with none goes too), and a template pointing at it becomes `children: []`. The
  references come from web_core's `getComponentReferences`, so every reference prop the catalogs
  declare counts. If `root` itself goes, a Text ("This view isn't available to you.") takes its
  place, so the surface renders and says why instead of staying blank. Other messages left empty
  are dropped. A string that interpolates a forbidden path (`"${/ticket/internal_notes}"`) counts
  as binding it. Removing a
  component rather than blanking one prop is the only option that keeps a required prop such as
  `Text.text` valid.
- *Something to disable:* the detail example now has a *Delete ticket* button (`delete_ticket`,
  next to *Mark as resolved* in a `detail_actions` row) and the prompt names both actions, so the
  model offers Delete and the policy always removes it, in stub mode too.
- *`STUB_LEAKY=true`:* the canned replies keep each ticket's `internal_notes` (from
  `assets/tickets.json`) in the data model and add a `Text` bound to `/ticket/internal_notes` to the
  detail view: all valid against the catalog. They stream in 80-character chunks, so every message is
  re-sent many times as it grows. Live mode needs no switch: `get_tickets` and the `open_ticket`
  prefetch hand the model the notes on purpose.
- *Checked:* `npm test -w agent` (29 tests). `policy.test.ts`: the leaky list loses
  `/tickets/0..2/internal_notes`, the leaky detail loses `detail_notes`, `delete_button` and its label
  `delete_text`, and both outputs still pass `validatePayload` against the ticket catalog; a `Card`
  whose only child is removed goes too. `agent.test.ts` → "the server-side policy": the raw
  `@a2ui/agent` stream, without the policy, emits `internal_notes` in an `updateDataModel` re-send
  before the last one; through the executor, streamed and non-streamed, list and detail, no published
  message carries `internal_notes` or `delete_ticket`. Headless browser, `STUB_LEAKY=true`: the SSE
  bodies of `POST /a2a` (list: 14 events, 4 `updateDataModel` re-sends; detail: 16 events) hold 0
  `internal_notes`, 0 `delete_ticket`, 0 note text; the detail renders without notes or Delete; the
  agent logged 17 policy lines (e.g. `--- policy: stripped /tickets/0/internal_notes ---` three times,
  once per re-send carrying it). Also checked: plain stub (only the Delete strip), and Express +
  `STUB_LEAKY` + `STUB_INVALID_FIRST` (retry, then the same strips). `ng test`, `ng build` green.
- One thing the plan didn't expect: incident 5 below. Not yet run against the live model.

**Step 6, client-side validation + `VALIDATION_FAILED` back to the agent — done (2026-11-12), checked
in stub mode.** The renderer tells the agent what it could not show, and the agent redoes the turn once.
- *What web_core 0.14.0 does (read in `node_modules`):* `processMessages` validates each component of
  an `updateComponents` against the catalog's Zod (`PayloadValidator.validateComponent`) before applying
  any of them; one bad component throws an `A2uiValidationError` (message `Validation failed for
  component 'X' (id): …`, Zod issues in `details`) and none is applied. `updateDataModel` values are not
  checked, nor is the value a binding resolves to. **It does not report anything:** `VALIDATION_FAILED`
  appears only in the generated client-to-server schema (`v0_9/schema/client-to-server.js`), and the
  only outbound channel (`outboundListener`) is for function calls. `@a2ui/angular` 0.13.0's
  `A2uiRendererService.processMessages` passes the exception straight through. Before this step it
  ended the SSE read loop: the reply stopped where the bad message was.
- *Client (`apps/client`):* `AgentClient` hands web_core one message at a time. When an
  `updateComponents` is rejected, each component is applied on its own and a rejected one becomes a
  placeholder `Text` ("⚠ This part of the answer could not be shown.") under the same id, so the rest
  of the surface renders. `PriorityBadge` checks the value its binding resolves to against the
  catalog's own Zod for that prop (`catalog/resolved-value.ts`) and shows a dashed `?` badge when it
  fails; for a `value | binding` union the message quotes only the value branch, without the binding
  branch's "Expected object" noise. Both file the problem in `ValidationIssues`; once the reply has rendered
  (`ApplicationRef.whenStable()`), `AgentClient` POSTs `{ error: { code: 'VALIDATION_FAILED',
  surfaceId, path, message } }` to `/a2a` (the first issue; the message counts the others). `path` is a
  pointer into the message for a rejected component (`/components/3/priority`), into the data model for
  a bound value (`/tickets/0/priority`). The partly rejected surface stays on screen until the corrected
  reply's first messages arrive. At most 2 reports without a user action in between (a safety cap; the
  agent's own rule stops first). `agent-client.ts` still has no A2A names.
- *Server (`server.ts`):* `{ error }` goes to the agent as an A2A data part `{ version: 'v0.9', error }`
  (`application/a2ui+json`), like an action. An error without string `code`/`surfaceId`/`message`
  (and `path` for `VALIDATION_FAILED`) gets a 400. The agent's text parts go to the browser as
  `{ messages: [], text }` and show above the surface (`agentText`), so the text fallback after a second
  report is visible instead of a page that stays on the `?` badge (added after review, 2026-11-12).
- *Agent:* `readInboundMessage` reads the error (`clientError`). The executor remembers each
  conversation's last turn (`src/client-retry.ts`); on `VALIDATION_FAILED` it logs
  `--- A2UI client reported VALIDATION_FAILED on surface 'tickets' at /tickets/0/priority: … ---` and
  re-generates that turn once with `retryQuery(error)`, the server-side retry's query, then publishes
  the new UI (or the text fallback, if the server-side checks fail twice). A second report about the
  same turn gets the text fallback with no model call. A new prompt or action resets it.
- *`STUB_CLIENT_INVALID=true`:* the first attempt of each turn writes `"priority": "critical"` into the
  **data model** (first ticket of the list, the detail's ticket); the `PriorityBadge` still binds
  `{path: 'priority'}`. The agent's validation passes it: the shared Zod allows a binding and web_core
  does not check data values, on either side. Only the renderer resolves the binding, so only it can
  catch the value. The agent's retry query starts with the retry prefix, so the stub answers it with
  the valid example. Not faked: no validation is skipped anywhere. A component-level rejection
  (web_core throwing) cannot be provoked through the agent, which runs the same check first; it is
  covered by client tests only.
- *Checked:* `npm test -w agent` (41 tests; new `client-retry.test.ts`: error parsing, the
  one-retry rule, and three turns through the executor with `STUB_CLIENT_INVALID`: `critical` goes out,
  the report triggers one retry carrying the error, a second report gets text with no model call).
  `npm test -w client -- --watch=false` (11 tests; new `validation.spec.ts`: a web_core rejection leaves
  the valid components plus a placeholder and reports `/components/3/priority`; a bound `critical` shows
  the `?` badge and reports `/tickets/0/priority`; the corrected reply replaces the drawn surface;
  report cap). `npm run build:client` green. Headless browser, `STUB_CLIENT_INVALID=true`: list renders
  with badges `?, high, medium` → `POST /a2a {error}` with `path /tickets/0/priority` → agent logs the
  report and retries → badges `urgent, high, medium`; *Open* → detail `?` → report
  `/ticket/priority` → `urgent`. A second report sent by hand for the same turn: agent logs `This turn
  was already retried once after a client report. Sending text-only error.`; a malformed error gets
  400. After review (2026-11-12): client 12 tests (the text fallback shows, the surface stays); stub +
  SSR server by `curl`, the second report's SSE carries the fallback as `text`, a normal turn carries
  none. Switch off: plain stub (list → detail → resolved, no error POSTs), `STUB_INVALID_FIRST=true`
  (server-side retry, list renders), one live turn (5 tickets, no error POST).
- One thing the plan didn't expect: incident 6 below. Not checked: the client's report after a live
  model's own bad value (a live model rarely produces one on cue), and Express format with the switch.

**Next:** deck reconciliation (the transport swap, step 7, landed 2026-11-10: `FLOW.md`).

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

**5 · The plan's policy path missed the detail view; ids still stream before their component (2026-11-06, decided in code).**
- *Plan:* `forbiddenDataPaths: ['/tickets/*/internal_notes']`.
- *Found:* the detail view keeps its ticket at `/ticket` (singular, `examples/v0.9/ticket_detail.json`),
  so a model echoing the notes there writes `/ticket/internal_notes`, which that pattern does not
  match. The policy lists both paths. Takeaway for the talk: a path denylist only covers the shapes
  you thought of; a model that writes the notes under another key (`/ticket/notes`) passes it. The
  sturdier fix is upstream of the UI: don't hand the model fields the user may not see.
- *Also found, mid-stream:* the policy is stateless, so it cannot remove a component before that
  component arrives. A parent streamed first still lists its id: the leaky detail's SSE carries
  `"children": [..., "delete_button"]` twice and `detail_notes` five times before the components
  themselves arrive and are removed (with the parent re-sent without them). Only the id reaches the
  browser, never the action or the data, and the renderer shows nothing for a missing child. Ids are
  the model's names; if a name could be sensitive, this would need a stateful filter.

**6 · The corrected reply arrived but the browser kept the rejected badge (2026-11-12, fixed).**
- *Symptom:* with `STUB_CLIENT_INVALID=true`, the agent retried and streamed a valid list; the page
  still showed `?`.
- *Cause:* the surface map is a plain `Map`, not a signal, and `app.ts` tracked surfaces by id. A
  surface deleted and re-created under the same id between two renders kept its `a2ui-v09-surface`
  element, whose components stay bound to the deleted `SurfaceModel`. Incident 4's replacement never
  hit it because the failed attempt had drawn nothing yet.
- *Fix:* `app.ts` tracks by the `SurfaceModel` object (`track entry[1]`). The client test fails with
  `track entry[0]` and passes with it.

## Latency (2026-11-06)

**What happened.** First live run on the ticket domain: every request waited 15-20 s before the
first UI arrived, and one *Open* took about 50 s. Measured with per-call timing in the agent log
(`--- timing: call N first chunk … ms ---`, `src/model.ts`):

| Request | Call 1 (decides to call `get_tickets`) | Call 2 (writes the UI) | First UI |
|---|---|---|---|
| "Show me the open tickets", default thinking | 6.6 s | 10.2 s to first token | ~17 s |
| same, `MINIMAL` thinking | 10.0 s | 3.0 s | ~13 s |
| *Open* ticket, default thinking | 15.5 s, then Gemini **503 "high demand"**, whole turn retried | 11.6 s | ~35 s |
| *Open* ticket, `MINIMAL` thinking | 6.0 s | 7.3 s | ~13 s |

**Why.** Each request was two sequential model calls before any UI: call 1 only returns a
`get_tickets` function call (nothing streams), then the tool runs (instant), then call 2 writes the
UI. `gemini-3.6-flash` thinks before its first token on both calls by default. The 50 s case was a
Gemini 503, which the retry loop logged as "A2UI validation failed" and retried with a correction
prompt.

**What changed.**
1. **Thinking defaults to `MINIMAL`** (`src/model.ts`, `thinkingConfig`): call 2's first token went
   from ~10 s to ~3-7 s. `GEMINI_THINKING_LEVEL` overrides it; `DEFAULT` restores the model's own.
2. **`open_ticket` skips call 1** (`src/user-query.ts`): the click already names the ticket, so the
   agent fetches it itself and puts it in the query (`TICKET_DATA`); the prompt says not to call
   the tool again. Logged as `--- get_tickets {...}, prefetched for open_ticket ---`. Free-text
   questions still go through the model's tool call, so the demo still shows tool calling.
3. **The client says it's working** (`apps/client`, `waitingForUi`): "Agent is working…" from the
   request until the first A2UI message, since the old UI is cleared at once.
4. **Model errors have their own log line** (`src/agent.ts`): only A2UI errors (`A2uiError`, or a
   reply with no A2UI) log `--- A2UI validation failed ---` and retry with the error; anything else
   (e.g. a 503) logs `--- Model call failed: 503 … ---` and retries the original query.

Tests: `latency.test.ts` (thinking default, prefetch) and a 503 case in `agent.test.ts`.
Re-measure after these changes before the rehearsal.

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

Run from `demo/`. `-w agent` / `-w client` picks the npm workspace (`apps/agent`, `apps/client`).

```bash
npm install
npm run build -w agent                                     # once, and after every agent change (builds packages/catalog too)

# terminal 1, the agent on :10002, one of:
npm run start:stub -w agent                                # stub: canned ticket replies, no model, no key
npm run start -w agent                                     # live: Gemini, reads GEMINI_API_KEY from apps/agent/.env
STUB_INVALID_FIRST=true npm run start:stub -w agent        # stub whose first attempt fails validation (shows the retry)
STUB_LEAKY=true npm run start:stub -w agent                # stub that leaks internal_notes (+ Delete), for the policy to strip
STUB_CLIENT_INVALID=true npm run start:stub -w agent       # stub whose first attempt passes the agent and fails the renderer (VALIDATION_FAILED)
GEMINI_THINKING_LEVEL=DEFAULT npm run start -w agent       # live with the model's own thinking (slower, see Latency)

# terminal 2, the client
npm run start:client                                       # http://localhost:4200

npm test -w agent                                          # agent tests (catalog, validate-and-retry, latency, policy, client retry)
npm test -w client -- --watch=false                        # client tests
```

Live mode needs `apps/agent/.env` (gitignored) with `GEMINI_API_KEY=...`; copy `apps/agent/.env.example`.
Optional there: `GEMINI_THINKING_LEVEL` (`MINIMAL` default, `LOW`, `MEDIUM`, `HIGH`, `DEFAULT`), `MODEL_NAME`.
On stage, keep stub mode ready: a live turn depends on Gemini's load (503s seen on 2026-11-06).
