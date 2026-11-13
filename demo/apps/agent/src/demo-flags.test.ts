// Demo: the stage switches (src/demo-flags.ts).
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {DemoFlagStore, flagsFromEnv, SwitchableBackend} from './demo-flags.js';
import type {ModelBackend, StubBackend, TurnInput} from './model.js';

const off = {stub: true, invalidFirst: false, leaky: false, thinkingLevel: 'MINIMAL' as const};

/** A backend that yields its own name, so a test can see which one served the turn. */
function named(name: string): ModelBackend {
  return {
    async *streamTurn() {
      yield name;
    },
  };
}

async function served(backend: ModelBackend): Promise<string> {
  let text = '';
  for await (const chunk of backend.streamTurn({} as TurnInput)) text += chunk;
  return text;
}

describe('flagsFromEnv', () => {
  it('reads the same variables as before, with MINIMAL thinking by default', () => {
    assert.deepEqual(flagsFromEnv({STUB_INVALID_FIRST: 'true'}, true), {
      stub: true,
      invalidFirst: true,
      leaky: false,
      thinkingLevel: 'MINIMAL',
    });
    assert.equal(flagsFromEnv({GEMINI_THINKING_LEVEL: 'high'}, false).thinkingLevel, 'HIGH');
  });

  it('rejects an unknown thinking level at startup', () => {
    assert.throws(() => flagsFromEnv({GEMINI_THINKING_LEVEL: 'MAX'}, false));
  });
});

describe('DemoFlagStore', () => {
  it('applies a partial update and keeps the rest', () => {
    const store = new DemoFlagStore(off, true, 'm');
    const state = store.update({leaky: true, thinkingLevel: 'LOW'});
    assert.deepEqual(state, {...off, leaky: true, thinkingLevel: 'LOW', liveAvailable: true, model: 'm'});
  });

  it('rejects unknown keys and bad values without changing anything', () => {
    const store = new DemoFlagStore(off, true, 'm');
    assert.throws(() => store.update({stub: 'yes'}), /true or false/);
    assert.throws(() => store.update({leaky: true, nope: 1}), /Unknown flag/);
    assert.throws(() => store.update({thinkingLevel: 'MAX'}), /thinkingLevel/);
    assert.throws(() => store.update([]), /JSON object/);
    assert.equal(store.get().leaky, false);
  });

  it('refuses live mode without an API key', () => {
    const store = new DemoFlagStore(off, false, 'm');
    assert.throws(() => store.update({stub: false}), /GEMINI_API_KEY/);
    assert.equal(store.get().stub, true);
  });
});

describe('SwitchableBackend', () => {
  it('routes each turn by the flags at that moment, one stub per combination', async () => {
    const store = new DemoFlagStore(off, true, 'm');
    const built: string[] = [];
    const backend = new SwitchableBackend(
      store,
      (invalidFirst, leaky) => {
        built.push(`${invalidFirst}:${leaky}`);
        return named(`stub ${invalidFirst}:${leaky}`) as StubBackend;
      },
      named('live'),
    );

    assert.equal(await served(backend), 'stub false:false');
    store.update({leaky: true});
    assert.equal(await served(backend), 'stub false:true');
    store.update({stub: false});
    assert.equal(await served(backend), 'live');
    store.update({stub: true, leaky: false});
    assert.equal(await served(backend), 'stub false:false');
    assert.deepEqual(built, ['false:false', 'false:true']);
  });

  it('serves the stub when there is no live backend', async () => {
    const backend = new SwitchableBackend(
      new DemoFlagStore(off, false, 'm'),
      () => named('stub') as StubBackend,
    );
    assert.equal(await served(backend), 'stub');
  });
});
