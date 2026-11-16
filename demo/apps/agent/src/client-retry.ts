/*
 * Demo: not in the official sample. What the agent does when the renderer reports that it
 * rejected part of a reply (`VALIDATION_FAILED`, A2UI v0.9 client-to-server `error`).
 */

import type {ClientError} from './a2a.js';
import type {A2uiFormat} from './config.js';
import {LruCache} from './lru-cache.js';
import {retryQuery} from './prompt.js';

/** What the agent keeps of a conversation's last turn, to redo it if the renderer rejects it. */
interface LastTurn {
  query: string;
  actionName?: string;
  /** True once the renderer's error has been answered with a retry of this turn. */
  clientRetried: boolean;
}

/** A retry of the last turn, or the reason there is none. */
export type ClientRetryPlan =
  | {retry: true; query: string; actionName?: string; retryQuery: string}
  | {retry: false; reason: string};

/** The error in one line, for the agent's log and the retry query. */
export function describeClientError({code, surfaceId, path, message}: ClientError): string {
  return `${code} on surface '${surfaceId}'${path ? ` at ${path}` : ''}: ${message}`;
}

/**
 * One client-triggered retry per turn. Each user turn (a prompt or a UI action) is
 * remembered per conversation; a `VALIDATION_FAILED` that follows it re-generates that turn
 * once, with the error in the query, as the server-side retry does. A second report about
 * the retried turn gets no retry, so a renderer and a model that keep disagreeing cannot loop.
 */
export class ClientRetries {
  private readonly turns = new LruCache<LastTurn>(1000);

  /** Remembers a user turn, the one a later report would be about. */
  remember(contextId: string, turn: {query: string; actionName?: string}): void {
    this.turns.set(contextId, {...turn, clientRetried: false});
  }

  /** Decides what to do with an error the renderer reported in this conversation. */
  plan(contextId: string, error: ClientError, format: A2uiFormat): ClientRetryPlan {
    if (error.code !== 'VALIDATION_FAILED') {
      return {retry: false, reason: `Client error ${error.code} is not a validation failure.`};
    }
    const last = this.turns.get(contextId);
    if (!last) {
      return {retry: false, reason: 'No earlier turn in this conversation to retry.'};
    }
    if (last.clientRetried) {
      return {retry: false, reason: 'This turn was already retried once after a client report.'};
    }
    this.turns.set(contextId, {...last, clientRetried: true});
    return {
      retry: true,
      query: last.query,
      actionName: last.actionName,
      retryQuery: retryQuery(format, `the renderer reported ${describeClientError(error)}`, last.query),
    };
  }
}
