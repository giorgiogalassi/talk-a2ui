# Your AI Should Not Generate HTML: Structured Generative UI with Angular and A2UI

A Slidev presentation by **Giorgio Galassi** for AngularDay 2026, on why AI agents
should never generate HTML directly, and how Google's A2UI standard lets agents
speak a declarative JSON protocol that Angular renders through its own trusted
component catalog.

## Abstract

Angular applications are getting smarter. Agents are starting to drive them. And
nobody has figured out what that actually looks like in production. This talk
explores one answer.

When an agent needs to respond with something interactive (a form, a dashboard, a
data table), generating HTML or JSX is unsafe and impossible to validate across a
trust boundary. A2UI is Google's open standard for agent-to-UI communication:
agents produce declarative JSON, the Angular application owns rendering through
its own component catalog, and the agent never executes anything in the browser.
It turns out that Angular's existing strengths (Signals, standalone components,
Zoneless change detection) map almost exactly to what this protocol needs. That
is not a coincidence.

The talk covers:
- Why agents hit a wall the moment they need to hand back something interactive,
  and why HTML/JSX generation is unsafe across a trust boundary
- The paradigm shift: the LLM as planner and composer, not code generator
- Where this architecture actually earns its complexity (enterprise tooling,
  financial dashboards, healthcare, multi-agent orchestration) — and where it doesn't
- The full A2UI pipeline: capability negotiation, Zod catalog schemas, server-side
  policy enforcement, client-side validation
- Why Angular's Signals, standalone components, and Zoneless change detection map
  almost exactly onto what a streaming, agent-driven renderer needs
- A live demo: an enterprise dashboard driven by a live agent
- Production reality: security, reliability, observability, performance
- Where this is heading: self-describing components and cross-framework rendering

## Event

**AngularDay 2026** — 40-minute talk with live demo (pre-recorded fallback
prepared) · Advanced level
Tags: Angular, AI, Generative UI, A2UI, Signals, Zoneless, Architecture

## Stack

- [Slidev](https://sli.dev/) — presentation framework
- Vue 3
- UnoCSS (Slidev default)
- Shiki — code highlighting

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3030](http://localhost:3030) in your browser.

## Run the demo

The live demo is in [`demo/`](demo/): an Angular 22 app and an A2A agent sharing one Zod
catalog. It needs Node 22.22+ or 24.15+ (`.nvmrc`: 24). The stub needs no API key:

```bash
cd demo
npm install
npm run demo          # stub agent on :10002 + app on http://localhost:4200
```

Live Gemini, the stage switches (Alt+Shift+D) and everything else: [`demo/README.md`](demo/README.md#run).
How a turn moves through the system: [`demo/docs/data-flow/`](demo/docs/data-flow/README.md).

## Commands

| Command           | Description                        |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Start local dev server with HMR    |
| `npm run build`   | Build static site for production   |
| `npm run export`  | Export presentation to PDF         |

## Structure

```
slides.md               — all slide content and speaker notes
demo/                   — the live demo: apps/agent, apps/client, packages/catalog, docs/data-flow
QA.md                   — living Q&A prep doc: audience questions + architecture rationale
IMPLEMENTATION-PLAN.md  — living build-tracking doc: scope, build order, risks, changelog
src/                    — images used in slides
styles/                 — custom CSS
```

All slide content lives in `slides.md`. Speaker notes are in `<!-- -->` comment blocks at the bottom of each slide.

`QA.md` and `IMPLEMENTATION-PLAN.md` are both living documents for the demo
(client + agent) project behind this talk, split by audience: `QA.md` holds
anticipated audience questions and the high-level "why" behind each
architecture decision, for stage-ready answers. `IMPLEMENTATION-PLAN.md`
holds project structure, build scope, the practical build order for agent
and client, known technical risks, and the decisions changelog. Keep both in
sync whenever a decision changes while building the demo.

## Author

**Giorgio Galassi** — Senior Frontend Engineer (Freelancer) · GDG Roma Città Organizer

## License

MIT, see [`LICENSE`](LICENSE).

**Third-party code.** Parts of the demo are adapted from the official A2UI samples
([a2ui-project/a2ui](https://github.com/a2ui-project/a2ui), Apache-2.0, Copyright Google LLC):
the agent files in `demo/apps/agent/src/` that carry the Apache-2.0 header (from
`samples/agent/node/restaurant_finder`), and the client's `demo/apps/client/src/server.ts` and
`src/app/agent-client.ts` (from `samples/client/angular/projects/restaurant`). They keep that
header and mark the demo's changes with `// Demo:`. The rest (policy, demo switches, client
retry, catalog, tests) is the demo's own, under MIT.
