/**
 * Demo: the agent's stage switches, changeable while it runs (GET/PUT /demo/flags, see
 * index.ts). They start from the same environment variables as before (STUB_LLM,
 * STUB_INVALID_FIRST, STUB_LEAKY, GEMINI_THINKING_LEVEL), so a plain restart behaves as it
 * always did; the client's demo panel (Shift+D) flips them between turns without one.
 */
import {type ModelBackend, StubBackend, type TurnInput, thinkingConfig} from './model.js';

export const THINKING_LEVELS = ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH', 'DEFAULT'] as const;
export type ThinkingLevelSetting = (typeof THINKING_LEVELS)[number];

export interface DemoFlags {
  /** Canned replies instead of the model (STUB_LLM). */
  stub: boolean;
  /** Stub only: each turn's first attempt fails validation, to show the retry (STUB_INVALID_FIRST). */
  invalidFirst: boolean;
  /** Stub only: replies carry internal notes and a Delete button for the policy to strip (STUB_LEAKY). */
  leaky: boolean;
  /** Live only: Gemini's thinking level (GEMINI_THINKING_LEVEL). */
  thinkingLevel: ThinkingLevelSetting;
}

/** What GET /demo/flags returns: the switches, plus what the panel needs to show them. */
export interface DemoFlagsState extends DemoFlags {
  /** False without a GEMINI_API_KEY: the agent can only serve the stub. */
  liveAvailable: boolean;
  model: string;
}

/** The switches as the environment sets them at startup. */
export function flagsFromEnv(env: NodeJS.ProcessEnv, stub: boolean): DemoFlags {
  const level = env.GEMINI_THINKING_LEVEL?.trim().toUpperCase() || 'MINIMAL';
  thinkingConfig(level); // throws on an unknown level, as at startup before
  return {
    stub,
    invalidFirst: env.STUB_INVALID_FIRST === 'true',
    leaky: env.STUB_LEAKY === 'true',
    thinkingLevel: level as ThinkingLevelSetting,
  };
}

/** Holds the current switches. Every turn reads them, so a change applies from the next turn. */
export class DemoFlagStore {
  private flags: DemoFlags;

  constructor(
    initial: DemoFlags,
    private readonly liveAvailable: boolean,
    private readonly model: string,
  ) {
    this.flags = {...initial};
  }

  get(): DemoFlagsState {
    return {...this.flags, liveAvailable: this.liveAvailable, model: this.model};
  }

  /** Applies a partial update. Throws, changing nothing, on an unknown key or a bad value. */
  update(patch: unknown): DemoFlagsState {
    if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
      throw new Error('Expected a JSON object of flags.');
    }
    const next = {...this.flags};
    for (const [key, value] of Object.entries(patch)) {
      switch (key) {
        case 'stub':
        case 'invalidFirst':
        case 'leaky':
          if (typeof value !== 'boolean') throw new Error(`"${key}" must be true or false.`);
          next[key] = value;
          break;
        case 'thinkingLevel':
          if (!THINKING_LEVELS.includes(value as ThinkingLevelSetting)) {
            throw new Error(`"thinkingLevel" must be one of ${THINKING_LEVELS.join(', ')}.`);
          }
          next.thinkingLevel = value as ThinkingLevelSetting;
          break;
        default:
          throw new Error(`Unknown flag "${key}".`);
      }
    }
    if (!next.stub && !this.liveAvailable) {
      throw new Error('Live mode needs GEMINI_API_KEY in apps/agent/.env; restart the agent with it.');
    }
    this.flags = next;
    return this.get();
  }
}

/**
 * Routes each turn to the stub or the model, as the switches stand when the turn starts.
 * One StubBackend per stub-switch combination, built on first use.
 */
export class SwitchableBackend implements ModelBackend {
  private readonly stubs = new Map<string, StubBackend>();

  constructor(
    private readonly flags: DemoFlagStore,
    private readonly makeStub: (invalidFirst: boolean, leaky: boolean) => StubBackend,
    private readonly live?: ModelBackend,
  ) {}

  streamTurn(input: TurnInput): AsyncIterable<string> {
    const {stub, invalidFirst, leaky} = this.flags.get();
    if (!stub && this.live) return this.live.streamTurn(input);
    const key = `${invalidFirst}:${leaky}`;
    let backend = this.stubs.get(key);
    if (!backend) {
      backend = this.makeStub(invalidFirst, leaky);
      this.stubs.set(key, backend);
    }
    return backend.streamTurn(input);
  }
}
