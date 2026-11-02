# Q&A Prep — Your AI Should Not Generate HTML (AngularDay 2026)

**This is the living Q&A / talk-prep doc.** It holds anticipated audience
questions and the high-level "why" behind each architecture decision — the
stage-ready answers, not the build mechanics. For scope, practical build
order (agent + client), known technical risks, and the decisions changelog,
see **`IMPLEMENTATION-PLAN.md`** in this same folder. The two docs
cross-reference rather than duplicate; if a decision changes, check whether
`slides.md` still says the same thing too.

Last updated: 2026-07-24 (session 5 — split out of the combined doc into
this Q&A-only file plus `IMPLEMENTATION-PLAN.md`).

---

## Architecture decisions — the "why," for stage-ready answers

### Why A2A protocol as transport, and not a hand-rolled SSE/WebSocket stream?

A2UI's own transport table lists only two options as "✅ Stable": the A2A
protocol and AG-UI (CopilotKit's protocol — not our stack). Plain SSE/WebSocket
is listed as "💡 Proposed," not stable. A2UI is transport-agnostic by design,
so a custom stream would have worked, but A2A gives us three things for less
code than reinventing them:

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
On the client side, the only reference bridge from an A2A stream into an A2UI
renderer lives in the **Lit** sample (`samples/client/lit/shell/client.ts`),
not Angular — we'll be porting that bridging logic, not copying it.
Community references exist for Genkit + `@a2a-js/sdk` together (`a2a-agentkit`,
`Genkit-UI` on GitHub) but they're third-party, not official Google samples —
useful as a pattern, not a dependency.

**If asked how solid the A2A protocol-version choice itself is:** short
answer, "targeting v1.0, confirmed against current docs, with a fallback
plan if the tooling isn't there yet." The full technical risk (SDK alpha
status, an open backward-compat issue, the empirical spike that resolves it)
is tracked in `IMPLEMENTATION-PLAN.md`'s "Known technical risk: A2A protocol
version" section — that's build-risk detail, not something an audience
member would ask for in this depth.

### Why target v0.9.1, not v0.9 or v1.0?

Decision: track the current stable spec (v0.9.1) rather than freeze on what
the deck currently cites (v0.9) or jump early to the release candidate (v1.0).
Giorgio's call: "as latest as possible... we will periodically do version
checks and updates." (The resulting deck-reconciliation work this implies —
some of section 4/5's code slides being one version behind — is tracked as a
build task in `IMPLEMENTATION-PLAN.md`'s open items, not repeated here.)

### Why Cloud Run in production, and not a managed "agent platform"?

Google does have a managed hosting product for agents — **Agent Runtime**,
part of the Gemini Enterprise Agent Platform — but it's explicitly scoped to
**ADK**, not Genkit. Google's own docs are direct: "you must host and
maintain your ADK agents on Agent Runtime for them to function within
Gemini Enterprise." Genkit's own blog post announcing its Agents API draws
the same line from the other side: reach for ADK instead when you want a
managed runtime, not just a library — Genkit's documented deploy targets are
Cloud Run or Firebase Functions, the same as any other TypeScript backend.

**Soundbite if asked directly:** *if you build this with Genkit, it's a Cloud
Run service; if you build it with ADK, Google has a managed runtime for that —
different tools, different production stories, know which one you picked.*

Why Cloud Run fits well, specifically:

- A2A's streaming call (`sendMessageStream`) is SSE-shaped. Cloud Run's SSE
  support is GA and needs no session affinity or special load-balancer config.
  WebSockets, by contrast, are long-running requests on Cloud Run subject to a
  timeout (up to 60 min, defaults to 5), pushing reconnect logic onto the
  client — staying on A2A's HTTP+SSE binding sidesteps that entirely.
- Concurrency: Cloud Run instances now handle up to 1,000 concurrent requests
  (default 80, tunable) — relevant because every open SSE stream holds a
  request open for the life of a UI-composing turn, so this is a dial you'd
  actually tune, not leave on default.
- Scale-to-zero, pay-per-use fits a bursty "agent composes a dashboard on
  demand" workload rather than a constantly-hot service.
- Horizontal scaling only works if session state is externalized — Genkit's
  Firestore-backed session store is exactly that: any instance can pick up any
  request because conversation history isn't pinned to the process that
  generated it.

**What's actually running inside the container**, for a precise spoken answer:
an Express app exposing the A2A endpoints (`@a2a-js/sdk`'s `AgentExecutor`,
plus a `.well-known/agent-card.json` for discovery); a Genkit flow calling
Gemini through **Vertex AI** (not a bare AI Studio key — IAM, VPC-SC, data
residency, quota, the things you'd never ship the demo's setup as-is for);
the Firestore session store; tool calls out to whatever internal system
supplies real data (the ticket queue), authenticated with their own
service-account credentials, separate from the end user's; and — the piece
that matters most for this talk's argument — the policy-enforcement and
schema-validation step sitting between "Gemini responded" and "message goes
out over A2A." That step is application code, not infrastructure, but it's
the one that turns a demo into something you'd let a customer touch. Genkit
Monitoring (or Cloud Trace/Logging) on top gives the audit trail the talk's
Observability slide already promises.

---

## Likely audience questions (from the deck's own speaker notes)

### "Is A2UI production-ready?"
No — currently v0.9.1, still moving toward v1.0 (release candidate exists).
The pattern (catalog, capability negotiation, validation at the boundary) is
what to adopt now; the specific library surface will keep shifting. See the
deck's section 2 maturity slide.

### "What about React/Vue teams?"
A2UI is framework-agnostic — official renderers exist for React, Lit, and
Angular, all built on the shared `@a2ui/web_core` library, plus Flutter's
GenUI SDK. The Angular-specific argument in section 5 is about fit, not
exclusivity.

### "Doesn't the agent still need to know the catalog?"
Yes — that's the point. Capability negotiation sends the catalog to the agent
before generation (section 4). It's a closed, known vocabulary the agent picks
from, not an open one it invents into.

Short mechanism, if pressed for detail: the catalog's wire artifact is a
plain JSON Schema file, generated from a Zod source of truth, known to both
sides at build/deploy time (not fetched at runtime). The client advertises
which catalog(s) it supports in message metadata; the agent picks one it
recognizes. The full mechanism — including the Zod-to-JSON-Schema conversion
gotchas that actually matter for getting Gemini to respect the schema — is
implementation detail tracked in `IMPLEMENTATION-PLAN.md`'s server agent
build scope (item 1), not audience-facing material.

### "What stops a compromised agent from requesting a valid-looking but malicious combination of valid components?"
Server-side policy enforcement (section 4's validation-ownership slide) is the
layer for this — catalog/schema validation checks shape and type; it has no
opinion on your business rules. Forbidden fields, disabled actions, and role
restrictions are your application code, enforced before the payload ever
reaches the client.

### "What would you actually run this on in production?" *(new — from this planning conversation)*
See "Why Cloud Run in production" above. Short form: Cloud Run running Genkit
and the A2A SDK, Vertex AI for the model, Firestore for session state — the
same shape as any other production TypeScript backend, which is sort of the
point of the whole talk.


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
