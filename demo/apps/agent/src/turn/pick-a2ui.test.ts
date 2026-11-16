// Demo: capability negotiation (stage 1), as the client's server.ts sends it.

import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import type {Message} from '@a2a-js/sdk';

import {pickA2ui} from './pick-a2ui.js';
import {V0_9} from './versions.js';

const message = (metadata?: Record<string, unknown>): Message =>
  ({kind: 'message', messageId: 'm', role: 'user', parts: [], ...(metadata && {metadata})}) as Message;

describe('pickA2ui', () => {
  it('reads the catalog ids the renderer lists for v0.9', () => {
    const picked = pickA2ui(message({a2uiClientCapabilities: {'v0.9': {supportedCatalogIds: ['tickets', 'basic']}}}));
    assert.equal(picked.profile, V0_9);
    assert.deepEqual(picked.catalogIds, ['tickets', 'basic']);
  });

  it('answers a message without capabilities with v0.9 and the basic catalog', () => {
    assert.deepEqual(pickA2ui(message()).catalogIds, [V0_9.basicCatalogId]);
  });

  it('refuses capabilities that name only another version, or malformed ones', () => {
    assert.throws(() => pickA2ui(message({a2uiClientCapabilities: {'v1.0': {supportedCatalogIds: ['x']}}})), /lists A2UI capabilities for v1\.0/);
    assert.throws(() => pickA2ui(message({a2uiClientCapabilities: {'v0.9': {supportedCatalogIds: [1]}}})), /needs valid v0\.9/);
  });
});
