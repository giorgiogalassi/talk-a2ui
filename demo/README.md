# A2UI demo — AngularDay 2026

Demo for the talk *Your AI Should Not Generate HTML*. Plan and decisions: `../IMPLEMENTATION-PLAN.md`.

```
apps/client      Angular 22 app (SSR server = the A2A client, POST /a2a), renders A2UI via @a2ui/angular
apps/agent       A2A agent (official Node sample pattern: @google/genai + @a2ui/agent), A2UI v0.9
packages/catalog (next) the shared component catalog
```

The browser never speaks A2A: the client will call the app's own server, which is the A2A client
(decided 2026-10-22, same shape as the official Angular sample).

## Status

**Step 1, render without an agent — done (2026-10-22).** The client renders a hardcoded A2UI v0.9
message (`apps/client/src/app/booking-form.json`, copied from the official Node agent sample) with the
basic catalog. Checked in a browser: typing into fields sends nothing; *Submit Reservation* fires one
`submit_booking` action whose `context` carries the typed values. Actions are logged to the console.

**Step 2, the full chain in stub mode — done (2026-10-22).** Browser → `POST /a2a` (the client's
own server) → A2A `message/stream` → agent → A2UI messages back as SSE → renderer. Checked in a
browser: prompt → restaurant list → *Book Now* → booking form → *Submit* → confirmation.
- Gotcha found: the agent reads a UI action only inside a v0.9 envelope, `{ version: 'v0.9', action }`.
  The bare action (and the official Angular sample's legacy `userAction`) is ignored and the agent
  answers as if it were a new query. The bridge wraps it (`apps/client/src/server.ts`).
- Angular 22 SSR rejects unlisted hosts: `localhost` is in `angular.json` → `security.allowedHosts`.

**Next:** live model (`GEMINI_API_KEY`), then the ticket domain and the custom catalog.

## Versions

- Angular **22.2.3**. `@a2ui/angular@0.13.0` declares `@angular/*@^21.2.5` as peers, so the root
  `package.json` overrides them to `^22.2.3`. Builds and renders with no console errors. Drop the
  override once the package lists Angular 22.
- `@a2ui/web_core@0.14.0`, `@a2ui/markdown-it@0.2.2`, `@a2ui/agent@0.0.1` (pinned: the repo's
  `main` already broke its API two days after release).
- `@a2a-js/sdk@^0.3.13` on both sides (A2A v0.3), like the official samples (decided 2026-10-22).

## Run

```bash
npm install
npm run build -w agent && npm run start:stub -w agent     # terminal 1, :10002
npm run start:client                                       # terminal 2, http://localhost:4200
```
