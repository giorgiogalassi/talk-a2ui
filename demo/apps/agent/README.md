# Demo agent

A2A agent that answers with A2UI v0.9 messages. **Adapted from the official A2UI Node sample**
`samples/agent/node/restaurant_finder` (a2ui-project/a2ui, Apache-2.0; license headers kept in each
file), at the state that matches the published `@a2ui/agent@0.0.1`:

- `src/agent.ts` comes from commit `9d2ec29ca1` (2026-10-19, the 0.0.1 release). Later commits on
  `main` (2026-10-21) use APIs that 0.0.1 doesn't have (`processor.parser`, `openStream`).
- Every other `src/` file is from `main` @ `3a64be7` (2026-10-22); none differ from `9d2ec29ca1`.
- Changes for the demo: only v0.9 is served (`src/versions.ts`); the basic catalog and the
  restaurant data are vendored into `catalogs/` and `assets/` (`src/tools.ts`); images are not
  vendored (19 MB). The restaurant domain is temporary: the ticket dashboard replaces it.

```bash
npm run build -w agent
npm run start:stub -w agent     # canned responses, no model
npm run start -w agent          # live: needs GEMINI_API_KEY in apps/agent/.env (gitignored)
```

Agent card: http://localhost:10002/.well-known/agent-card.json · JSON-RPC: http://localhost:10002/a2a/json-rpc
