# Q&A Prep — Your AI Should Not Generate HTML (AngularDay 2026)

**This is the living Q&A / talk-prep doc.** It holds anticipated audience
questions and the high-level "why" behind each architecture decision — the
stage-ready answers, not the build mechanics. For scope, practical build
order (agent + client), known technical risks, and the decisions changelog,
see **`IMPLEMENTATION-PLAN.md`** in this same folder. The two docs
cross-reference rather than duplicate; if a decision changes, check whether
`slides.md` still says the same thing too.

Last updated: 2026-11-13 (answers that still described the July plan,
Genkit + Firestore, rewritten for the stack the demo actually runs; facts
from `demo/README.md`, `IMPLEMENTATION-PLAN.md` and the code under `demo/`).
First split out of the combined doc on 2026-07-24 (session 5).

---

## Architecture decisions — the "why," for stage-ready answers

### Why A2A protocol as transport, and not a hand-rolled SSE/WebSocket stream?

A2UI is transport-agnostic by design: its roadmap (checked 2026-11-12) now
lists A2A, AG-UI, REST, WebSockets and MCP transports as complete, so a custom
stream would have worked. A2A is the transport the official samples use, and it
gives us three things for less code than reinventing them:

- The embedding mechanism is precisely specified, not vague: A2UI messages are
  encoded as an A2A `DataPart`, whose `data` field is an array of A2UI JSON
  messages (`createSurface`, `updateComponents`, `action`, etc.), processed
  sequentially, under a versioned extension URI
  (`https://a2ui.org/a2a-extension/a2ui/v0.9`, with a v0.9.1 equivalent).
- `@a2a-js/sdk` is a real, official TypeScript SDK — streaming, SSE, Express
  integration, `AgentExecutor` server pattern, `ClientFactory` for consumption
  (`factory.createFromUrl(baseUrl)`, corrected 2026-07-24 session 5 — earlier
  notes here said `A2AClient`; the current README's actual API is
  `ClientFactory`). Nothing to hand-roll for framing, reconnection, or task
  lifecycle — see [the official README](https://github.com/a2aproject/a2a-js)
  for full runnable server + client examples.
- It ties directly to the talk's section 8 future-vision (sub-agents,
  orchestration) — using A2A now means the demo's transport choice and the
  talk's closing argument are the same architecture, not two different stories.

**The honest caveat, worth remembering if asked how confident this is:** the
*prose* walkthrough for wiring A2A on the agent side is incomplete on the
official docs — the Agent Development guide literally ends with "TODO:
Continue this guide... without the A2A extension." The extension spec itself
(the DataPart embedding) is precise; the tutorial for it isn't written yet.
The demo sidesteps the missing guide: the agent follows the official A2UI Node
sample (restaurant finder, Apache-2.0), which already wires `@a2a-js/sdk`'s
`AgentExecutor`, the agent card and the A2UI `DataPart`s (`apps/agent/src/a2a.ts`).
On the client side the bridge follows the official **Angular** sample: the
Angular SSR server (`apps/client/src/server.ts`) is the A2A client, and it is the
only file in the demo that knows A2A. It unwraps the A2UI messages from the A2A
parts and streams them to the browser as plain SSE events,
`{ messages, sessionId }`. The browser never speaks A2A, so swapping the
transport means rewriting that one file, not the renderer or the catalog.

**If asked how solid the A2A protocol-version choice itself is** (this is
A2A's version, not A2UI's: say "A2A" out loud, since A2UI is also at v1.0 now):
short answer, "the demo runs A2A v0.3 through `@a2a-js/sdk` 0.3.x, like the
official samples; A2A v1.0 is the next step once the tooling is there." The full technical risk (SDK alpha
status, an open backward-compat issue, the empirical spike that resolves it)
is tracked in `IMPLEMENTATION-PLAN.md`'s "Known technical risk: A2A protocol
version" section — that's build-risk detail, not something an audience
member would ask for in this depth.

### Why does the demo run A2UI v0.9 when the spec is v1.0?

A2UI v1.0 became the current spec version on 6 Nov 2026 (PR #3999 on
a2ui-project/a2ui) and is declared stable. The demo stays on **v0.9**
(`@a2ui/angular` 0.13.0, `@a2ui/web_core` 0.14.0), on purpose:

- No v1.0.0 package exists. The published SDKs (`@a2ui/angular` 0.14.0,
  `web_core` 0.15.0) follow an earlier v1.0 draft: the `@`-prefixed component
  keys landed on main on 11 Nov and aren't released yet. Migrating now would
  still not match the final spec.
- The upgrade is all-or-nothing (angular, web_core and agent move together, with
  breaking API changes), too much risk a week before the talk.
- What changes on the wire is mechanical: `"version": "1.0"`, `@path` / `@call`
  for bindings and calls, `@checks` on components, client/server renamed
  renderer/agent. Catalog, negotiation and validation at the boundary stay.

Earlier plan, superseded: track v0.9.1 as "current stable" ("as latest as
possible... we will periodically do version checks and updates", Giorgio).
That check is exactly what moved the answer.

### Why Cloud Run in production, and not a managed "agent platform"?

Google does have a managed hosting product for agents — **Agent Runtime**,
part of the Gemini Enterprise Agent Platform — but it's explicitly scoped to
**ADK**. Google's own docs are direct: "you must host and maintain your ADK
agents on Agent Runtime for them to function within Gemini Enterprise." The
demo agent isn't ADK (and not Genkit either, the July plan): it follows the
official A2UI Node sample, plain `@google/genai` + `@a2ui/agent` 0.0.2 behind
an Express server. That is an ordinary Node service, so the production story
is the same as any other TypeScript backend: a container on Cloud Run. Not
deployed: the demo runs locally for the talk.

**Soundbite if asked directly:** *this agent is a plain Node service, so it's a
Cloud Run service; if you build it with ADK, Google has a managed runtime for
that — different tools, different production stories, know which one you
picked.*

Why Cloud Run fits well, specifically:

- A2A's streaming call (`sendMessageStream`) is SSE-shaped. Cloud Run's SSE
  support is GA and needs no session affinity or special load-balancer config.
  WebSockets, by contrast, are long-running requests on Cloud Run subject to a
  timeout (up to 60 min, defaults to 5), pushing reconnect logic onto the
  client — staying on A2A's HTTP+SSE binding sidesteps that entirely.
- Concurrency: Cloud Run instances now handle up to 1,000 concurrent requests
  (default 80, tunable) — relevant because every open SSE stream holds a
  request open for the life of a UI-composing turn, so this is a dial you'd
  actually tune, not leave on default. For scale: the demo's first UI arrives
  in 4–7 s on the talk prompt (3 live runs, 12 Nov), and the stream stays open
  until the turn's last message.
- Scale-to-zero, pay-per-use fits a bursty "agent composes a dashboard on
  demand" workload rather than a constantly-hot service.
- Horizontal scaling only works if session state is externalized, and the
  demo's isn't: conversation history lives in process memory (an `LruCache`
  of `@google/genai` chats, 1,000 conversations, `apps/agent/src/model.ts`)
  and A2A tasks in the SDK's `InMemoryTaskStore`. Fine for one instance on a
  laptop; on Cloud Run you'd pin to one instance, add session affinity, or move
  that state to an external store. The demo hasn't picked one, so say that
  rather than name a product.

**What actually runs**, for a precise spoken answer — two Node processes:

- **The agent** (`apps/agent`, port 10002): an Express app exposing A2A v0.3
  through `@a2a-js/sdk` 0.3.13 (JSON-RPC at `/a2a/json-rpc`, the agent card at
  `/.well-known/agent-card.json`). Each turn calls Gemini (`gemini-3.6-flash`,
  thinking `MINIMAL` by default, `GEMINI_THINKING_LEVEL` overrides it) through
  `@google/genai` with an API key from `apps/agent/.env`. `STUB_LLM=true`
  serves canned replies with no model and no key, the stage fallback. Ticket
  data comes from a local JSON file (`assets/tickets.json`, 8 tickets) through
  a `get_tickets` tool; there is no database. `@a2ui/agent` validates every
  reply against the Zod ticket catalog and retries once with the validation
  error, then falls back to a text apology. Then — the piece that matters
  most for this talk's argument — `policy.ts` strips forbidden data paths and
  disabled actions on both the streamed and the final path, before anything
  goes out over A2A.
- **The Angular SSR server** (`apps/client/src/server.ts`): serves the app and
  `POST /a2a`, is the A2A client, and re-streams the A2UI messages to the
  browser as plain SSE. The browser's renderer checks every message again
  against the same Zod catalog on arrival. Sending a renderer-side failure
  back to the agent as `VALIDATION_FAILED` is phase 6 (PR #8), not on main yet.

What a production version would add, and the demo honestly lacks: no auth
(the agent runs with `UserBuilder.noAuthentication`), no per-user or per-role
policy (one fixed `DEMO_POLICY` for everyone), no rate limit, an AI Studio
API key instead of Vertex AI (IAM, VPC-SC, data residency, quota), in-memory
session state, and console log lines (`--- policy: stripped … ---`) rather than
tracing. The policy and validation step is application code, not
infrastructure, and it's the one that turns a demo into something you'd let a
customer touch; the rest is ordinary backend work.

---

## Likely audience questions (from the deck's own speaker notes)

### "Is A2UI production-ready?"
The spec is: v1.0, declared stable since 6 Nov 2026. The libraries aren't yet:
the SDKs are 0.x, and the demo pins v0.9. The pattern (catalog, capability negotiation, validation at the boundary) is
what to adopt now; the specific library surface will keep shifting. See the
deck's section 2 maturity slide.

### "What about React/Vue teams?"
A2UI is framework-agnostic — official renderers exist for React, Lit, and
Angular, all built on the shared `@a2ui/web_core` library, plus Flutter's
GenUI SDK. The Angular-specific argument in section 5 is about fit, not
exclusivity.

### "Doesn't the agent still need to know the catalog?"
Yes — that's the point. The agent already holds the catalog; capability
negotiation tells it which one this client renders (section 4). It's a
closed, known vocabulary the agent picks from, not an open one it invents into.

Short mechanism, if pressed for detail: the catalog is Zod 3 `ComponentApi`
objects in `packages/catalog`, imported by both the agent and the Angular app.
On the wire only the id travels: `server.ts` sends
`supportedCatalogIds: [TICKET_CATALOG_ID]` in the message metadata, and the
agent (`pick-a2ui.ts`) builds its prompt and its validation from that catalog
only. The model reads the catalog as JSON Schema, which `@a2ui/agent`'s prompt
generator writes with `catalog.toJson()`; validation runs on the Zod objects
themselves. There's no `responseJsonSchema` on the Gemini call: the sample
prompts with the catalog and validates afterwards. Why not reload the JSON
document instead: it loosens the schema (incident 3 in `demo/README.md`).
Details in `IMPLEMENTATION-PLAN.md` → "Zod catalog and policy on top of
`@a2ui/agent`", not audience-facing material.

### "What stops a compromised agent from requesting a valid-looking but malicious combination of valid components?"
Server-side policy enforcement (section 4's validation-ownership slide) is the
layer for this — catalog/schema validation checks shape and type; it has no
opinion on your business rules. Forbidden fields, disabled actions, and role
restrictions are your application code, enforced before the payload ever
reaches the client.

In the demo that's `apps/agent/src/policy.ts`: it strips `internal_notes`
from the data model and removes any component bound to it or carrying the
`delete_ticket` action, then mends the tree so the surface still validates.
`STUB_LEAKY=true` shows it working: the SSE reaching the browser holds zero
`internal_notes`. Be honest about the limits: it's one fixed policy, not per
user or role (the demo has no auth); a path denylist only covers the shapes
you thought of (incident 5 in `demo/README.md`); and it has been checked in
stub mode, not yet against the live model. The sturdier fix is upstream: don't
hand the model fields the user may not see.

### "What would you actually run this on in production?" *(new — from this planning conversation)*
See "Why Cloud Run in production" above. Short form: the agent (`@google/genai`
+ `@a2ui/agent` + `@a2a-js/sdk`) and the Angular SSR server are two ordinary
Node services, so Cloud Run for both, Vertex AI instead of the demo's API key,
and an external session store instead of the demo's in-memory one — the same
shape as any other production TypeScript backend, which is sort of the point
of the whole talk. What the demo doesn't have yet: auth, per-user policy, rate
limiting.


### "Your server uses `A2AClient`, isn't that deprecated?"
Yes. In `@a2a-js/sdk` 0.3.x, `A2AClient` is marked `@deprecated Use ClientFactory`
(it only speaks JSON-RPC; `ClientFactory` picks the transport from the agent card).
The demo keeps it on purpose: the bridge in `demo/apps/client/src/server.ts` has
the same shape as the official A2UI Angular sample
(`samples/client/angular/projects/restaurant/src/server.ts`), which also calls
`A2AClient.fromCardUrl` on `@a2a-js/sdk ^0.3.13` (checked 2026-10-22). Staying
identical to the reference keeps the demo easy to compare against it. The switch
to `ClientFactory` is planned for the move to A2A v1.0, or sooner if the sample
moves first. Nothing about A2UI changes either way: the client only carries the
messages.

---

## See also

`IMPLEMENTATION-PLAN.md` (same folder) — project structure, server agent
build scope, practical build order for both agent and client, explicitly
out-of-scope items, known technical risks, open items, and the full
decisions changelog.
