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

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * The bridge to the agent. The browser never speaks A2A: it POSTs its prompt or a UI action
 * here, this server sends it to the agent as an A2A message, and streams the A2UI messages
 * back as server-sent events. Adapted from the official A2UI Angular sample (Apache-2.0).
 */
const AGENT_URL = process.env['AGENT_URL'] ?? 'http://localhost:10002';
const A2UI_EXTENSION = 'https://a2ui.org/a2a-extension/a2ui/v0.9';

// The catalogs this app's renderer registers. The agent may only compose from these.
const A2UI_CLIENT_CAPABILITIES = {
  'v0.9': {
    supportedCatalogIds: ['https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json'],
  },
};

let agent: Promise<A2AClient> | undefined;
function getAgent(): Promise<A2AClient> {
  agent ??= A2AClient.fromCardUrl(`${AGENT_URL}/.well-known/agent-card.json`, {
    fetchImpl: (url, init) => {
      const headers = new Headers(init?.headers);
      headers.set('X-A2A-Extensions', A2UI_EXTENSION);
      return fetch(url, { ...init, headers });
    },
  });
  return agent;
}

app.post('/a2a', express.json(), async (req, res) => {
  const { query, event, contextId } = req.body as {
    query?: string;
    event?: Record<string, unknown>;
    contextId?: string;
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
      if (parts.length > 0) {
        res.write(`data: ${JSON.stringify({ parts, contextId: evt.contextId })}\n\n`);
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
