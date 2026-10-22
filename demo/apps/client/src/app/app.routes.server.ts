import { RenderMode, ServerRoute } from '@angular/ssr';

// The A2UI surfaces only exist in the browser, so the page renders client-side.
// The server is here for POST /a2a, the bridge to the agent (src/server.ts).
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
