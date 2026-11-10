// Demo: server-side policy (step 5). Not part of the upstream sample.
//
// The catalog says what a UI may be made of; this says what this deployment lets it show and
// do. A reply can be valid against the catalog and still leak a field the user must not see
// or offer an action they must not take: both are legal components, the problem is the
// combination with this user and this data. So every A2UI message is checked here after
// `@a2ui/agent` has validated it and before it is published (agent.ts, `answer()`).
//
// Per message and stateless: in Direct JSON mode the stream re-sends a message whole each time
// it grows, so each re-send is checked on its own, and a forbidden field that shows up in an
// intermediate re-send is stripped from that re-send too.

import type {ResponsePart} from '@a2ui/agent';
import {basicCatalog} from '@a2ui/web_core/v0_9/basic_catalog';
import {getComponentReferences, type ComponentRefMap} from '@a2ui/web_core/validating';
import {ticketCatalog} from '@demo/catalog';

/**
 * Which props of each component hold other components' ids, read from the catalogs' own Zod
 * schemas by web_core (the same map its integrity checker uses): `child`, `children`, but
 * also `Modal.trigger`/`content` and `Tabs.tabs[].child`. Both catalogs the agent serves.
 */
const REF_MAP: ComponentRefMap = {...basicCatalog.componentRefMap, ...ticketCatalog.componentRefMap};

/** What a removed root is replaced with, so the surface still renders and says why. */
export const UNAVAILABLE_TEXT = "This view isn't available to you.";

/** What this deployment forbids, whatever the catalog allows. */
export interface Policy {
  /**
   * Data model paths that never reach the browser. JSON-pointer-like, `*` matches one
   * segment (an array index or a key).
   */
  forbiddenDataPaths: string[];
  /** Action names whose components are removed. */
  disabledActions: string[];
}

/**
 * The demo's one policy: support agents never see a ticket's internal notes and cannot delete
 * tickets. `/ticket/internal_notes` is the detail view's data (examples/v0.9/ticket_detail.json
 * binds `/ticket/...`), which `/tickets/*\/internal_notes` alone does not cover.
 */
export const DEMO_POLICY: Policy = {
  forbiddenDataPaths: ['/tickets/*/internal_notes', '/ticket/internal_notes'],
  disabledActions: ['delete_ticket'],
};

/** The messages after the policy, and one line per thing it stripped. */
export interface PolicyResult {
  messages: unknown[];
  stripped: string[];
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `/a/b` → `['a', 'b']`; `/` and `` → `[]`; a relative `a/b` → `['a', 'b']`. */
function segments(path: string): string[] {
  return path.split('/').filter(s => s !== '');
}

/** Whether the pattern's first segments match the path's first segments, as far as both go. */
function prefixMatches(pattern: string[], path: string[]): boolean {
  const n = Math.min(pattern.length, path.length);
  for (let i = 0; i < n; i++) {
    if (pattern[i] !== '*' && pattern[i] !== path[i]) return false;
  }
  return true;
}

/** Whether a path is a forbidden path or lies inside one. */
function isForbidden(path: string[], patterns: string[][]): boolean {
  return patterns.some(p => path.length >= p.length && prefixMatches(p, path));
}

/**
 * Whether a data binding's path may resolve to a forbidden path. A relative path (inside a
 * list template) is resolved against a scope this function does not know, so it is treated as
 * forbidden if it could be: `internal_notes` matches the end of `/tickets/*\/internal_notes`.
 * Over-blocking a binding costs a component; under-blocking costs the leak.
 */
function bindsForbidden(path: string, patterns: string[][]): boolean {
  const segs = segments(path);
  if (path.startsWith('/')) return isForbidden(segs, patterns);
  return patterns.some(p => {
    for (let k = 0; k < p.length; k++) {
      const rest = p.slice(k);
      if (segs.length >= rest.length && prefixMatches(rest, segs)) return true;
    }
    return false;
  });
}

/** The first `{path}` in a component's props that binds a forbidden path, if any. */
function forbiddenBinding(value: unknown, patterns: string[][]): string | undefined {
  // A string can bind data too, by interpolation: "Notes: ${/ticket/internal_notes}", also
  // inside a function call's args. Every path-like token in each `${…}` is checked.
  if (typeof value === 'string') {
    for (const [, expr] of value.matchAll(/\$\{([^}]*)\}/g)) {
      for (const [token] of expr.matchAll(/\/?[A-Za-z_*][\w*-]*(?:\/[\w*-]+)*/g)) {
        if (bindsForbidden(token, patterns)) return token;
      }
    }
    return undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = forbiddenBinding(item, patterns);
      if (hit) return hit;
    }
    return undefined;
  }
  if (!isObject(value)) return undefined;
  if (typeof value.path === 'string' && bindsForbidden(value.path, patterns)) return value.path;
  for (const [key, item] of Object.entries(value)) {
    if (key === 'path') continue;
    const hit = forbiddenBinding(item, patterns);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Deletes what `pattern` names inside `value`, which sits at `base` in the data model, and
 * reports each deleted path.
 */
function stripValue(value: unknown, pattern: string[], base: string[], stripped: string[]): void {
  if (pattern.length === 0) return;
  const [head, ...rest] = pattern;
  const keys = Array.isArray(value)
    ? value.map((_, i) => String(i))
    : isObject(value)
      ? Object.keys(value)
      : [];
  for (const key of keys) {
    if (head !== '*' && head !== key) continue;
    const container = value as Json;
    if (rest.length === 0) {
      if (Array.isArray(value)) continue; // Never splice a list: indexes would shift.
      delete container[key];
      stripped.push(`stripped /${[...base, key].join('/')}`);
    } else {
      stripValue(container[key], rest, [...base, key], stripped);
    }
  }
}

/** An `updateDataModel` with forbidden data removed from its value, or undefined to drop it. */
function policeDataModel(message: Json, patterns: string[][], stripped: string[]): Json | undefined {
  const body = message.updateDataModel as Json;
  const path = typeof body.path === 'string' ? body.path : '/';
  const at = segments(path);
  // The message writes to a forbidden path itself: drop it whole. (Turning it into a write
  // without `value` would delete the key in the client, which is still a message about it.)
  if (isForbidden(at, patterns)) {
    stripped.push(`dropped updateDataModel at ${path}`);
    return undefined;
  }
  if (!('value' in body)) return message;
  for (const pattern of patterns) {
    if (pattern.length > at.length && prefixMatches(pattern, at)) {
      stripValue(body.value, pattern.slice(at.length), at, stripped);
    }
  }
  return message;
}

/** Every component reference a component holds, as `[id, propertyPath]` (web_core's paths). */
function refs(component: Json): [string, string][] {
  return [...getComponentReferences(component, REF_MAP)];
}

/** The ids a component holds as children, whatever prop they sit in. */
function childIds(component: Json): string[] {
  return refs(component).map(([id]) => id);
}

/**
 * How a kept component loses a reference to a removed one, from web_core's property path:
 * `children[2]` → drop that list entry; `children.componentId` (a template) → empty list;
 * `tabs[1].child` → drop that tab; anything else (`child`, `trigger`, `content`) is a
 * required single reference, so the component cannot stay valid and goes too.
 */
type Mend =
  | {kind: 'listItem'; key: string}
  | {kind: 'template'; key: string}
  | {kind: 'nestedItem'; key: string; index: number}
  | {kind: 'required'};

function mendFor(path: string): Mend {
  let m = /^(\w+)\[\d+\]$/.exec(path);
  if (m) return {kind: 'listItem', key: m[1]};
  m = /^(\w+)\.componentId$/.exec(path);
  if (m) return {kind: 'template', key: m[1]};
  m = /^(\w+)\[(\d+)\]\.\w+$/.exec(path);
  if (m) return {kind: 'nestedItem', key: m[1], index: Number(m[2])};
  return {kind: 'required'};
}

function describe(component: Json): string {
  return `${String(component.component)} ${String(component.id)}`;
}

/**
 * An `updateComponents` with every component that binds forbidden data or carries a disabled
 * action removed, and the tree mended so it stays valid against the catalog:
 *
 * - the removed component's own subtree goes too (a button's label), unless something kept
 *   still points at it;
 * - references are found with web_core's `getComponentReferences`, so every reference prop
 *   the catalogs declare counts, not just `child`/`children` (`Modal.trigger`, `Tabs.tabs[]`);
 * - a parent that lists it in `children` keeps its other children;
 * - a parent that holds it in a required single reference (`Card.child`, `Button.child`,
 *   `Modal.trigger`/`content`) is removed as well, since it cannot stay valid without it;
 * - a tab whose `child` is removed is dropped from `tabs`; a `Tabs` left with none goes too;
 * - a template whose `componentId` is removed becomes an empty `children` list;
 * - if `root` itself goes, a Text notice takes its place, so the surface renders and says why.
 *
 * Ids are followed even when the component they name has not arrived yet, so a label streamed
 * after its button is removed on every re-send. Returns undefined if no component is left.
 */
function policeComponents(
  message: Json,
  patterns: string[][],
  disabledActions: Set<string>,
  stripped: string[],
): Json | undefined {
  const body = message.updateComponents as Json;
  const components = (Array.isArray(body.components) ? body.components : []).filter(isObject);
  const byId = new Map(components.map(c => [String(c.id), c]));
  const removed = new Set<string>();

  for (const c of components) {
    const event = isObject(c.action) && isObject(c.action.event) ? c.action.event : undefined;
    const name = typeof event?.name === 'string' ? event.name : undefined;
    if (name && disabledActions.has(name)) {
      removed.add(String(c.id));
      stripped.push(`removed ${describe(c)} (action ${name})`);
      continue;
    }
    const binding = forbiddenBinding(c, patterns);
    if (binding) {
      removed.add(String(c.id));
      stripped.push(`removed ${describe(c)} (binds ${binding})`);
    }
  }
  if (removed.size === 0) return message;

  // Grow `removed` to a fixed point: subtrees down, required single children up.
  for (let changed = true; changed; ) {
    changed = false;
    const keptRefs = new Set(
      components.filter(c => !removed.has(String(c.id))).flatMap(childIds),
    );
    for (const id of [...removed]) {
      const c = byId.get(id);
      for (const child of c ? childIds(c) : []) {
        if (!removed.has(child) && !keptRefs.has(child)) {
          removed.add(child);
          changed = true;
          const found = byId.get(child);
          if (found) stripped.push(`removed ${describe(found)} (inside ${id})`);
        }
      }
    }
    for (const c of components) {
      const id = String(c.id);
      if (removed.has(id)) continue;
      const lost = refs(c).filter(([ref]) => removed.has(ref));
      const required = lost.find(([, path]) => mendFor(path).kind === 'required');
      // A tab list left with no tab is as invalid as a missing required child.
      const emptied = lost.length > 0 && nestedListEmptied(c, lost);
      if (required || emptied) {
        removed.add(id);
        changed = true;
        const why = required ? `its ${required[1]} ${required[0]} was removed` : 'every item it held was removed';
        stripped.push(`removed ${describe(c)} (${why})`);
      }
    }
  }

  let kept = components.filter(c => !removed.has(String(c.id))).map(c => mendRefs(c, removed));
  // The root went (its only content was forbidden): put a Text in its place, so the surface
  // still renders and says why, instead of dropping the message and leaving it blank. Same
  // replacement on every re-send, so the policy stays stateless.
  if (removed.has('root') && byId.has('root')) {
    kept = [{id: 'root', component: 'Text', text: UNAVAILABLE_TEXT}, ...kept];
    stripped.push('replaced root with a notice');
  }
  if (kept.length === 0) return undefined;
  return {...message, updateComponents: {...body, components: kept}};
}

/** Whether removing the lost references empties a nested list (`tabs`) of the component. */
function nestedListEmptied(component: Json, lost: [string, string][]): boolean {
  const byKey = new Map<string, Set<number>>();
  for (const [, path] of lost) {
    const mend = mendFor(path);
    if (mend.kind === 'nestedItem') {
      byKey.set(mend.key, (byKey.get(mend.key) ?? new Set()).add(mend.index));
    }
  }
  for (const [key, indexes] of byKey) {
    const list = component[key];
    if (Array.isArray(list) && list.every((_, i) => indexes.has(i))) return true;
  }
  return false;
}

/** A kept component with its references to removed components taken out. */
function mendRefs(component: Json, removed: Set<string>): Json {
  const lost = refs(component).filter(([ref]) => removed.has(ref));
  if (lost.length === 0) return component;
  const out: Json = {...component};
  const dropNested = new Map<string, Set<number>>();
  for (const [, path] of lost) {
    const mend = mendFor(path);
    if (mend.kind === 'listItem' && Array.isArray(out[mend.key])) {
      out[mend.key] = (out[mend.key] as unknown[]).filter(id => !removed.has(id as string));
    } else if (mend.kind === 'template') {
      out[mend.key] = [];
    } else if (mend.kind === 'nestedItem') {
      dropNested.set(mend.key, (dropNested.get(mend.key) ?? new Set()).add(mend.index));
    }
  }
  for (const [key, indexes] of dropNested) {
    if (Array.isArray(out[key])) out[key] = (out[key] as unknown[]).filter((_, i) => !indexes.has(i));
  }
  return out;
}

/**
 * Applies the policy to A2UI messages. Pure: the input is not modified (the stream that
 * produced it keeps its own copy), and each message is checked on its own.
 *
 * - `updateDataModel`: forbidden paths are deleted from its value; a message whose own path is
 *   forbidden is dropped.
 * - `updateComponents`: components binding a forbidden path, or carrying a disabled action,
 *   are removed and the tree mended (see `policeComponents`); dropped if nothing is left.
 * - Anything else passes unchanged.
 */
export function applyPolicy(messages: readonly unknown[], policy: Policy): PolicyResult {
  const patterns = policy.forbiddenDataPaths.map(segments);
  const disabled = new Set(policy.disabledActions);
  const stripped: string[] = [];
  const out: unknown[] = [];
  for (const original of messages) {
    if (!isObject(original)) {
      out.push(original);
      continue;
    }
    let message: Json | undefined = original;
    if (isObject(original.updateDataModel)) {
      message = policeDataModel(structuredClone(original), patterns, stripped);
    } else if (isObject(original.updateComponents)) {
      message = policeComponents(original, patterns, disabled, stripped);
    }
    if (message) out.push(message);
  }
  return {messages: out, stripped};
}

/**
 * Applies the policy to the A2UI in parsed response parts, as `answer()` gets them, and logs
 * one line per strip. Text parts pass unchanged; a part left with no message is dropped.
 */
export function enforcePolicy(parts: ResponsePart[], policy: Policy = DEMO_POLICY): ResponsePart[] {
  return parts.flatMap((part): ResponsePart[] => {
    if (part.type !== 'a2ui') return [part];
    const {messages, stripped} = applyPolicy(part.a2ui, policy);
    for (const line of stripped) console.log(`--- policy: ${line} ---`);
    return messages.length > 0 ? [{...part, a2ui: messages as typeof part.a2ui}] : [];
  });
}
