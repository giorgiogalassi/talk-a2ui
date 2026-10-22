# Implementation Plan — A2UI Demo (AngularDay 2026)

**This is the living build-tracking doc** for the demo project (client +
agent) behind the AngularDay talk "Your AI Should Not Generate HTML." It
covers project structure, build scope, the practical build order for both
agent and client, known technical risks, open items, and the decisions
changelog. For audience-facing "why" answers and anticipated Q&A, see
**`QA.md`** in this same folder — the two docs cross-reference rather than
duplicate.

Last updated: 2026-10-21 (Angular sample found; client steps 4–6 revised).

---

## Known technical risk: A2A protocol version

The A2UI-in-A2A `DataPart` shape differs by A2A protocol version — under
**A2A v1.0**, `data` is a **list** of A2UI messages; under earlier versions
(v0.3 and before), `data` is a **single JSON object**. A2UI's own current docs
(the Actions page's "A2A Encoding" example, fetched 2026-07-24) already show
the list-shaped example as the current standard — meaning current A2UI
(v0.9.1-era) is documented assuming A2A v1.0. **Recommendation: target v1.0
explicitly** to match what current A2UI docs actually show, rather than
defaulting to whatever the stable tag installs. Still do a cheap empirical
spike first (build order step 2 below) — stand up a minimal `AgentExecutor`
+ `AgentCard`, send one message, inspect the literal JSON — since this SDK
version can lag its own docs. Fallback if it's too rough close to the
deadline: hand-wrap the array yourself even on the stable release; A2UI only
cares about the JSON shape on the wire, not which SDK version produced it.

**Correction (2026-07-24, session 5): "alpha," not "beta," and it's not
fully backward-compatible yet.** Checked the actual [`@a2a-js/sdk`
README](https://github.com/a2aproject/a2a-js#compatibility) directly: the
default stable release implements A2A **v0.3** (latest: `v0.3.13`). The
v1.0-targeting release is an **alpha** (`npm install @a2a-js/sdk@next`,
developed on the `epic/1.0_breaking_changes` branch) — one stage earlier than
"beta." Backward compatibility with v0.3 for that alpha is tracked as **still
open**, [issue #452](https://github.com/a2aproject/a2a-js/issues/452) — so
the v1.0 alpha may not gracefully interop with v0.3 clients/agents yet. This
raises the stakes on the empirical spike (build order step 2): confirm not
just the `DataPart` shape, but whether the alpha is stable enough to build a
whole demo on this close to the deadline, or whether hand-wrapping the array
on the stable v0.3 release is the safer bet in practice.

---

## Project structure (decided 2026-07-24, session 3)

**Monorepo, for both the demo and (by default) production**, for related but
distinct reasons:

- **Demo:** a light one — npm/pnpm workspaces, no Nx/Turborepo (no benefit
  from build-caching or affected-project detection at two-apps-plus-a-package
  scale). Structure: `packages/catalog` (Zod definitions + generated JSON
  Schema), `apps/agent` (Genkit + A2A server), `apps/client` (Angular). A
  VS Code multi-root `.code-workspace` on top is a nice editor convenience,
  not the actual value — the shared package is what matters.
- **Production:** same structure remains the right default, because catalog
  drift between client and agent is a real bug class, and a monorepo makes
  "both sides build against the same file" structural rather than a
  discipline. The fork point to watch for is **organizational, not
  technical**: if client and agent are ever owned by different teams with
  independent release cadences, publish the catalog as a versioned package
  instead of a workspace reference, and lean on the protocol's own catalog
  versioning (major/minor via `catalogId`, graceful degradation) — that
  machinery exists specifically for the decoupled-repo case.

---

## Server agent build scope (confirmed 2026-07-24 against current protocol docs)

Ordered checklist, scoped tightly to what the section 6 demo beats actually
require — see the demo's 7 stages in `slides.md`. Each item below maps to one
or more of those stages.

**In scope:**

1. **Catalog** — one JSON Schema file for the ticket dashboard (e.g.
   `TicketList`, `PriorityBadge`, `AssigneeChip`, `Button`), shared verbatim
   with the client, known at build time on both sides (not runtime-fetched).
   Source of truth is Zod (`packages/catalog`), JSON Schema is generated via
   Zod v4's native `z.toJSONSchema()` — **not** `zod-to-json-schema`, which is
   broken against Zod v4 (confirmed 2026-07-24, session 4: the external
   package, last built for Zod v3, silently returns an incomplete schema —
   just `{"$schema": "..."}`, no `properties` or `required` — which tells
   Gemini to ignore structured-output constraints entirely and return
   arbitrary field names instead of respecting the catalog; this is a
   documented, reported gotcha, not a hypothetical). For the Gemini call
   itself, current `@google/genai` SDK usage is
   `config.responseJsonSchema = z.toJSONSchema(schema)` paired with
   `config.responseMimeType = 'application/json'`.

   **Precise capability-negotiation mechanism** (confirmed 2026-07-24 against
   current docs): the catalog's wire artifact is a plain JSON Schema file
   (`{catalogId, components, functions?, theme?}`); the `catalogId` is a
   stable identifier, **not fetched at runtime** — both agent and client must
   already have the matching schema file at build/deploy time. In practice:
   the client sends `a2uiClientCapabilities.supportedCatalogIds` (an array of
   catalog URIs) in the metadata of every A2A message; the agent picks one it
   recognizes when it calls `createSurface`. For our one-catalog demo this is
   close to trivial — no real multi-catalog negotiation logic needed.

   **Decision (2026-07-24, session 3): Zod is our source, JSON Schema is
   generated.** CopilotKit's `@copilotkit/a2ui-renderer` (a different
   transport — AG-UI, not A2A — so not directly usable here) confirms
   Zod-as-catalog-source is a legitimate, already-used pattern in the
   ecosystem. We're doing the equivalent for our stack: define catalog
   components in Zod (TS type safety, reusable for typing the Angular catalog
   components' props, keeps the "Kneel Before Zod" narrative intact), then
   convert to the JSON Schema artifact the protocol expects. Zod lives in
   code; JSON Schema is a generated build output, not hand-written.

   **Gemini constrained-decoding gotcha, confirmed 2026-07-24 (session 5):**
   Gemini's constrained decoding doesn't support the full JSON Schema
   vocabulary — complex unions are often problematic, and validation keywords
   like `pattern`, `minLength`, `maxLength`, `minItems`, `maxItems` are
   silently ignored or rejected. If the catalog's Zod schemas use
   `z.string().regex()`, `.min()`/`.max()`, etc. (reasonable things to want on
   a `PriorityBadge` enum or similar), those constraints won't reach Gemini as
   generation constraints — they'll still work for our own post-generation
   `.safeParse()` validation (step 6 below), but budget for Gemini producing
   output that's *shape-valid* yet occasionally violates a refinement Gemini
   never saw. Two options: keep refinements loose in the schema passed to
   Gemini and rely on the retry loop to catch violations, or maintain a
   stripped-down "generation schema" separate from the stricter "validation
   schema" — decide this during step 5's iteration, not before.

2. **Capability read** — read `a2uiClientCapabilities.supportedCatalogIds`
   from incoming A2A message metadata; confirm our one catalog ID is in it.
   No real negotiation logic needed for a single-catalog demo.
3. **Mock data tool** — one Genkit tool returning a small hardcoded ticket
   array. Not a real ticketing system integration.
4. **Prompt assembly + structured generation** — the real engineering work.
   Confirmed again (2026-07-24, session 3, two independent searches): no
   TypeScript equivalent of Python's `a2ui-agent-sdk` / `A2uiSchemaManager`
   exists — it's PyPI-only, wired for ADK. CopilotKit's parallel tool
   (`@copilotkit/a2ui-renderer`) doesn't help either — different transport
   (AG-UI, not A2A). So this is fully hand-built: role description, the
   generated catalog schema (or a trimmed subset), and worked example message
   sequences, assembled into Genkit's system prompt. Budget real iteration
   time — this is a feature, not a config step.
5. **Agent-side pre-send validation** — validate generated JSON against the
   catalog schema (`ajv`, or Zod's own `.safeParse` against the source
   schemas directly, skipping the JSON Schema round-trip for this specific
   check) before transmitting — official "phase one" of the spec's two-phase
   validation model. **Decision: build a minimal self-correcting retry, not
   just talk about it** — on failure, call `generate()` again with the error
   appended as corrective context, capped at one retry. Cheap with Genkit,
   and gives a real demonstrable moment instead of a claimed one. Same retry
   code path is reused for item 9.
6. **Policy enforcement** — one pure function,
   `applyPolicy(messages, policy) → messages`, run after generation and
   validation, before transport send. One hardcoded `Policy` object for the
   demo (e.g. `{ forbiddenDataPaths: ['/tickets/*/internal_notes'],
   disabledActions: ['delete_ticket'] }`). Walks `updateDataModel` messages
   and drops matching paths; walks `updateComponents` messages and strips (or
   disables) any component whose `action.event.name` matches a disabled
   action. No LLM involved, deterministic, logs what it stripped (feeds the
   Observability argument). This function is the code behind the deck's demo
   step 3. Not a real RBAC system.
7. **A2A server wiring** — Express + `AgentExecutor`, messages published as a
   `DataPart` tagged `mimeType: application/a2ui+json`. Plus a
   `.well-known/agent-card.json`: the RFC 8615 standard discovery path (same
   family as `.well-known/openid-configuration`) — any A2A client can `GET`
   it to learn the agent's name, description, and capabilities/extensions
   (optionally including a `supportedCatalogIds` hint) with zero prior
   config. One static JSON file served by the Express app; lives inside
   `apps/agent`, not its own package — it's part of that one service's
   public surface, not shared with the client.
8. **Deliberately-broken-node beat** — script this, don't rely on the model
   misbehaving on cue. On a specific trigger, skip pre-send validation once
   on purpose so the client's rejection is guaranteed to fire live.
9. **Receiving `VALIDATION_FAILED`** — confirmed real and precisely specified:
   `{"version": "v0.9", "error": {"code": "VALIDATION_FAILED", "surfaceId",
   "path", "message"}}`. **Same decision as item 5**: build the minimal
   self-correcting retry (reuse the same retry function), not just log and
   narrate it. Full autonomous multi-turn self-correction beyond one retry
   remains a stretch goal, not required.
10. **Follow-up `updateDataModel` push** — script a deterministic second
    message a few seconds after initial render, rather than depending on an
    unprompted second model turn. Three reasons, not just demo caution:
    (a) *technical* — LLMs don't spontaneously emit output; something
    external must trigger this turn regardless of what we choose;
    (b) *architectural* — a single-field update is a data mutation, not a
    composition decision, so constructing `{surfaceId, path, value}`
    programmatically is simpler and more correct than routing a non-decision
    through an LLM call; (c) *demo-practical* — this beat's entire point is
    a precisely-timed moment (the DevTools profiler showing one component
    re-evaluating), and tying that timing to model latency variance risks
    the one visual proof point the beat exists to deliver.

## Practical build order — agent (2026-07-24, session 4)

The scope list above answers *what*; this answers *what order, and how you
know each step actually works* — sequenced so the highest-risk item is
resolved first, and every step has its own test checkpoint rather than
discovering problems only at the end.

1. **Repo skeleton.** `packages/catalog`, `apps/agent`, `apps/client` as
   npm/pnpm workspaces. Install in `apps/agent`: `genkit`,
   `@genkit-ai/googleai`, `zod@^4`, `express`, `@a2a-js/sdk` (pinned to the
   version chosen in step 2, not "latest"). `.env` with a Gemini API key from
   AI Studio — Vertex AI is a production concern, not needed locally.
   *Done when:* clean install in a fresh clone.
   **Links:** [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces) ·
   [Genkit — Get started](https://genkit.dev/docs/get-started/) ·
   [Zod v4 release notes](https://zod.dev/v4) ·
   [`@a2a-js/sdk` README](https://github.com/a2aproject/a2a-js) ·
   [Get a Gemini API key (AI Studio)](https://aistudio.google.com/apikey)
2. **A2A empirical spike — before anything depends on it.** Smallest possible
   `AgentExecutor` + `AgentCard`, no Genkit, no catalog, a hardcoded response.
   Send one message via `ClientFactory`, inspect the literal `DataPart.data`
   shape. *Done when:* you've seen the real wire shape yourself, resolving
   the top risk item before building anything on top of an assumption.
   **Links:** [`@a2a-js/sdk` README — Quickstart](https://github.com/a2aproject/a2a-js#quickstart)
   (has a complete, runnable `AgentExecutor` + `ClientFactory` example to copy
   almost verbatim) ·
   [A2A v1.0 alpha releases](https://github.com/a2aproject/a2a-js/releases?q=%22v1.0.0-alpha%22&expanded=true) ·
   [backward-compat tracking issue #452](https://github.com/a2aproject/a2a-js/issues/452) ·
   [A2A protocol spec](https://a2a-protocol.org/latest/specification/) ·
   [A2UI Actions — A2A Encoding](https://a2ui.org/concepts/actions/#a2a-encoding)
   (the `DataPart` shape to check for)
3. **Catalog package.** Zod schemas for the four components, converted with
   `z.toJSONSchema()`, assembled into `{catalogId, components}`. *Done when:*
   a quick script prints a schema with real `properties`/`required` fields —
   confirms you're not hitting the `zod-to-json-schema`-style failure mode.
   **Links:** [Zod — JSON Schema conversion](https://zod.dev/json-schema) ·
   [A2UI — Catalogs concept](https://a2ui.org/concepts/catalogs/) ·
   [A2UI — Defining Your Own Catalog](https://a2ui.org/guides/defining-your-own-catalog/) ·
   [example catalog (Rizzcharts)](https://github.com/a2ui-project/a2ui/blob/main/samples/community/agent/adk/rizzcharts/catalog_schemas/0.9/rizzcharts_catalog_definition.json)
   for shape reference
4. **Mock data.** Small hardcoded ticket array (include `internal_notes` on
   some rows), wrapped as one Genkit tool. *Done when:* calling it directly
   returns the array.
   **Links:** [Genkit — Tool calling](https://genkit.dev/docs/tool-calling/)
5. **Prompt assembly + structured generation — test in isolation from A2A
   entirely.** System prompt (role description + embedded catalog schema +
   2–3 worked examples), a Zod schema for "array of A2UI messages" passed to
   Gemini via `config.responseJsonSchema` + `responseMimeType`, a Genkit flow
   tying it together. Run the exact demo prompt repeatedly in the Genkit
   Developer UI — LLM output varies run to run. *Done when:* five consecutive
   runs all produce structurally valid, catalog-conformant output with no
   manual fixing. Mind the constrained-decoding limitations noted above.
   **Links:** [Genkit — Defining AI workflows (flows)](https://genkit.dev/docs/js/flows/) ·
   [Genkit by Example — Structured Output](https://examples.genkit.dev/structured-output) ·
   [Genkit — Google Generative AI plugin](https://genkit.dev/docs/js/integrations/google-genai/) ·
   [Zod v4 & Gemini structured output fix](https://www.buildwithmatija.com/blog/zod-v4-gemini-fix-structured-output-z-tojsonschema)
   (the `z.toJSONSchema` + `responseJsonSchema` wiring, concretely) ·
   [Gemini — Structured output docs](https://ai.google.dev/gemini-api/docs/structured-output) ·
   [A2UI — Agent Development guide](https://a2ui.org/guides/agent-development/)
   (Python-only, but the prompt-shape reasoning transfers) ·
   [A2UI — Message Reference](https://a2ui.org/reference/messages/)
   (exact shape of every message type to constrain the Zod schema against)
6. **Pre-send validation + minimal self-correction.** `.safeParse()` against
   the Zod message schema directly (no `ajv`, no JSON-Schema round-trip
   needed — you already have the Zod source). One retry on failure, corrective
   context appended; scripted safe fallback on second failure. *Done when:*
   deliberately corrupting the schema triggers the retry and it recovers.
   **Links:** [Zod — `.safeParse()`](https://zod.dev/basics#parsing-data) ·
   [A2UI — Catalogs: A2UI Schema Validation & Fallback](https://a2ui.org/concepts/catalogs/#a2ui-schema-validation-fallback)
   (the official "two-phase validation" this step implements)
7. **Policy enforcement.** `applyPolicy(messages, policy)` with the one
   hardcoded policy. *Done when:* a unit test with `internal_notes` and a
   `delete` action confirms both are stripped/disabled.
   **Links:** none needed — plain deterministic TypeScript, no external API.
8. **Wire into the real A2A server.** Connect steps 3–7 into the
   `AgentExecutor` from step 2: read `supportedCatalogIds`, run the flow,
   publish as a tagged `DataPart`, add the real `.well-known/agent-card.json`.
   *Done when:* the demo prompt through `ClientFactory` end-to-end returns a
   policy-filtered, validated message sequence — no client involved yet.
   **Links:** [`@a2a-js/sdk` README — Server: Hello World Agent](https://github.com/a2aproject/a2a-js#server-hello-world-agent)
   (shows `agentCardHandler` serving `.well-known/agent-card.json`
   automatically via the Express integration — you don't hand-write the
   route) · [A2UI — Catalog Negotiation](https://a2ui.org/concepts/catalogs/#a2ui-catalog-negotiation)
9. **Scripted failure beat + `VALIDATION_FAILED` receiver.** Add the trigger
   that deliberately skips validation once. Since there's no real client yet,
   write a small test script that sends a `VALIDATION_FAILED` error back at
   the agent and confirm it's received, logged, and triggers the same retry
   path from step 6 (per this session's decision — a real loop, not a log
   line).
   **Links:** [A2UI — Renderer-to-Agent Error Reporting](https://a2ui.org/concepts/actions/#renderer-to-agent-error-reporting)
   (the exact `VALIDATION_FAILED` payload shape to construct in the test script)
10. **Scripted `updateDataModel` push.** Deterministic follow-up message,
    constructed directly, no LLM call. *Done when:* triggering it sends a
    second well-formed message on its own.
    **Links:** [A2UI — Message Reference: `updateDataModel`](https://a2ui.org/reference/messages/#datamodelupdate-v08-updatedatamodel-v09)
11. **Full local dry run.** Standalone agent, driven through the exact
    section-6 demo script with a test harness (not the real Angular client) —
    prompt → capabilities → generation → policy → validation → scripted
    failure → scripted push. This is "ready to be tested" in the sense that
    matters: everything the client will eventually talk to is already proven
    correct on its own, so a later client-side problem can't hide an
    agent-side one.
    **Links:** none needed — this is your own test harness, exercising
    everything built in steps 1–10.

---

## Client (Angular) practical build order (2026-07-24, session 5)

Same structure as the agent's build order: risk-ordered, one test checkpoint
per step. This assumes the agent from steps 1–11 above is already running
locally and independently testable — the client's job is to talk to it, not
to re-prove it works.

1. **Angular app scaffold.** `ng new` (Angular **v21** — `@a2ui/angular`
   requires it), inside `apps/client` of the monorepo. Install
   `@a2ui/angular @a2ui/web_core`.
   *Done when:* the default Angular app runs.
   **Links:** [Angular CLI — `ng new`](https://angular.dev/tools/cli/setup-local) ·
   [A2UI — Client Setup guide](https://a2ui.org/guides/client-setup/) ·
   [A2UI — Renderers reference](https://a2ui.org/reference/renderers/)
2. **Angular catalog API empirical check — mirrors the agent's A2A spike,
   same reasoning.** Current docs show **two different-looking APIs** across
   two pages, and it's not yet confirmed how they fit together in the actual
   installed package: `A2UI_RENDERER_CONFIG` / `A2uiRendererService` /
   `BasicCatalog` (providers-based bootstrap) on one page, versus `Catalog` /
   `DynamicComponent` / `inputBinding` (component-authoring primitives, plain
   `@Input()` properties — not signals, contradicting the deck's
   `BasicCatalogComponent<T>` / computed-signal claims) on another. Before
   designing real catalog components, wire the absolute minimum — BasicCatalog
   only, a static hardcoded A2UI JSON payload, no agent involved — to see how
   these two pieces actually compose.
   *Done when:* a hardcoded payload renders through `BasicCatalog`, and you
   can point to exactly where `Catalog`/`DynamicComponent` fits relative to
   `A2UI_RENDERER_CONFIG`.
   **Links:** [A2UI — Client Setup: Angular setup example](https://a2ui.org/guides/client-setup/#angular) ·
   [A2UI — Catalogs: Implementing Renderers](https://a2ui.org/concepts/catalogs/#implementing-renderers)
   (the `Catalog`/`DynamicComponent`/`inputBinding` example) ·
   [working Angular catalog example (orchestrator sample)](https://github.com/a2ui-project/a2ui/blob/main/samples/community/client/angular/projects/orchestrator/src/a2ui-catalog/catalog.ts) ·
   [`@a2ui/angular` renderer source](https://github.com/a2ui-project/a2ui/tree/main/renderers/angular)
   (note: the deck's citations point at the old `google/A2UI` path — the repo
   moved to `a2ui-project/a2ui`; use this path instead)
3. **Custom catalog components.** Author `TicketList`, `PriorityBadge`,
   `AssigneeChip`, `Button` Angular components consuming the shared
   `packages/catalog` Zod definitions for prop typing, registered per
   whatever base class/pattern step 2 confirms.
   *Done when:* all four render correctly against hand-written test payloads
   (no agent yet).
   **Links:** [A2UI — Authoring Custom Components](https://a2ui.org/guides/authoring-components/) ·
   [A2UI — Defining Your Own Catalog](https://a2ui.org/guides/defining-your-own-catalog/) ·
   [A2UI — Component Gallery](https://a2ui.org/reference/components/)
   (the Basic Catalog's own components, as a model for shape/conventions)
4. **A2A client wiring — in the server, not the browser (revised
   2026-10-21).** The official Angular sample
   (`samples/client/angular/projects/restaurant`, present since at least
   2026-08-12) puts the A2A client in the SSR Express server (`src/server.ts`):
   `A2AClient.fromCardUrl('<agent>/.well-known/agent-card.json')` with an
   `X-A2A-Extensions: https://a2ui.org/a2a-extension/a2ui/v0.9` header, exposed
   to the browser as a plain `POST /a2a` that answers with SSE. The browser
   never speaks A2A. **Decided for the demo too (Giorgio, 2026-10-22)**: agent credentials and
   policy enforcement stay server-side, and the agent URL is never exposed.
   This supersedes the July assumption that the browser itself calls
   `ClientFactory().createFromUrl(...)`. Still include
   `a2uiClientCapabilities.supportedCatalogIds` in the outgoing A2A message
   metadata (the sample sends `a2uiClientCapabilities` on every message).
   *Done when:* `POST /a2a` with a text query reaches the locally-running
   agent and streams a response back.
   **Links:** [Angular sample `server.ts`](https://github.com/a2ui-project/a2ui/blob/main/samples/client/angular/projects/restaurant/src/server.ts) ·
   [A2UI — Catalogs: Catalog Negotiation, Step 2](https://a2ui.org/concepts/catalogs/#step-2-client-advertises-its-support-catalogs-required)
5. **Bridge the stream into `@a2ui/angular`'s renderer — adapt, don't port
   (revised 2026-10-21).** An official Angular bridge now exists:
   `src/app/client.ts` in the same sample, an `@Injectable` `Client` that
   POSTs to `/a2a`, parses the SSE `data:` lines, unwraps each part's `data`
   (array or single object, so it covers both the A2A v1.0 and v0.3
   `DataPart` shapes) and calls `A2uiRendererService.processMessages(...)`
   from `@a2ui/angular/v0_9`. `app.ts` renders with `SurfaceComponent`.
   Adapt this; the Lit `shell/client.ts` is no longer the only reference.
   *Done when:* a message streamed from the real agent (step 8 of the agent
   list) renders in the browser.
   **Links:** [Angular sample `client.ts`](https://github.com/a2ui-project/a2ui/blob/main/samples/client/angular/projects/restaurant/src/app/client.ts) ·
   [Angular sample `app.ts`](https://github.com/a2ui-project/a2ui/blob/main/samples/client/angular/projects/restaurant/src/app/app.ts) ·
   [A2UI — Transports: A2A Protocol](https://a2ui.org/concepts/transports/#a2a-protocol)
6. **Wire the `actionHandler`.** Configure `A2UI_RENDERER_CONFIG`'s
   `actionHandler` to take dispatched `action`/`event` payloads and send them
   back to the agent via the step 4 client. (2026-10-21: the Angular sample
   does this as `Client.handleAction(userAction)` → `POST /a2a` with
   `{event}` → `processMessages` on the reply. Per the Actions docs, input
   changes stay in the local data model; "the data model is only sent to the
   agent when an event occurs", and `functionCall` actions never reach the
   agent.)
   *Done when:* clicking a scripted test button in a hardcoded payload
   produces a logged action on the agent side.
   **Links:** [A2UI — Actions: User Interaction Flow](https://a2ui.org/concepts/actions/#user-interaction-flow) ·
   [A2UI — Actions: Agent Processing](https://a2ui.org/concepts/actions/#agent-processing)
7. **Zoneless + OnPush.** Bootstrap the app — check whether this needs any
   explicit config at all first (see correction below), then confirm catalog
   components are `OnPush` (or rely on the v21 default).
   **Correction (2026-07-24, session 5):** `provideZonelessChangeDetection()`
   is **stable** as of Angular v20.2 (no longer "experimental" — the deck's
   section 5c speaker notes say "experimental as of Angular 19/20," which is
   now out of date) and is the **default** for new apps as of **v21** — the
   exact version `@a2ui/angular` requires. A fresh `ng new` scaffold on v21
   is zoneless out of the box; you likely don't need to call anything
   explicitly. Flag this for the deck reconciliation list.
   **Links:** [Angular — Zoneless guide](https://angular.dev/guide/zoneless) ·
   [`provideZonelessChangeDetection` API reference](https://angular.dev/api/core/provideZonelessChangeDetection) ·
   [Angular DevTools (for the profiler demo beat)](https://angular.dev/tools/devtools)
8. **`VALIDATION_FAILED` reporting — confirm the automatic-vs-manual
   question.** Unclear from docs read so far whether `@a2ui/web_core`
   automatically emits the client-to-server `error` message over the wired
   transport on a schema validation failure, or whether app code must catch a
   validation event and send it manually. Resolve this empirically alongside
   step 5's bridging work.
   *Done when:* deliberately feeding the renderer an invalid payload (from
   the agent's scripted step 9) results in a `VALIDATION_FAILED` message
   actually reaching the agent, one way or another.
   **Links:** [A2UI — Actions: Renderer-to-Agent Error Reporting](https://a2ui.org/concepts/actions/#renderer-to-agent-error-reporting) ·
   [A2UI — Catalogs: Client-to-Server Error Reporting](https://a2ui.org/concepts/catalogs/#client-to-server-error-reporting)
9. **Full local dry run against the standalone agent.** Point the client at
   the agent's local URL, drive the exact demo prompt in a real browser,
   confirm the walking skeleton renders, then progressively exercise the
   real catalog, actions, and the two scripted beats (broken node, data
   push) end to end.
   **Links:** none needed — integration testing against what's already built.

---

**Explicitly out of scope — Q&A talking points, not build items:**
multi-agent orchestration and the `A2uiSubagentMap` surface-ownership routing
(orchestrator-only concern, relevant to the Future section as a mention, not
this single-agent demo); Data Model Sync / verbal submission
(`sendDataModel: true` — nice stretch goal, not required for a scripted
button-click demo); catalog versioning/migration/graceful-degradation across
catalog versions (one fixed catalog, no migration story needed); and
everything already covered under `QA.md`'s "Why Cloud Run in production"
(Vertex AI IAM, Firestore sessions, Cloud Run deployment, Genkit Monitoring)
— those answer what production looks like, not what the demo needs. Running
locally during the talk is enough unless reliability concerns argue for
deploying it — that's a logistics call, to be made separately, not an
architecture one.

---

## Open / to revisit as the demo project gets built

- [ ] Reconcile `slides.md` sections 4–5 code samples against the real
      `@a2ui/angular` public API (`A2uiRendererService` / `A2UI_RENDERER_CONFIG`
      / `BasicCatalog`), which differs from the internal-path names currently
      cited (`SurfaceComponent`, `MessageProcessor`, `ComponentHostComponent`,
      `BasicCatalogComponent<T>`). Separate task from this doc, but blocks
      calling the deck's code slides "verified."
- [ ] Update the deck's message examples for v0.9 → v0.9.1 deltas
      (`createSurface` replacing `beginRendering`, flatter component format,
      plain JSON data values instead of typed adjacency lists) once the
      agent/client scaffolding actually exists and those deltas are confirmed
      against real payloads.
- [ ] Confirm whether `@a2ui/angular`'s "Defining Your Own Catalog" story for
      Angular specifically is still "coming soon" in the docs, or has landed,
      before designing the custom catalog (TicketList, PriorityBadge,
      AssigneeChip) for real.
- [ ] Location within the monorepo is decided (see "Project structure" above);
      the exact repo root path in the workspace is still open as of
      2026-07-24 ("second brain" / merge-everything consideration).
- [ ] **Do the empirical A2A version spike**: stand up a minimal
      `AgentExecutor` + `AgentCard` with `@a2a-js/sdk@next` (the v1.0 **alpha**,
      not beta — see correction above), send one message, confirm
      `DataPart.data` is actually list-shaped in practice (not just in docs),
      and sanity-check the alpha is stable enough to build on given issue
      #452 is still open. Still the single highest-priority open item.
- [x] ~~Once the agent is scaffolded, re-verify the A2A ↔ A2UI bridging code
      against whatever the Angular sample (or the ported Lit bridge) actually
      requires.~~ **2026-10-21:** an official Angular bridge exists (client
      build order steps 4–5). Remaining check: it targets the v0.9 extension
      URI and `@a2ui/angular/v0_9`; confirm it works unchanged against a
      v0.9.1 agent.
- [x] **Decide where the A2A client lives.** **Decided 2026-10-22 (Giorgio):
      server side**, as in the official sample. The browser talks only to the
      app's own `POST /a2a` + SSE; the SSR server is the A2A client.
- [ ] **Update the deck's pipeline diagram (section 4)** for the server-side
      A2A client: browser → own API → server (A2A client) → agent.
- [ ] **Update the deck's section 5c speaker notes** (2026-07-24, session 5):
      currently says `provideExperimentalZonelessChangeDetection` "is still
      experimental as of Angular 19/20." Confirmed out of date — the API is
      stable since v20.2 and is the *default* for new apps as of v21, the
      exact version `@a2ui/angular` requires. Fold into the existing deck
      reconciliation item above rather than treating separately.
- [ ] **Resolve the Angular catalog API ambiguity** — partly answered
      2026-10-21: the official Angular sample imports `A2uiRendererService`
      and `SurfaceComponent` from `@a2ui/angular/v0_9` and types from
      `@a2ui/web_core/v0_9`. That's the surface the deck's code slides should
      cite. Still open (client build order step 2): does `Catalog`/`DynamicComponent`/`inputBinding` sit underneath
      `A2UI_RENDERER_CONFIG`/`BasicCatalog`, or are these describing different
      package versions? Needs the empirical check before designing the real
      custom catalog components.
- [ ] **Resolve whether `@a2ui/web_core` auto-reports `VALIDATION_FAILED`**
      or whether app code must catch and send it manually (client build order
      step 8).

**Resolved this session (2026-07-24):** capability negotiation mechanism
(`a2uiClientCapabilities.supportedCatalogIds`) and the `VALIDATION_FAILED`
error message are both confirmed real and precisely specified in the current
docs — not something to invent. The catalog's wire artifact is plain JSON
Schema (known at build/deploy time, not fetched at runtime) but our source of
truth is Zod, generated to JSON Schema via Zod v4's native `z.toJSONSchema()`
(not the external, Zod-v4-incompatible `zod-to-json-schema` package). Project
structure is a monorepo (npm/pnpm workspaces) for both demo and production.
The A2A version risk is resolved into a recommendation (target v1.0
explicitly via the `@next` alpha tag, pending the empirical spike above, with
issue #452 as a known unresolved gap). Both the pre-send-validation retry and
the `VALIDATION_FAILED` response now build a minimal, real self-correction
loop rather than being talking points only. Full practical build orders,
linked to primary sources at every step, now exist for both the agent and
the Angular client.

---

## Changelog

- **2026-07-24** — Initial version. Captures the transport (A2A), protocol
  version (v0.9.1), and production hosting (Cloud Run, not Agent Runtime)
  decisions from the project-planning conversation, plus the four Q&A bullets
  already living in `slides.md`'s closing speaker notes.
- **2026-07-24 (session 2)** — Verified message reference, catalogs, and
  actions docs directly against a2ui.org. Corrected the catalog framing (plain
  JSON Schema, known at build time, not a Zod-derived runtime negotiation).
  Confirmed `a2uiClientCapabilities`/`supportedCatalogIds` and
  `VALIDATION_FAILED` are both real, precisely specified mechanisms. Flagged
  the A2A v0.3-vs-v1.0 `DataPart` shape risk as the top open item. Added the
  full scoped server-agent build checklist (in-scope vs explicitly
  out-of-scope), mapped to the demo's 7 stages in `slides.md`.
- **2026-07-24 (session 3)** — Decided monorepo structure (npm/pnpm
  workspaces) for both demo and production, with the fork point being
  organizational (separate teams) not technical. Decided Zod as catalog
  source-of-truth, generated to JSON Schema via `zod-to-json-schema` —
  reconciles the "plain JSON Schema" correction from session 2 with keeping
  Zod in the actual workflow, backed by CopilotKit's `@copilotkit/a2ui-renderer`
  as ecosystem precedent (different transport, same pattern). Re-confirmed no
  TypeScript equivalent of `A2uiSchemaManager` exists. Resolved the A2A
  version risk into a recommendation: target v1.0 explicitly, pending an
  empirical spike. Upgraded the self-correction loop (items 5 and 9) from
  "stretch goal, mention only" to "build a minimal real version." Expanded
  policy enforcement (item 6) into concrete function shape. Explained
  `.well-known/agent-card.json` (item 7). Documented the three-part reasoning
  for scripting the data-model push instead of relying on the model (item 10).
- **2026-07-24 (session 4)** — Corrected the catalog conversion mechanism:
  Zod v4's native `z.toJSONSchema()`, not the external `zod-to-json-schema`
  package, which is confirmed broken against Zod v4 (silently returns an
  incomplete schema, causing Gemini to ignore structured-output constraints).
  Added the Gemini config detail (`responseJsonSchema` + `responseMimeType`).
  Added the full practical, risk-ordered build sequence with a test
  checkpoint per step, front-loading the A2A empirical spike as step 2.
- **2026-07-24 (session 5)** — Added a primary-source link to every step of
  the agent build order. Corrected `@a2a-js/sdk` terminology against its
  actual README: stable release targets A2A v0.3, the v1.0-targeting release
  is an **alpha** (`@next` tag, not "beta"), and v0.3 back-compat is tracked
  as unresolved in issue #452 — raises the stakes on the build order's step 2
  spike. Corrected client-side naming from `A2AClient` to `ClientFactory`.
  Noted the Express integration serves `.well-known/agent-card.json`
  automatically (`agentCardHandler`) — not something to hand-write. Added a
  Gemini constrained-decoding gotcha (unions, `pattern`/`min`/`maxLength` not
  supported) relevant to catalog schema design. Added the full Angular client
  practical build order (9 steps, linked), including a dedicated empirical
  check for two seemingly-conflicting `@a2ui/angular` API shapes seen across
  different current docs pages, and a correction that Angular's zoneless API
  is stable since v20.2 and default in v21 (contradicts the deck's "still
  experimental" speaker note — flagged for the existing deck reconciliation
  item, not treated separately).
- **2026-07-24 (session 5, later)** — Split the combined `QA.md` into this
  file (`IMPLEMENTATION-PLAN.md`, build scope/order/risk/changelog) and a
  trimmed `QA.md` (audience-facing Q&A and high-level architecture rationale
  only), so talk-prep and build-tracking don't compete for space in one
  document. No content was dropped — the version-risk mechanics, catalog
  mechanism detail, and Gemini constrained-decoding gotcha moved here from
  `QA.md`'s Q&A sections since they're build detail, not stage-ready answers.
- **2026-10-21** — Found the official Angular sample
  (`samples/client/angular/projects/restaurant`) that the July sessions
  didn't have. Client build order steps 4–5 rewritten: the A2A client
  moves to the SSR server (`server.ts`, `POST /a2a` + SSE to the browser),
  and the bridge is adapted from the sample's `client.ts` instead of ported
  from Lit. Step 6 annotated with the sample's `handleAction` and the
  Actions docs' local-data-model rule. New open item: decide where the A2A
  client lives. Catalog API ambiguity partly resolved (`@a2ui/angular/v0_9`
  exports used by the sample).
- **2026-10-22** — Decided: the A2A client lives server side (SSR server
  proxy, as in the official Angular sample). Deck section 4 diagram update
  added as an open item.
