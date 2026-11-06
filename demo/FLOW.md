# Demo flow, phase by phase

One diagram per implementation phase, so the demo's growth can be followed (and, later, shown on
stage) as a sequence of frames. Status per phase lives in `README.md`; this file only draws it.

**Rules that keep the frames a transition, not a set of unrelated pictures:**

- Every frame draws **the same nodes, with the same ids, in the same order**, plus the same edges in
  the same order. Nothing is added or dropped between frames: a node or edge only changes status.
- Status is a class: `todo` (dashed, grey: not built yet), `new` (highlighted: added in this phase),
  `done` (plain: carried over), `gone` (faded: replaced in this phase or earlier).
- An edge that does not exist yet (or any more) is written `~~~`, an invisible link, so the layout
  does not move when it appears. Solid arrows are requests, dotted arrows are what comes back.
- A new phase copies the previous frame, flips the classes and arrows that changed, and adds any new
  node to **every** earlier frame as `todo`.

## Phase 1 — render without an agent (done 2026-10-22)

The renderer is fed one hardcoded A2UI v0.9 message (the booking form from the official Node agent
sample). Clicking *Submit Reservation* fires a `submit_booking` action that is only logged.

```mermaid
flowchart LR
  subgraph B["Browser · Angular 22 app"]
    direction TB
    U(["User"])
    APP["App<br/>prompt form"]
    HC["booking-form.json<br/>hardcoded A2UI message"]
    AC["AgentClient<br/>ask() · handleAction()"]
    R["A2uiRendererService<br/>processMessages()"]
    S["a2ui-v09-surface<br/>BasicCatalog"]
    LOG["console.log(action)"]
  end
  subgraph SV["Client SSR server · :4200"]
    direction TB
    BR["POST /a2a bridge<br/>server.ts"]
    AX["A2AClient<br/>+ X-A2A-Extensions header"]
  end
  subgraph AG["Agent · :10002"]
    direction TB
    EX["RestaurantExecutor.run<br/>pick version · read action"]
    GEN["generateUi<br/>stream · validate · 1 retry"]
    STUB["StubBackend<br/>canned example per action"]
    LLM[("Gemini")]
    POL["applyPolicy<br/>policy.ts"]
  end
  subgraph PK["packages/catalog"]
    direction TB
    CAT["Zod ComponentApi<br/>→ Catalog.toJson()"]
  end

  U ~~~ APP
  APP ~~~ AC
  HC -->|"loaded at startup"| R
  AC ~~~ BR
  BR ~~~ AX
  AX ~~~ EX
  EX ~~~ GEN
  GEN ~~~ STUB
  GEN ~~~ LLM
  GEN ~~~ AX
  AX ~~~ BR
  BR ~~~ AC
  AC ~~~ R
  R --> S
  S ~~~ AC
  S -->|"Submit → submit_booking<br/>context = typed values"| LOG
  GEN ~~~ POL
  POL ~~~ AX
  CAT ~~~ GEN
  CAT ~~~ S

  classDef todo fill:none,stroke:#9aa0a6,stroke-dasharray:4 3,color:#9aa0a6
  classDef new fill:#e8f0fe,stroke:#1a73e8,stroke-width:2px,color:#0b3d91
  classDef done fill:#ffffff,stroke:#5f6368,color:#202124
  classDef gone fill:#f1f3f4,stroke:#dadce0,color:#bdc1c6
  class U,HC,R,S,LOG new
  class APP,AC,BR,AX,EX,GEN,STUB,LLM,POL,CAT todo
```

## Phase 2 — the full chain in stub mode (done 2026-10-22)

The browser never speaks A2A: it POSTs to its own server, which is the A2A client. The agent runs
with `STUB_LLM=true`, so no model is called: it picks a canned example by action name (no action →
restaurant list, `book_restaurant` → booking form, `submit_booking` → confirmation), prefixes a
stub-notice surface, and streams it in four chunks. Each UI action goes back through the same path
as a `{ version: 'v0.9', action }` data part; the conversation is held together by `contextId`.

```mermaid
flowchart LR
  subgraph B["Browser · Angular 22 app"]
    direction TB
    U(["User"])
    APP["App<br/>prompt form"]
    HC["booking-form.json<br/>hardcoded A2UI message"]
    AC["AgentClient<br/>ask() · handleAction()"]
    R["A2uiRendererService<br/>processMessages()"]
    S["a2ui-v09-surface<br/>BasicCatalog"]
    LOG["console.log(action)"]
  end
  subgraph SV["Client SSR server · :4200"]
    direction TB
    BR["POST /a2a bridge<br/>server.ts"]
    AX["A2AClient<br/>+ X-A2A-Extensions header"]
  end
  subgraph AG["Agent · :10002"]
    direction TB
    EX["RestaurantExecutor.run<br/>pick version · read action"]
    GEN["generateUi<br/>stream · validate · 1 retry"]
    STUB["StubBackend<br/>canned example per action"]
    LLM[("Gemini")]
    POL["applyPolicy<br/>policy.ts"]
  end
  subgraph PK["packages/catalog"]
    direction TB
    CAT["Zod ComponentApi<br/>→ Catalog.toJson()"]
  end

  U -->|"types a prompt"| APP
  APP -->|"ask(query)<br/>clears surfaces"| AC
  HC ~~~ R
  AC -->|"fetch POST /a2a<br/>query or event + contextId"| BR
  BR -->|"text part, or data part<br/>{ version: 'v0.9', action }<br/>+ a2uiClientCapabilities"| AX
  AX -->|"A2A v0.3 message/stream<br/>JSON-RPC"| EX
  EX --> GEN
  GEN -->|"actionName"| STUB
  GEN ~~~ LLM
  GEN -.->|"A2UI data parts<br/>status working → input-required<br/>(completed after submit)"| AX
  AX -.->|"stream events"| BR
  BR -.->|"SSE data: { parts, contextId }"| AC
  AC -.->|"A2UI messages"| R
  R --> S
  S -->|"button → actionHandler<br/>handleAction(action)"| AC
  S ~~~ LOG
  GEN ~~~ POL
  POL ~~~ AX
  CAT ~~~ GEN
  CAT ~~~ S

  classDef todo fill:none,stroke:#9aa0a6,stroke-dasharray:4 3,color:#9aa0a6
  classDef new fill:#e8f0fe,stroke:#1a73e8,stroke-width:2px,color:#0b3d91
  classDef done fill:#ffffff,stroke:#5f6368,color:#202124
  classDef gone fill:#f1f3f4,stroke:#dadce0,color:#bdc1c6
  class APP,AC,BR,AX,EX,GEN,STUB new
  class U,R,S done
  class HC,LOG gone
  class LLM,POL,CAT todo
```

## Phase 3 — live model (done 2026-10-31)

`GEMINI_API_KEY` set, so `generateUi` calls Gemini (`gemini-3.6-flash`), which calls the
`get_restaurants` tool and streams A2UI back; `StubBackend` stays as the fallback when
`STUB_LLM=true`. Two fixes landed with it (`README.md` → "Incidents"): `@a2ui/agent` 0.0.1 → 0.0.2,
so the client now clears surfaces on every request; and the agent validates with `@a2ui/web_core`'s
Zod `basicCatalog`, the one the renderer uses, so a binding cut mid-stream is held back.

```mermaid
flowchart LR
  subgraph B["Browser · Angular 22 app"]
    direction TB
    U(["User"])
    APP["App<br/>prompt form"]
    HC["booking-form.json<br/>hardcoded A2UI message"]
    AC["AgentClient<br/>ask() · handleAction()<br/>clears surfaces each request"]
    R["A2uiRendererService<br/>processMessages()"]
    S["a2ui-v09-surface<br/>BasicCatalog"]
    LOG["console.log(action)"]
  end
  subgraph SV["Client SSR server · :4200"]
    direction TB
    BR["POST /a2a bridge<br/>server.ts"]
    AX["A2AClient<br/>+ X-A2A-Extensions header"]
  end
  subgraph AG["Agent · :10002"]
    direction TB
    EX["RestaurantExecutor.run<br/>pick version · read action"]
    GEN["generateUi → answer()<br/>@a2ui/agent 0.0.2 stream<br/>checked per message · 1 retry<br/>web_core basicCatalog (renderer's Zod)"]
    STUB["StubBackend<br/>canned example per action"]
    LLM[("Gemini")]
    POL["applyPolicy<br/>policy.ts"]
  end
  subgraph PK["packages/catalog"]
    direction TB
    CAT["Zod ComponentApi<br/>→ Catalog.toJson()"]
  end

  U -->|"types a prompt"| APP
  APP -->|"ask(query)<br/>clears surfaces"| AC
  HC ~~~ R
  AC -->|"fetch POST /a2a<br/>query or event + contextId"| BR
  BR -->|"text part, or data part<br/>{ version: 'v0.9', action }<br/>+ a2uiClientCapabilities"| AX
  AX -->|"A2A v0.3 message/stream<br/>JSON-RPC"| EX
  EX --> GEN
  GEN -->|"actionName"| STUB
  GEN -->|"prompt + catalog<br/>get_restaurants tool"| LLM
  GEN -.->|"A2UI data parts<br/>status working → input-required<br/>(completed after submit)"| AX
  AX -.->|"stream events"| BR
  BR -.->|"SSE data: { parts, contextId }"| AC
  AC -.->|"A2UI messages"| R
  R --> S
  S -->|"button → actionHandler<br/>handleAction(action)"| AC
  S ~~~ LOG
  GEN ~~~ POL
  POL ~~~ AX
  CAT ~~~ GEN
  CAT ~~~ S

  classDef todo fill:none,stroke:#9aa0a6,stroke-dasharray:4 3,color:#9aa0a6
  classDef new fill:#e8f0fe,stroke:#1a73e8,stroke-width:2px,color:#0b3d91
  classDef done fill:#ffffff,stroke:#5f6368,color:#202124
  classDef gone fill:#f1f3f4,stroke:#dadce0,color:#bdc1c6
  class AC,GEN,LLM new
  class U,APP,BR,AX,EX,STUB,R,S done
  class HC,LOG gone
  class POL,CAT todo
```

## Phase 4 — Zod catalog + ticket domain (done 2026-11-06) ← current

`packages/catalog` defines the ticket catalog once, as Zod 3 `ComponentApi`s (`TicketList`,
`PriorityBadge`, `AssigneeChip` plus the basic `Text`/`Row`/`Column`/`Card`/`Divider`/`Button`),
assembled with `new Catalog(id, 'v0.9', …)`. The agent registers that `Catalog`: the prompt
carries its `toJson()` document, validation runs on its Zod. The Angular components are typed and
registered with the same `ComponentApi` objects, and `server.ts` advertises only the ticket
catalog id. Restaurants are gone: `get_tickets` tool, ticket examples, `open_ticket` /
`resolve_ticket`. A prop outside the catalog fails validation and is retried once; `AgentClient`
now lets a retry's `createSurface` replace the surface the failed attempt streamed.

```mermaid
flowchart LR
  subgraph B["Browser · Angular 22 app"]
    direction TB
    U(["User"])
    APP["App<br/>prompt form"]
    HC["booking-form.json<br/>hardcoded A2UI message"]
    AC["AgentClient<br/>ask() · handleAction()<br/>clears surfaces each request<br/>createSurface replaces"]
    R["A2uiRendererService<br/>processMessages()"]
    S["a2ui-v09-surface<br/>ticket catalog: TicketList<br/>PriorityBadge · AssigneeChip"]
    LOG["console.log(action)"]
  end
  subgraph SV["Client SSR server · :4200"]
    direction TB
    BR["POST /a2a bridge<br/>server.ts"]
    AX["A2AClient<br/>+ X-A2A-Extensions header"]
  end
  subgraph AG["Agent · :10002"]
    direction TB
    EX["RestaurantExecutor.run<br/>pick version · read action"]
    GEN["generateUi → answer()<br/>@a2ui/agent 0.0.2 stream<br/>checked per message · 1 retry<br/>ticket catalog (Zod)"]
    STUB["StubBackend<br/>canned ticket UI per action"]
    LLM[("Gemini")]
    POL["applyPolicy<br/>policy.ts"]
  end
  subgraph PK["packages/catalog"]
    direction TB
    CAT["Zod ComponentApi<br/>→ Catalog.toJson()"]
  end

  U -->|"types a prompt"| APP
  APP -->|"ask(query)<br/>clears surfaces"| AC
  HC ~~~ R
  AC -->|"fetch POST /a2a<br/>query or event + contextId"| BR
  BR -->|"text part, or data part<br/>{ version: 'v0.9', action }<br/>+ supportedCatalogIds: [ticket id]"| AX
  AX -->|"A2A v0.3 message/stream<br/>JSON-RPC"| EX
  EX --> GEN
  GEN -->|"actionName"| STUB
  GEN -->|"prompt + catalog.toJson()<br/>get_tickets tool"| LLM
  GEN -.->|"A2UI data parts<br/>status working → input-required<br/>(completed after resolve)"| AX
  AX -.->|"stream events"| BR
  BR -.->|"SSE data: { parts, contextId }"| AC
  AC -.->|"A2UI messages"| R
  R --> S
  S -->|"button → actionHandler<br/>handleAction(action)"| AC
  S ~~~ LOG
  GEN ~~~ POL
  POL ~~~ AX
  CAT -->|"new Catalog(…)<br/>prompt: toJson() · validation: Zod"| GEN
  CAT -->|"same ComponentApi objects<br/>CatalogComponent#60;typeof Api#62;"| S

  classDef todo fill:none,stroke:#9aa0a6,stroke-dasharray:4 3,color:#9aa0a6
  classDef new fill:#e8f0fe,stroke:#1a73e8,stroke-width:2px,color:#0b3d91
  classDef done fill:#ffffff,stroke:#5f6368,color:#202124
  classDef gone fill:#f1f3f4,stroke:#dadce0,color:#bdc1c6
  class CAT,S,GEN,AC new
  class U,APP,BR,AX,EX,STUB,LLM,R done
  class HC,LOG gone
  class POL todo
```

**Next frames** (planned; `POL` and `CAT` were added to every frame as `todo` on 2026-10-23, so the
layout won't move when they land):

- **Policy:** `POL` becomes `new`; `GEN → AX` turns into `GEN → POL → AX` (the old direct edge goes
  `~~~`). Policy runs in `answer()` on every published message (streamed and non-streamed path),
  before `toA2aParts`.
- **Transport swap:** `server.ts` unwraps A2A, so `BR -.-> AC` is relabelled from
  "SSE data: { parts, contextId }" to plain A2UI messages + session id, and `AC` loses its A2A
  field names. No node changes; this is the frame that shows only the adapter moved.
