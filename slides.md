---
theme: default
title: "Your AI Should Not Generate HTML"
author: Giorgio Galassi
highlighter: shiki
lineNumbers: false
drawings:
  persist: false
transition: slide-left
mdc: true
fonts:
  sans: Roboto
  mono: Roboto Mono
defaults:
  layout: ruled
rule: ['A2UI · AngularDay 2026', 'Structured generative UI']
---

<div class="ta">
  <div class="ta-hero">
    <FitText>Your AI should not</FitText>
    <FitText serif>generate HTML.</FitText>
  </div>
  <div class="ta-foot" style="grid-template-columns:repeat(3,minmax(0,1fr)) auto;align-items:center">
    <div><b>Angular + A2UI</b><span>structured generative UI</span></div>
    <div><b>AngularDay 2026</b><span>Verona · 20 November</span></div>
    <div><b>Giorgio Galassi</b><span>ggalassi.dev</span></div>
    <div class="ta-qrs"><div class="qr-row">
      <img src="/src/qr-angularday-agenda.png" alt="QR code to the AngularDay agenda" class="qr-code" />
      <span><b>Questions? Ratings?</b>use the AngularDay app</span>
    </div></div>
  </div>
</div>

<!--
Speaker notes:
Welcome the room. No preamble needed.
Point at the QR once: questions can go in the AngularDay app during the talk,
and the same app is where they rate it. Q&A is at the end.
Let the title sit for a second before moving on.
This is an Advanced-level talk, 40 minutes with a live demo: a live agent drives the dashboard
(stub agent and recording ready as fallbacks).
Do not open with a broken React component or a horror-story HTML injection screenshot.
That framing is wrong and the audience will know it immediately — no serious team ships
raw LLM-generated HTML to production. Starting there feels like finding a problem for
a solution. Go straight into the real problem instead.
-->

---
rule: ['Part 1', 'The Problem']
---

<div class="ta">
  <div class="ta-hero">
    <FitText>The Problem.</FitText>
  </div>
</div>

<!--
~5 minutes.
-->

---
rule: ['The Problem', 'Part 1']
---

# Agents are already in production

They handle complex tasks. They call tools. They manage multi-step workflows.

And the moment they need to respond with something richer than text, they hit a wall.

<div v-click>

> "Generative AI excels at creating text and code, but agents can struggle to present
> rich, interactive interfaces to users, especially when those agents are remote or
> running across trust boundaries."

<div class="text-sm text-gray-400">

Source: [github.com/a2ui-project/a2ui — Summary](https://github.com/a2ui-project/a2ui#summary)

</div>

</div>

<!--
Speaker notes:

This is the actual opening line. Say it plainly, no dramatization.
The problem is not bad code quality. Not developer tooling.
It's agents that need to hand something visual and interactive back to a user,
in a system they do not fully control.
Pause after "they hit a wall" — let that land before moving to the quote.

[click: Google says it plainly]
Ground the problem in Google's own framing from the A2UI README before offering
your own take. This isn't me inventing a problem — Google's own team building this
standard describes it the same way.
Read the quote slowly. "Trust boundary" is the phrase to let land — that's the
crux of the whole talk. Not "agents write bad UI." Agents that are remote,
that you don't fully control, that need to hand back something interactive.
-->

---
rule: ['The Problem', 'Part 1']
---

# What the agent's options look like today

<div class="ta-cols c3">
<div v-click>

## Option 1 — Generate HTML or JSX and inject it

Unbounded output, no contract, no validation surface. By the time it renders,
it's too late to check. Across a trust boundary, you're executing arbitrary code
from a remote agent in your client application.

</div>
<div v-click>

## Option 2 — return data, let the frontend render it

Clean. Predictable. And now the agent has no voice in how its output is presented.

It cannot say "show this as an approval workflow."
It cannot say "this data needs a date picker."

The agent is reduced to a JSON API with no say in presentation.

</div>
<div v-click>

## Option 3 — nothing

The agent responds in plain text.

The interactive experience is lost entirely.

</div>
</div>

<!--
Speaker notes:

Walk through the three options one at a time, don't rush.
Option 1 is the one everyone's instinct jumps to because it's what a browser-based
coding agent already does locally, in a sandbox you control. The moment the agent
is remote — a different service, a different trust domain — this stops being safe.
There's no way to inspect what you're about to execute before you execute it.

[click: Option 2]
This is the safe-but-limited option. Most teams that get nervous about option 1
land here by default. It's not wrong, it's just incomplete — you've solved safety
by removing the agent's ability to express intent about presentation at all.
The dashboard demo later in the talk is specifically the case where this breaks:
the agent needs to choose the shape of the response, not just supply values.

[click: Option 3]
Quick beat, don't over-explain. This is the fallback most teams actually ship
when they hit the wall — chat-only, no rich UI at all, because option 1 is unsafe
and option 2 doesn't cover the intent the agent needs to express.
-->

---
rule: ['The Problem', 'Part 1']
---

# What if there was a fourth option?

What if the agent could describe *what* it wants to show, and the frontend could
decide *how* to show it — safely, within bounds it controls?

<div class="callout">

That question is what A2UI answers.

</div>

<!--
Speaker notes:
Deliver this as a genuine question, then pause before the callout line.
This is the hinge of the whole talk — everything after this slide is the answer.
-->

---
rule: ['Part 2', 'The Paradigm Shift']
---

<div class="ta">
  <div class="ta-hero">
    <FitText>The Paradigm Shift.</FitText>
  </div>
</div>

<!--
~5 minutes.
-->

---
rule: ['The Paradigm Shift', 'Part 2']
---

# The LLM becomes a planner and composer, not a code generator

<div v-click>

## This is not hypothetical

Google has published A2UI as an open-source standard — spec **v1.0** since
6 Nov 2026, **17k+ GitHub stars** — specifically designed to let agents "speak UI" through
a declarative JSON format rather than generating executable code.

</div>

<!--
Speaker notes:

State this clearly and let it sit as its own slide before backing it with evidence.
This single sentence is the reframe the rest of the talk builds on.

[click: This is not hypothetical]
Ground the shift immediately in reality, don't let it float as a concept.
This is a real, actively maintained standard with real adoption signal, not
a one-off research idea. That's worth saying explicitly for a room of engineers
who are going to ask "is this vaporware."
-->

---
rule: ['The Paradigm Shift', 'Part 2']
---

# The core diagram

```
User Intent → LLM → A2UI JSON → Renderer → Native UI
```

<div v-click class="ta-beat">"Why is AI-generated JSON safer than AI-generated HTML?"</div>

<div v-click>

## The real argument

A2UI is a **declarative data format**, not executable code.

The client maintains a catalog of trusted, pre-approved components.
The agent can only request components from that catalog.

<div class="callout">

HTML has infinite surface area. A2UI has an enumerable, allowlisted one.

</div>

</div>

<!--
Speaker notes:

Walk left to right slowly. User intent goes into the LLM. The LLM's only output
is A2UI JSON — never markup, never executable code. The renderer — the Angular
app — turns that JSON into native UI using components it already trusts.
Hold here, because the next slide is the objection this diagram immediately raises.

[click: the question]
Say this as the question the audience is already forming. Don't answer immediately —
let it hang for a beat, then move to the next slide for the actual answer.
This is the objection-handling moment of the talk. If you skip it, the room
mentally checks out for the rest of the technical sections.

[click: The real argument]
This is the answer, and it's the sentence to get exactly right: "HTML has infinite
surface area. A2UI has an enumerable, allowlisted one." Say it slowly.
JSON isn't safe because it's JSON — plenty of JSON-based attacks exist.
It's safe here specifically because the vocabulary the agent can use is closed
and known in advance. That's the actual mechanism, not a vibe about data vs. code.
-->

---
rule: ['The Paradigm Shift', 'Part 2']
---

# Acknowledge maturity, up front

The A2UI spec reached **v1.0** on 6 Nov, declared stable.
The SDKs are still **0.x** and lag behind it. This demo runs **v0.9**, on purpose.

What you're learning today is the pattern and the architecture —
not a production dependency.

<div class="text-sm text-gray-400">

The specific library will stabilize. The renderer contract pattern will not change.

</div>

<!--
Speaker notes:
Say this honestly and don't rush past it. An advanced audience will respect you
more for naming the maturity level than for overselling it.
The facts (checked 2026-11-12): v1.0 became the current spec version on 6 Nov
(a2ui-project/a2ui PR #3999); the spec says breaking changes now go into a future
major version. No v1.0.0 package exists: @a2ui/angular is 0.14.0 on npm and
follows an earlier v1.0 draft (the @-prefixed component keys landed on main on
11 Nov, unreleased). The demo pins @a2ui/angular 0.13.0 and speaks v0.9: a
deliberate pin a week before the talk, not an oversight. Moving it is a
version bump plus @path / @call in the payloads, the pattern doesn't move.
The point to land: even if the `@a2ui/*` packages look different in a year,
the shape of the problem — catalog, capability negotiation, validation at the
boundary — is stable regardless of which library implements it. That's what
they should walk away holding onto.
-->

---
rule: ['Part 3', 'Where This Actually Makes Sense']
---

<div class="ta">
  <div class="ta-hero">
    <FitText>Where This Actually</FitText>
    <FitText>Makes Sense.</FitText>
  </div>
</div>

<!--
~5 minutes. Needs a dedicated slide per use case, plus a "when NOT to use this"
closing slide — do not skip it. The audience will ask "when would I actually
build this?" before buying into the architecture in section 4 and 5.
-->

---
rule: ['Where This Actually Makes Sense', 'Part 3']
---

<div class="ta-cols">
<div>

## Enterprise internal tooling at scale

Platforms like Salesforce, ServiceNow, or SAP serve thousands of customers,
each with different data models, roles, and workflows.

Today: configuration systems — low-code UI builders made of JSON config,
feature flags, conditional rendering logic.

**A2UI replaces the configuration layer** with an agent that reads the
customer's data model and composes the appropriate surface on demand.

</div>
<div v-click>

## Financial services dashboards

Analysts ask highly specific questions:
*"show me exposure across these five positions with this risk metric,
broken down by region."*

The answer is always a different surface.

Today: either a huge library of pre-built views, or a custom dashboard per request.

</div>
</div>

<!--
Speaker notes:

[Enterprise internal tooling at scale]
The policy enforcement layer maps directly onto the per-customer access
restrictions these platforms already have to enforce today. You're not adding
a new security model — you're moving an existing one to sit in front of
generation instead of behind it.

[click: Financial services dashboards]
An agent composing from a validated catalog of financial components is strictly
safer than one generating arbitrary HTML, and it maps cleanly onto compliance
requirements around what data specific roles are allowed to see — the catalog
and the role-based policy layer are doing the same enforcement job.
-->

---
rule: ['Where This Actually Makes Sense', 'Part 3']
---

<div class="ta-cols">
<div>

## Healthcare and clinical decision support

A cardiologist's workflow looks nothing like an oncologist's — and both change
depending on the specific patient's data.

Dynamic composition from a **safe, auditable component catalog** fits the
regulatory requirement that every rendered element be traceable and controllable.

<div class="text-sm text-gray-400">

Arbitrary HTML generation would never pass a compliance review.

</div>

</div>
<div v-click>

## Remote sub-agents in an orchestrator

A parent agent delegates a task to a specialized sub-agent —
a booking agent, a reporting agent.

The sub-agent returns an A2UI payload.
The parent renders it inline **without knowing its structure in advance**.

<div class="callout">

The catalog defines the contract both agents work within.

</div>

</div>
</div>

<!--
Speaker notes:

[Healthcare and clinical decision support]
A2UI gives the flexibility of dynamic composition with the auditability
healthcare demands. The catalog is what makes a compliance review possible
at all — you can point to the exact enumerable set of things that could
ever have been rendered, for any payload, at any time.

[click: Remote sub-agents in an orchestrator]
This is the multi-agent case, and it's worth calling out separately because it's
the one that generalizes furthest. The parent doesn't need to know anything about
the sub-agent's internals — the shared catalog is the entire interface between them.
-->

---
rule: ['Where This Actually Makes Sense', 'Part 3']
---

# Why the standard approach breaks down

Hardcoded components with conditional rendering work well when the number of
possible UI states is enumerable and stable. They break down when:

- **The combinations explode** — 50 data dimensions × 10 roles is not 500 templates,
  it's a composition system you're building anyway
- **The interface responds to data you don't control** — enterprise customers bring
  their own schemas, clinical data varies per patient
- **Maintenance cost compounds** — every new template is a liability

<!--
Speaker notes:
Teams that build large configuration-driven UI systems eventually reinvent
something close to what A2UI formalizes — without the protocol, without the
validation layer, and without the capability negotiation. That's the honest
pitch: you're already halfway to building this. A2UI just names the pattern
and gives it a validation boundary.
-->

---
rule: ['Where This Actually Makes Sense', 'Part 3']
---

# When NOT to use this

For a product with a fixed, well-understood user journey — a checkout flow,
a settings page, a login screen — **this is unnecessary complexity**.

<div class="callout">

If you can enumerate the states, enumerate them.

</div>

The paradigm earns its overhead when the interface is a function of data and
context that varies at runtime in ways you can't fully anticipate at build time.

<!--
Speaker notes:
This slide is not optional — it's the credibility slide. An advanced audience
trusts a speaker more, not less, for drawing the boundary of where their own
architecture doesn't apply. Say it plainly and don't hedge it.
-->

---
rule: ['Part 4', 'Anatomy of an A2UI System']
---

<div class="ta">
  <div class="ta-hero">
    <FitText>Anatomy of an</FitText>
    <FitText>A2UI System.</FitText>
  </div>
</div>

<!--
~10 minutes. This is the technical core.
-->

---
rule: ['Anatomy of an A2UI System', 'Part 4']
---

# The full pipeline

<div class="dg">
<div class="dg-lane">
<div class="dg-label">// browser</div>

```mermaid {scale: 0.74}
%%{init: {"theme": "base", "themeVariables": {"fontFamily": "JetBrains Mono, monospace", "fontSize": "11px", "lineColor": "#9aa0a6", "edgeLabelBackground": "#262626"}, "flowchart": {"curve": "basis", "nodeSpacing": 24, "rankSpacing": 44, "padding": 10}}}%%
flowchart TB
  B1["A2UI messages"] --> B2["<b>web_core</b><br/>same Zod catalog"] --> B3["Angular<br/>components"]
  classDef file fill:#2a2a2a,stroke:#454545,stroke-width:1px,color:#9cdcfe
  classDef step fill:#333333,stroke:#569cd6,stroke-width:2px,color:#f0ebe4
  class B1 file
  class B2,B3 step
```

</div>
<div class="dg-wire">
  <div class="arrow">POST /api/agent</div>
  <div class="arrow left">SSE</div>
  <div class="arrow">VALIDATION_FAILED</div>
</div>
<div class="dg-lane">
<div class="dg-label">// ssr server</div>

```mermaid {scale: 0.74}
%%{init: {"theme": "base", "themeVariables": {"fontFamily": "JetBrains Mono, monospace", "fontSize": "11px", "lineColor": "#9aa0a6", "edgeLabelBackground": "#262626"}, "flowchart": {"curve": "basis", "nodeSpacing": 24, "rankSpacing": 44, "padding": 10}}}%%
flowchart TB
  S1["<b>A2A client</b><br/>(app-to-agent)<br/>server.ts"] --> S2["supportedCatalogIds"]
  classDef file fill:#2a2a2a,stroke:#454545,stroke-width:1px,color:#9cdcfe
  classDef step fill:#333333,stroke:#569cd6,stroke-width:2px,color:#f0ebe4
  class S1 step
  class S2 file
```

</div>
<div class="dg-wire">
  <div class="arrow">A2A (app-to-agent)</div>
  <div class="arrow left">A2A stream (app-to-agent)</div>
</div>
<div class="dg-lane dg-wide">
<div class="dg-label">// agent · @a2ui/agent</div>

```mermaid {scale: 0.74}
%%{init: {"theme": "base", "themeVariables": {"fontFamily": "JetBrains Mono, monospace", "fontSize": "11px", "lineColor": "#9aa0a6", "edgeLabelBackground": "#262626", "primaryTextColor": "#f0ebe4"}, "flowchart": {"curve": "basis", "nodeSpacing": 28, "rankSpacing": 30, "padding": 8}}}%%
flowchart TB
  A1["<b>negotiate</b><br/>pick-a2ui.ts"] --> A2["<b>prompt</b><br/>catalog.toJson()"] --> A3["Gemini"] --> A4{"valid?"}
  A4 -- "no · retry once" --> A2
  A4 -- yes --> A5["<b>applyPolicy</b><br/>strip · remove"]
  classDef step fill:#333333,stroke:#569cd6,stroke-width:2px,color:#f0ebe4
  classDef hot fill:#3d3530,stroke:#ce9178,stroke-width:3px,color:#ce9178
  classDef tool fill:#26302a,stroke:#6a9955,stroke-width:2px,color:#b5cea8
  class A1,A2,A4 step
  class A3 tool
  class A5 hot
```

</div>
</div>

<!--
Speaker notes:
Read it left to right, one lane at a time. Three boxes, two different wires.

Browser to our own server: plain POST /api/agent, SSE (Server-Sent Events) back.
That's our API (Application Programming Interface), not A2A (Agent2Agent
protocol, used here app-to-agent: our server to the agent). The browser never
sees an A2A (app-to-agent) type; it only gets A2UI (Agent-to-User Interface)
messages.

Server to agent: this is the only A2A (app-to-agent) hop. server.ts is the A2A
(app-to-agent) client and the only file that knows A2A (app-to-agent) exists,
so swapping the transport for AG-UI
(Agent-User Interaction Protocol), MCP (Model Context Protocol) or plain REST
(Representational State Transfer) means rewriting one file. Note: A2A here is app-to-agent, one agent. No
agent-to-agent delegation in this demo; that's what A2A (agent-to-agent) would
add later.

Inside the agent: negotiate the catalog from supportedCatalogIds, put
catalog.toJson() in the prompt, call Gemini, validate against the Zod catalog,
retry once on failure, then applyPolicy on every streamed message, not just the
last one. The orange box is the one validation can't replace.

Back in the browser, web_core checks the same Zod catalog again on arrival.
The dashed VALIDATION_FAILED arrow is the renderer reporting back to the agent
(app code, not web_core): the agent redoes the turn once, then answers in text.
-->



---
rule: ['Anatomy of an A2UI System', 'Part 4']
---

# Zod is not your addition — it's built into A2UI

Every catalog component is a Zod schema (`ComponentApi`): its allowed properties
and types. One definition, shared by both ends.

**Agent** — writes the catalog into the prompt as JSON Schema (`catalog.toJson()`)
and validates every reply against the same Zod, before anything is sent.

**Renderer** — registers its Angular components with the same objects and checks
every message again on arrival.

**The wire** — carries only catalog IDs (`supportedCatalogIds`). The protocol
can also send a catalog inline; the demo doesn't need to.

<div class="text-sm text-gray-400">

Source: [catalog/types.ts#L172-L183](https://github.com/a2ui-project/a2ui/blob/0af1b1e7/renderers/web_core/src/v0_9/catalog/types.ts#L172-L183) ·
[client-capabilities.ts#L15-L30](https://github.com/a2ui-project/a2ui/blob/0af1b1e7/renderers/web_core/src/v0_9/schema/client-capabilities.ts#L15-L30) ·
demo: `packages/catalog`

</div>

<!--
Speaker notes:
This is the point that connects directly back to the "Kneel Before Zod" material
for anyone who's seen that talk — Zod shows up here in a completely different
role than runtime validation of form input.
In the demo, packages/catalog is imported by both the agent and the Angular app:
the same ComponentApi objects. The browser (through our server) only says which
catalog it speaks; the agent already holds the schema.
The agent is constrained upfront: it cannot even attempt to use components or
property values outside the schema, because it never sees them as options in
the first place. And if the model drifts anyway, the agent's own validation
catches it before the user does.
-->

---
rule: ['Anatomy of an A2UI System', 'Part 4']
---

# Zod defines what the agent is allowed to think

For an audience that already knows Zod from runtime validation, this is the
reframe:

<div class="callout">

Here, Zod isn't the validation layer you bolt on. It's the schema language
the entire agent-client contract is written in.

</div>

<!--
Speaker notes:
Let this slide breathe — it's a short, dense idea and it lands better slow.
This is the sentence people should be quoting after the talk.
-->

---
rule: ['Anatomy of an A2UI System', 'Part 4']
---

# Validation ownership — who checks what, where

**Client-side** (`web_core`): capability negotiation and catalog schema validation.

**Your application policy layer** — forbidden fields, forbidden actions,
role restrictions — is what *you* add, and it belongs **server-side**,
before the payload reaches the client.

<div class="text-sm text-gray-400">

Source: [samples/client/angular/README.md#L54-L61](https://github.com/a2ui-project/a2ui/blob/0af1b1e7/samples/client/angular/README.md#L54-L61)

</div>

<!--
Speaker notes:
This is a distinction people will ask about in Q&A if you don't make it explicit
now: A2UI's own validation checks structure and type against the catalog. It has
no idea about your business rules — which role can see which field, which action
is disabled for which customer tier. That's a layer you build, and it has to sit
server-side, before the payload ever reaches the browser, or a client-side bypass
defeats the whole point.
-->

---
rule: ['Anatomy of an A2UI System', 'Part 4']
---

# The component registry is the trust boundary

The agent can only compose from what exists in the catalog.

It cannot invent. It cannot escape.

Unknown component types are rejected before reaching the renderer.

<div v-click>

## A2UI is not AI magic

<div class="callout">

It's a controlled rendering contract — and Zod is the language that contract
is written in.

</div>

</div>

<!--
Speaker notes:

Say this plainly, it's the summary of everything in this section.
This is the sentence to return to if anyone in Q&A asks "but what if the agent
tries something malicious" — the answer is always the same: it structurally
cannot reference anything outside the catalog, full stop.

[click: A2UI is not AI magic]
Close of section 4. Let this sit for a beat before moving into section 5,
which is where Angular specifically enters the picture.
-->

---
rule: ['Part 5', 'Angular as the Rendering Engine']
---

<div class="ta">
  <div class="ta-hero">
    <FitText>Angular as the</FitText>
    <FitText>Rendering Engine.</FitText>
  </div>
</div>

<!--
~15 minutes.
-->

---
rule: ['Angular as the Rendering Engine', 'Part 5']
---

# A2UI is framework-agnostic

The same JSON payload can be rendered in Flutter, Lit, React, or SwiftUI.

You're using Angular because it fits this architecture exceptionally well —
here's the specific technical case for why.

<!--
Speaker notes:
Own this directly and don't undersell it. Nobody in the room should think
you're claiming Angular is required. The claim is narrower and stronger:
Angular's existing primitives happen to map almost exactly onto what this
protocol needs, and that's worth walking through concretely rather than
asserting.
-->

---
rule: ['Angular as the Rendering Engine', 'Part 5']
---

# 5a. You write a catalog, not a renderer

`@a2ui/angular/v0_9` ships a `SurfaceComponent` (`<a2ui-v09-surface>`) you drop into your app.

It handles, internally:
- receiving A2UI messages: `A2uiRendererService.processMessages()` feeds the `MessageProcessor` from `web_core`
- resolving component types from your catalog
- dynamically instantiating Angular components via `ComponentHostComponent`
- wiring up reactive property bindings via `ComponentBinder`

<div class="text-sm text-gray-400">

Source: [surface.component.ts](https://github.com/a2ui-project/a2ui/blob/0af1b1e7/renderers/angular/src/v0_9/core/surface.component.ts) ·
[component-host.component.ts#L67-L100](https://github.com/a2ui-project/a2ui/blob/0af1b1e7/renderers/angular/src/v0_9/core/component-host.component.ts#L67-L100)

</div>

<!--
Speaker notes:
Start the section here — this reframes everything correctly before diving into
mechanism. What you write is a catalog. What the library gives you is a renderer.
Your custom components extend `CatalogComponent<typeof XApi>`, which types
`props()` straight from the Zod `ComponentApi`; each prop is a bound property
whose `value()` is an Angular signal bridged from the underlying Preact signal
in `web_core`. (`BasicCatalogComponent` is the subclass the library's own basic
components use; the demo's custom ones don't need it.)
The example to pull up live if time allows: the demo's PriorityBadge,
demo/apps/client/src/app/catalog/priority-badge.ts.
-->

---
rule: ['Angular as the Rendering Engine', 'Part 5']
---

# Your entire rendering integration

```ts {1-4|6-10|12-13}
// app.config.ts
provideA2Ui(() => ({
  catalogs: [createTicketCatalog(), new BasicCatalog()],
}))

// app.ts template: one element per surface, tracked by the surface object
// (a corrected reply re-creates a surface under the same id)
@for (entry of renderer.surfaceGroup.surfacesMap; track entry[1]) {
  <a2ui-v09-surface [surfaceId]="entry[0]" />
}

// agent-client.ts: every A2UI message the agent streams
renderer.processMessages([message]);
```

<div class="text-sm text-gray-400">

Around it: the client that brings the messages in and sends actions back (adapted from Google's
Angular sample, ~100 lines), and the error reporting of stages 5–6 (ours: web_core doesn't send
`VALIDATION_FAILED` yet).

Source: [app.config.ts](https://github.com/giorgiogalassi/talk-a2ui/blob/main/demo/apps/client/src/app/app.config.ts) ·
[app.ts](https://github.com/giorgiogalassi/talk-a2ui/blob/main/demo/apps/client/src/app/app.ts) ·
[agent-client.ts](https://github.com/giorgiogalassi/talk-a2ui/blob/main/demo/apps/client/src/app/agent/agent-client.ts) (trimmed)

</div>

<!--
Speaker notes:
Let this sit on screen for a second — it's deliberately anticlimactic.
Rendering A2UI in Angular is one provider, one element per surface, and one
call per message. That's all the library asks of the app.

Be precise about the word "rendering": the app also needs a client that talks
to its agent (A2UI doesn't fix a transport, so the library ships none; ours is
adapted from Google's Angular sample, about a hundred lines), and the demo adds
its own error reporting for stages 5–6, because web_core doesn't send
VALIDATION_FAILED yet. The real config also passes an `actionHandler` that sends
button actions back to the agent; trimmed here.

On `track entry[1]`: track the surface object, not its id. A corrected reply
re-creates a surface under the same id; tracked by id, Angular keeps the old
drawing (incident 6 in the demo README).

Everything else lives in the catalog you write next.
-->

---
rule: ['Angular as the Rendering Engine', 'Part 5']
---

# What your catalog looks like

```ts {3|4-6}
// Pair each Zod ComponentApi with the Angular component that draws it
new AngularCatalog(TICKET_CATALOG_ID, 'v0.9', [
  ...BASIC_COMPONENTS.filter((impl) => basicNames.has(impl.name)),
  createComponentImplementation(TicketListApi, TicketListComponent),
  createComponentImplementation(PriorityBadgeApi, PriorityBadgeComponent),
  createComponentImplementation(AssigneeChipApi, AssigneeChipComponent),
], [], BasicCatalogThemeSchema);
```

<div class="text-sm text-gray-400">

Source: [ticket-catalog.ts](https://github.com/giorgiogalassi/talk-a2ui/blob/main/demo/apps/client/src/app/catalog/ticket-catalog.ts)

</div>

<!--
Speaker notes:
This is the artifact your team actually maintains: a list of API/implementation
pairs. Each `Api` is the Zod schema from section 4, imported from the same
`packages/catalog` the agent validates with. Each implementation is a normal
Angular component. The basic components (Text, Row, Card…) are the library's
own, filtered to the ones the catalog lists. No special DSL beyond this.
-->

---
rule: ['Angular as the Rendering Engine', 'Part 5']
---

# 5b. Reactivity — Preact signals meet Angular signals

The reactive layer, `@preact/signals-core`, lives inside `web_core` —
framework-agnostic by design.

The Angular renderer bridges Preact signals into Angular's component model
via `ComponentBinder`.

## Inside a catalog component

```ts {1|2-4}
export class PriorityBadgeComponent extends CatalogComponent<typeof PriorityBadgeApi> {
  // 'low' | 'medium' | 'high' | 'urgent', inferred from the Zod enum;
  // value() re-reads when the Preact signal in web_core changes
  protected readonly priority = computed(() => this.props().priority?.value());
}
```

<div class="text-sm text-gray-400">

Source: [signals.ts#L1-L20](https://github.com/a2ui-project/a2ui/blob/0af1b1e7/renderers/web_core/src/v0_9/reactivity/signals.ts#L1-L20) ·
[component-binder.service.ts](https://github.com/a2ui-project/a2ui/blob/0af1b1e7/renderers/angular/src/v0_9/core/component-binder.service.ts) ·
[priority-badge.ts](https://github.com/giorgiogalassi/talk-a2ui/blob/main/demo/apps/client/src/app/catalog/priority-badge.ts) ·
[components.ts](https://github.com/giorgiogalassi/talk-a2ui/blob/main/demo/packages/catalog/src/components.ts) (`PriorityBadgeApi`, Zod 3)

</div>

<!--
Speaker notes:

Preact signals were chosen at the protocol level precisely because they're
tiny and framework-agnostic — any renderer, in any framework, can bridge them
into its own reactivity model. Angular's bridge is `ComponentBinder`; a
different framework would write its own bridge over the same underlying signal.

[Inside a catalog component]
This is what you actually write inside a catalog component: ordinary Angular
`computed()` signals reading `props().<name>.value()`. The type comes from
`PriorityBadgeApi`, so there is no hand-written props interface to keep in sync. Nothing about Preact leaks into
your component code — the bridge absorbs it entirely.
-->

---
rule: ['Angular as the Rendering Engine', 'Part 5']
---

# Why the message split matters

A2UI separates component **structure** from **data** into distinct message types:

- `updateComponents` — defines the tree
- `updateDataModel` — updates a single JSON Pointer path

<div class="callout">

Only the Preact signal at that path fires. Only the Angular computed signal
that reads it re-evaluates. Only the component that depends on it re-renders.
The rest of the surface is untouched.

</div>

<div class="text-sm text-gray-400">

Source: [a2ui_protocol.md#L22-L29](https://github.com/a2ui-project/a2ui/blob/0af1b1e7/specification/v0_9/docs/a2ui_protocol.md#L22-L29) ·
[component-context.ts#L27-L38](https://github.com/a2ui-project/a2ui/blob/0af1b1e7/renderers/web_core/src/v0_9/rendering/component-context.ts#L27-L38)

</div>

<!--
Speaker notes:
This is the architectural payoff of the signal-per-path design, and it's worth
slowing down for. When the agent streams a data update, it's targeting one
JSON Pointer path — not re-sending the whole tree. That precision is what
makes fine-grained reactivity possible at all downstream.
-->

---
rule: ['Angular as the Rendering Engine', 'Part 5']
---

# 5c. Zoneless and streaming — the specific argument

A2UI streams many small `updateDataModel` messages, each targeting one
JSON Pointer path.

<div class="ta-cols" style="grid-template-columns: 1fr 1.45fr">
<div>

## With Zone.js

Every incoming async message from a WebSocket or SSE stream
triggers **application-wide** change detection — even when one field on one
component changed.

</div>
<div v-click>

## With Zoneless + OnPush

```ts
bootstrapApplication(AppComponent, {
  providers: [provideZonelessChangeDetection()] // default since Angular 21
});
```

Only the computed signals that actually changed are re-evaluated.

For a data-heavy dashboard receiving live updates: the difference between
a performant and a sluggish surface.

<div class="text-sm text-gray-400">

Zoneless is stable since Angular 20.2 and the default since 21. The demo runs
on Angular 22 with no Zone.js at all.

</div>

</div>
</div>

<!--
Speaker notes:

Don't just name-drop Zoneless here — make the specific case, this is the slide
where a skeptical Angular engineer decides whether you actually understand the
mechanism or are pattern-matching buzzwords.

[click: With Zoneless + OnPush]
On 21+ the provider line is not needed; it's on the slide to name the
mechanism. OnPush plus signals already gets you most of the win. Zoneless removes the last bit of
coarse-grained triggering on top of that.
-->

---
rule: ['Angular as the Rendering Engine', 'Part 5']
---

# 5d. The "deterministic renderer" claim — stated precisely

The renderer is **structurally deterministic**: given the same A2UI payload
and the same application state, it produces the same component tree.

<div class="text-sm text-gray-400">

Individual components may still vary visually — internal state, async data,
user context. What's deterministic is the *structure*: which components
render, in which order, with which inputs.

</div>

<div class="callout">

The AI cannot affect anything outside that contract.

</div>

<!--
Speaker notes:
Say this precisely, not loosely — advanced audiences will push back hard on
an overclaimed "deterministic" if you don't scope it correctly. You're not
claiming pixel-identical output forever. You're claiming the tree shape and
the component boundary are fixed by the payload, not by anything the model
does at render time.
-->

---
rule: ['Angular as the Rendering Engine', 'Part 5']
---

# 5e. Standalone components and the registry pattern

Each registered component is:

- fully self-contained, with its own imports
- free of NgModule coupling that could cause side effects when loaded dynamically
- individually tree-shakeable

The dynamic loading in `ComponentHostComponent` relies on exactly this.

<!--
Speaker notes:
Quick, confident close to the section. Standalone components aren't incidental
here — the dynamic-instantiation model in `ComponentHostComponent` needs
components that can be loaded in isolation, without a module graph to resolve
first. That's precisely what standalone gives you.

DEMO RUN-SHEET (was the Demo section slides; the screen stays on this slide during the demo)

Notes: ~10 minutes. Scenario: Enterprise Support Dashboard.

# The prompt

> "Show me unresolved enterprise tickets with priority and assignee."

## Stage by stage

1. Network tab: `a2uiClientCapabilities` goes to the agent **before** any UI is
   generated. It carries only the catalog IDs; the agent already holds the schema
2. Agent produces an A2UI JSON payload — show the actual JSON, it's readable
3. Server-side policy strips `internal_notes` and removes the `delete` action:
   the button never reaches the browser
4. Payload reaches the client, `web_core` validates against the catalog schema

Notes: 
Set the scene, then walk each stage explicitly on the following slides.
Run the live agent (Gemini), as the abstract promises. If the model is slow or
down, switch to the stub agent (same catalog, policy and validation, canned
replies) or the recording, and say so openly.

[Stage by stage]
Narrate each numbered step as you show it on screen. Don't rush stage 1 —
it's the one that visually proves the capability negotiation happened before
generation, which is the whole argument from section 4.

# Stage by stage, continued

5. A deliberately malformed payload fails the agent's Zod check — **show the
   agent log**: the error goes back to the model and the retry is generated
6. The retry replaces the surface. If it fails too, the user gets a plain text
   answer, never a broken screen
7. The streamed `updateDataModel` messages fill the list in — show only the
   ticket rows re-evaluating in Angular DevTools profiler

Notes: Stage 5 is the moment that proves the reliability story from section 7 —
don't let it pass as a throwaway line, it's evidence, not decoration.
Trigger it with the stub agent (STUB_INVALID_FIRST=true): a live model rarely
fails on cue.
What's real, client side (built 2026-11-12): with STUB_CLIENT_INVALID=true the
agent's check passes a ticket whose data says priority "critical" (the badge
binds to it, which the schema allows). The renderer resolves the binding, shows
a "?" badge, keeps the rest of the list, and POSTs VALIDATION_FAILED with path
/tickets/0/priority. The agent logs "A2UI client reported VALIDATION_FAILED",
retries once with that error, and the corrected list replaces the surface; a
second report for the same turn gets the text answer. web_core does not send
this by itself: the demo's AgentClient catches and reports it.
Stage 7 is where the Zoneless/signals argument from 5c becomes visible —
open the profiler and let the room see exactly one component highlighted.

# The moment to land

The agent never touched the DOM.

A malformed payload was caught, sent back to the model and retried — not a
crash, not a silent failure.

The system controlled the model. Not the other way around.

**On model choice** · Gemini through `@google/genai`, with one tool (`get_tickets`) and thinking set
to `MINIMAL` for latency. No `response_schema`: the catalog in the prompt and
the Zod check after it do that job.

Notes: 
Deliver slowly. This is the payoff of the entire demo and arguably the entire
talk. Let it sit before moving to the model-choice footnote.

[On model choice]
Quick, factual footnote for anyone asking "what LLM did you actually use."
Not the focus of the talk — the architecture is model-agnostic, this is just
transparency about the demo setup.
-->

---
rule: ['Part 6', 'Production Reality']
---

<div class="ta">
  <div class="ta-hero">
    <FitText>Production Reality.</FitText>
  </div>
</div>

<!--
~5 minutes.
-->

---
rule: ['Production Reality', 'Part 6']
---

# Security

The component catalog is the primary trust boundary, enforced **before
generation** via capability negotiation.

Your application policy layer — forbidden fields, forbidden actions, role
restrictions — is what you add server-side.

The Angular README documents three threat categories: **UI spoofing**,
**property injection (XSS)**, and **denial of service** via layout complexity.

<div class="text-sm text-gray-400">

Source: [samples/client/angular/README.md#L54-L61](https://github.com/a2ui-project/a2ui/blob/0af1b1e7/samples/client/angular/README.md#L54-L61)

</div>

<!--
Speaker notes:
Angular's native property binding sanitization handles the XSS case directly —
no extra library needed, it's the same sanitizer Angular already runs for
every binding. The flat adjacency list format used for the component tree
makes complexity-based DoS attacks easier to detect and limit than a nested
tree would be, since depth and fan-out are cheap to bound-check.
-->

---
rule: ['Production Reality', 'Part 6']
---

<div class="ta-cols c3">
<div>

## Reliability

The agent checks every payload against the Zod catalog before it ships. A
failure goes back to the model with the error, for one retry.

<div class="callout">

This is not a silent drop. It's a feedback loop.

</div>

Define fallback surfaces for each failure level before you need them.

</div>
<div v-click>

## Observability

Every A2UI payload is a **structured, loggable artifact**.

You can trace exactly what the agent *intended* versus what the renderer
*produced*.

<div class="text-sm text-gray-400">

A significant advantage over AI-generated HTML, which gives you no equivalent
structured trace.

</div>

</div>
<div v-click>

## Performance

Separate `updateComponents` / `updateDataModel` message types.

Per-path Preact signals. Angular computed signals with OnPush. Zoneless
architecture.

<div class="callout">

These compose into a genuinely efficient streaming surface.

</div>

</div>
</div>

<!--
Speaker notes:

[Reliability]
Tie this directly back to demo stage 5 — the room just saw this happen.
On the client, the protocol defines the same signal: a `VALIDATION_FAILED`
error message from renderer to agent. The demo sends it (app code, not web_core)
and the agent retries once on it. The point: failure is communicated back to the agent,
which means the agent can potentially retry or degrade gracefully, rather than
the user just seeing a broken page with no explanation anywhere in the system.

[click: Observability]
Quick slide — the point is simple and doesn't need much elaboration. With raw
HTML generation you can log the string, but you have no structured way to ask
"did the agent try to do something it wasn't allowed to do." With A2UI, the
payload itself is the audit trail.

[click: Performance]
This is the summary slide tying together 5b and 5c — don't re-explain the
mechanism, just name the pieces and let the room recall what they already saw.

[Say last, after the Performance click: was the "Production-ready Generative UI" slide]
"Production-ready Generative UI is an architecture problem. Not a prompt engineering problem."
Close of section 7. Let this land, then transition into the future section —
this line is a good one to repeat verbatim if asked to summarize the talk
in one sentence afterward.
-->


---
rule: ['Questions', 'A2UI · AngularDay 2026']
---

<div class="ta">
  <div class="ta-hero">
    <FitText>Questions?</FitText>
  </div>
  <div class="ta-promo">
    <!-- TODO masterclass: replace the placeholder with <img src="/src/qr-masterclass.png" class="qr-code" alt="QR code to the masterclass sign-up" /> once the link exists -->
    <div class="qr-placeholder" aria-hidden="true">QR<br>soon</div>
    <div>
      <b>Go deeper: the A2UI masterclass</b>
      <span>Structured generative UI with Angular, hands-on · December · sign up via the QR</span>
    </div>
  </div>
</div>

<!--
Speaker notes:
Open the Q&A with the masterclass in one sentence: "If you want to build this
hands-on, I'm running a masterclass in December: the QR stays up the whole Q&A."
Then take questions.
Q&A happens here, before the closing line: I decide how many questions and for
how long. When time is up, move to the Thank you slide and land the close.

Q&A prep — likely questions:
- "Is A2UI production-ready?" → The spec is v1.0 and stable since 6 Nov; the
  libraries are still 0.x and the demo pins v0.9. The pattern is what to adopt now;
  the specific library will stabilize. See section 2 maturity slide.
- "What about React/Vue teams?" → A2UI is framework-agnostic (section 5 opener).
  The Angular-specific argument is about fit, not exclusivity.
- "Doesn't the agent still need to know the catalog?" → Yes — that's the point.
  Capability negotiation sends the catalog to the agent before generation
  (section 4). It's a closed, known vocabulary, not an open one.
- "What stops a compromised agent from requesting a valid-looking but malicious
  combination of valid components?" → Server-side policy enforcement (section 4
  validation ownership slide) is the layer for this — catalog validation checks
  shape, not business rules.

- "Where is this heading?" → was Part 7, The Future (moved off the slides 2026-11-14; no published source, it is my projection). Renderers checked on a2ui-project/a2ui main 2026-11-14: Angular, React, Lit (TypeScript), Flutter (Dart), SwiftUI (Swift, via SwiftPM). Jetpack Compose is only named in the README, no renderer in the repo.

# A component that describes itself

Imagine a `<calendar>` component that, alongside its rendering logic, exposes
a schema describing its own capabilities: what actions it accepts, what data
it needs, what events it emits.

Any agent, without knowing the component exists, can compose it correctly —
because the capability negotiation protocol already handles exactly this
exchange.

The component advertises itself. The agent operates within what it's been shown.

Notes: Ground the future section with this one concrete example before going broad —
don't jump straight to the abstract vision. This is a natural extension of
the capability manifest mechanism from section 4, just pushed further: instead
of a fixed catalog manifest, individual components self-describe.

# The broader vision

A2UI is already pointing here.

The same agent composes a surface that renders natively in **Angular**,
**Flutter**, or **SwiftUI** — from the same JSON payload.

The frontend stops being a passive render target and becomes a capability
system.

Notes: Widen the lens here. Everything in the talk was scoped to one Angular app —
this is the reminder that the protocol itself doesn't care which renderer
is on the other end, and that's a deliberate design choice, not an accident.
-->

---
rule: ['Thank you', 'ggalassi.dev']
---
<div class="ta ta-split">
  <div class="ta-split-main">
  <div class="ta-hero" style="margin-block:0">
    <FitText serif>Thank you</FitText>
  </div>
  <div class="ta-aside" style="margin-top:0.8rem;grid-template-columns:1fr">
    <strong>Stop letting LLMs generate HTML. Start designing systems that speak UI.</strong>
  </div>
  <div class="ta-thanks" style="grid-template-columns:1fr;gap:0.6rem;padding-top:0.6rem">
    <div class="who">
      <b>Giorgio Galassi</b>
      <span>Senior Frontend Engineer (Freelancer) · GDG Roma Città Organizer</span>
      <div class="tags" style="margin-top:0.5rem">
        <span class="tag">Angular</span>
        <span class="tag">AI</span>
        <span class="tag">Generative UI</span>
        <span class="tag">A2UI</span>
        <span class="tag">Signals</span>
        <span class="tag">Zoneless</span>
      </div>
    </div>
    <div class="ta-qrs">
      <div class="qr-row">
        <img src="/src/qr-angularday-agenda.png" alt="QR code to the AngularDay agenda" class="qr-code" />
        <span><b>Rate this talk</b>in the AngularDay app</span>
      </div>
      <div class="qr-row">
        <img src="/src/qrcode.png" alt="QR code to links and slides" class="qr-code" />
        <span><b>Links, slides</b>&amp; more</span>
      </div>
    </div>
  </div>
  </div>
  <div class="ta-blob">
    <div class="ta-blob-back" aria-hidden="true"></div>
    <div class="ta-blob-photo">
      <img src="/src/profile.jpg" alt="Giorgio Galassi speaking on stage" />
    </div>
  </div>
</div>

<!--
Speaker notes:
[Was the Close slide]
Land this slowly, mirroring the close of the context-engineering talk structure.
The room should leave with the reframe from section 2, not a list of APIs:
AI-native Angular is not a new framework. It's the one you already know,
used correctly. Thank the room (questions already happened on the previous slide).

Before leaving the slide: remind the room to use the AngularDay app to interact
and, above all, to rate the talk (QR on the right goes to grusp.org/agenda).
-->
