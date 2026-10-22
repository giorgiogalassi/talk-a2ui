# A2UI demo — AngularDay 2026

Demo for the talk *Your AI Should Not Generate HTML*. Plan and decisions: `../IMPLEMENTATION-PLAN.md`.

```
apps/client      Angular 22 app, renders A2UI through @a2ui/angular
apps/agent       (next) A2A agent that answers with A2UI messages
packages/catalog (next) the shared component catalog
```

The browser never speaks A2A: the client will call the app's own server, which is the A2A client
(decided 2026-10-22, same shape as the official Angular sample).

## Status

**Step 1, render without an agent — done (2026-10-22).** The client renders a hardcoded A2UI v0.9
message (`apps/client/src/app/booking-form.json`, copied from the official Node agent sample) with the
basic catalog. Checked in a browser: typing into fields sends nothing; *Submit Reservation* fires one
`submit_booking` action whose `context` carries the typed values. Actions are logged to the console.

## Versions

- Angular **22.2.3**. `@a2ui/angular@0.13.0` declares `@angular/*@^21.2.5` as peers, so the root
  `package.json` overrides them to `^22.2.3`. Builds and renders with no console errors. Drop the
  override once the package lists Angular 22.
- `@a2ui/web_core@0.14.0`, `@a2ui/markdown-it@0.2.2`.

## Run

```bash
npm install
npm run start:client     # http://localhost:4200
```
