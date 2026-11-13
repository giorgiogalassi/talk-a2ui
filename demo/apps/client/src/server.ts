import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { A2AClient } from '@a2a-js/sdk/client';
import { MessageSendParams, Part } from '@a2a-js/sdk';
import { TICKET_CATALOG_ID } from '@demo/catalog';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * The bridge to the agent. The browser never speaks A2A: it POSTs its prompt or a UI action
 * here, this server sends it to the agent as an A2A message, unwraps the A2UI messages from
 * the A2A parts, and streams plain A2UI messages back as server-sent events. Adapted from the
 * official A2UI Angular sample (Apache-2.0).
 *
 * Demo: this is the only A2A-aware file. Swapping the transport (AG-UI, say) means rewriting
 * this bridge; the browser, the renderer and the catalog stay as they are.
 */
const AGENT_URL = process.env['AGENT_URL'] ?? 'http://localhost:10002';
const A2UI_EXTENSION = 'https://a2ui.org/a2a-extension/a2ui/v0.9';

// The catalogs the agent may compose from: the ticket catalog, by the id packages/catalog
// defines and the renderer registers (app.config.ts). Capability negotiation: the agent's
// pick-a2ui.ts reads this list and builds its prompt and validation from these catalogs only.
const A2UI_CLIENT_CAPABILITIES = {
  'v0.9': {
    supportedCatalogIds: [TICKET_CATALOG_ID],
  },
};

/** The A2UI messages in A2A parts: each data part holds one (or, in A2A v1.0, a list of them). */
function a2uiMessages(parts: Part[]): unknown[] {
  return parts.flatMap((part) =>
    part.kind === 'data' && part.data ? (Array.isArray(part.data) ? part.data : [part.data]) : [],
  );
}

let agent: Promise<A2AClient> | undefined;
function getAgent(): Promise<A2AClient> {
  agent ??= A2AClient.fromCardUrl(`${AGENT_URL}/.well-known/agent-card.json`, {
    fetchImpl: (url, init) => {
      const headers = new Headers(init?.headers);
      headers.set('X-A2A-Extensions', A2UI_EXTENSION);
      return fetch(url, { ...init, headers });
    },
  }).catch((error: unknown) => {
    // Don't keep a failed lookup: if the agent wasn't up yet, the next request tries again
    // instead of failing until this server restarts.
    agent = undefined;
    throw error;
  });
  return agent;
}

app.post('/a2a', express.json(), async (req, res) => {
  // The browser's session id is A2A's contextId: the one place the two names meet.
  const { query, event, sessionId: contextId } = req.body as {
    query?: string;
    event?: Record<string, unknown>;
    sessionId?: string;
  };
  // A UI action travels as an A2UI client-to-server message: { version, action }.
  const part: Part = event
    ? { kind: 'data', data: { version: 'v0.9', action: event }, metadata: { mimeType: 'application/a2ui+json' } }
    : { kind: 'text', text: query ?? '' };
  const params: MessageSendParams = {
    message: {
      kind: 'message',
      messageId: crypto.randomUUID(),
      role: 'user',
      contextId,
      parts: [part],
      metadata: { a2uiClientCapabilities: A2UI_CLIENT_CAPABILITIES },
    },
  };

  try {
    const stream = (await getAgent()).sendMessageStream(params);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    for await (const evt of stream) {
      const parts =
        evt.kind === 'task' || evt.kind === 'status-update'
          ? (evt.status.message?.parts ?? [])
          : evt.kind === 'artifact-update'
            ? evt.artifact.parts
            : [];
      const messages = a2uiMessages(parts);
      // The session id goes out even with no A2UI in the event (a text-only first reply), or
      // the browser's next turn would open a new conversation.
      if (messages.length > 0 || evt.contextId) {
        res.write(`data: ${JSON.stringify({ messages, sessionId: evt.contextId })}\n\n`);
      }
    }
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[a2a bridge]', message);
    if (!res.headersSent) {
      res.status(502).json({ error: message });
    } else {
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  }
});

/**
 * Demo: the agent's stage switches (agent: src/demo-flags.ts), for the demo panel (Alt+Shift+D).
 * Passed through as they are; changes only from this machine, like on the agent.
 */
app.get('/demo/flags', async (_req, res) => {
  await forwardFlags(res, 'GET');
});
app.put('/demo/flags', express.json(), async (req, res) => {
  const remote = req.socket.remoteAddress ?? '';
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) {
    res.status(403).json({ error: 'Demo flags can only be changed from this machine.' });
    return;
  }
  await forwardFlags(res, 'PUT', req.body);
});

async function forwardFlags(res: express.Response, method: 'GET' | 'PUT', body?: unknown) {
  try {
    const response = await fetch(`${AGENT_URL}/demo/flags`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    res.status(response.status).json(await response.json());
  } catch (error) {
    res.status(502).json({ error: `Agent unreachable: ${error instanceof Error ? error.message : String(error)}` });
  }
}

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
