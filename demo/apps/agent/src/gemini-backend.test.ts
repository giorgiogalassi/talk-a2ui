// Demo: GeminiBackend's failure paths with a stand-in Gemini client: a failed turn drops its
// chat, a call that hangs times out, the tool loop is capped, and an unknown tool gets no data.

import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import type {Chat, GoogleGenAI} from '@google/genai';

import {GeminiBackend, type TurnInput} from './model.js';
import {V0_9} from './versions.js';

type Step = 'tool' | 'text' | 'throw' | 'hang' | {tool: string};

/** A fake client: each chat answers its calls with the next step of `script`. */
function fakeClient(script: Step[]) {
  let created = 0;
  const sent: unknown[] = [];
  const client = {
    chats: {
      create: () => {
        created++;
        return {
          sendMessageStream: async ({message, config}: {message: unknown; config?: {abortSignal?: AbortSignal}}) => {
            sent.push(message);
            const step = script.shift() ?? 'text';
            return (async function* () {
              if (step === 'throw') throw new Error('503 Service Unavailable');
              if (step === 'hang') {
                await new Promise((_, reject) =>
                  config?.abortSignal?.addEventListener('abort', () => reject(new Error('aborted'))),
                );
              }
              if (step === 'text') {
                yield {text: '<a2ui-json>[]</a2ui-json>', functionCalls: undefined};
                return;
              }
              const name = typeof step === 'object' ? step.tool : 'get_tickets';
              yield {text: undefined, functionCalls: [{name, args: {}}]};
            })();
          },
        } as unknown as Chat;
      },
    },
  } as unknown as Pick<GoogleGenAI, 'chats'>;
  return {client, created: () => created, sent};
}

const input: TurnInput = {contextId: 'ctx', query: 'Show me the open tickets', profile: V0_9, systemPrompt: 'sys'};

async function drain(backend: GeminiBackend): Promise<string> {
  let text = '';
  for await (const chunk of backend.streamTurn(input)) text += chunk;
  return text;
}

function backend(client: Pick<GoogleGenAI, 'chats'>, callTimeoutMs = 1000) {
  return new GeminiBackend({apiKey: 'test', modelName: 'm', assetsDir: undefined as unknown as string, callTimeoutMs, client});
}

describe('GeminiBackend', () => {
  it('keeps the chat after a turn that finishes', async () => {
    const fake = fakeClient(['tool', 'text', 'text']);
    const b = new GeminiBackend({apiKey: 't', modelName: 'm', assetsDir: process.cwd() + '/assets', client: fake.client});
    await drain(b);
    await drain(b);
    assert.equal(fake.created(), 1);
  });

  it('drops the chat when a call fails after a tool call, so the next attempt starts clean', async () => {
    const fake = fakeClient(['tool', 'throw', 'text']);
    const b = new GeminiBackend({apiKey: 't', modelName: 'm', assetsDir: process.cwd() + '/assets', client: fake.client});
    await assert.rejects(drain(b), /503/);
    await drain(b);
    assert.equal(fake.created(), 2);
  });

  it('drops the chat when the reader stops halfway', async () => {
    const fake = fakeClient(['text', 'text']);
    const b = new GeminiBackend({apiKey: 't', modelName: 'm', assetsDir: process.cwd() + '/assets', client: fake.client});
    for await (const _ of b.streamTurn(input)) break;
    await drain(b);
    assert.equal(fake.created(), 2);
  });

  it('times out a call that never answers', async () => {
    const fake = fakeClient(['hang']);
    await assert.rejects(drain(backend(fake.client, 50)), /timed out after 50 ms/);
    assert.equal(fake.created(), 1);
  });

  it('stops a model that keeps asking for tools', async () => {
    const fake = fakeClient(['tool', 'tool', 'tool', 'tool', 'tool']);
    const b = new GeminiBackend({apiKey: 't', modelName: 'm', assetsDir: process.cwd() + '/assets', client: fake.client});
    await assert.rejects(drain(b), /asked for tools 3 times/);
    assert.equal(fake.sent.length, 4);
  });

  it('answers an unknown tool with an error, not ticket data', async () => {
    const fake = fakeClient([{tool: 'drop_tables'}, 'text']);
    const b = new GeminiBackend({apiKey: 't', modelName: 'm', assetsDir: process.cwd() + '/assets', client: fake.client});
    await drain(b);
    const answer = JSON.stringify(fake.sent[1]);
    assert.match(answer, /Unknown tool \\"drop_tables\\"/);
    assert.doesNotMatch(answer, /internal_notes/);
  });
});
