# Demo agent

A2A agent that answers with A2UI v0.9 messages. **Adapted from the official A2UI Node sample**
`samples/agent/node/restaurant_finder` (a2ui-project/a2ui, Apache-2.0; license headers kept in each
file), at the state that matches the published `@a2ui/agent@0.0.1`:

- `src/turn/agent.ts` comes from commit `9d2ec29ca1` (2026-10-19, the 0.0.1 release). Later commits on
  `main` (2026-10-21) use APIs that 0.0.1 doesn't have (`processor.parser`, `openStream`).
- Every other `src/` file is from `main` @ `3a64be7` (2026-10-22); none differ from `9d2ec29ca1`.
- Changes for the demo: only v0.9 is served (`src/turn/versions.ts`), with `@a2ui/web_core`'s Zod
  `basicCatalog` as the basic catalog instead of the sample's JSON document (incident 2).
  Every change is marked `// Demo:` in the code.
- Step 4 (2026-11-06): the support-ticket domain replaces the restaurant finder. The ticket
  catalog comes from `packages/catalog` (Zod `ComponentApi`s, `src/catalog/catalogs.ts`), the
  `get_tickets` tool reads `data/tickets.json` (`src/model/tools.ts`), and the examples in
  `data/examples/v0.9/` are ticket UIs. The sample's `RestaurantExecutor` is `TicketExecutor` here
  (renamed 2026-11-16); the sample's image route, image base URL and v1.0 profile are removed.

Where things are: `src/turn/` (one message in, one answer out; start with `turn/agent.ts`),
`src/model/` (Gemini and the stub, prompt, `get_tickets`), `src/catalog/`, `src/policy/`,
`src/demo/` (stage switches), `data/` (tickets, prompt examples, stub notice). The full map, with the
client: [`../../README.md#find-your-way`](../../README.md#find-your-way). The sample keeps every file
flat in `src/`; the folders are the demo's, the file names are the sample's, so each one can still be
compared with its original.

```bash
npm run build -w agent
npm run start:stub -w agent     # canned responses, no model
STUB_INVALID_FIRST=true npm run start:stub -w agent   # first attempt fails validation: shows the retry
npm test -w agent               # node:test: catalog, examples, validate-and-retry
npm run start -w agent          # live: needs GEMINI_API_KEY in apps/agent/.env (gitignored)
```

Agent card: http://localhost:10002/.well-known/agent-card.json · JSON-RPC: http://localhost:10002/a2a/json-rpc
