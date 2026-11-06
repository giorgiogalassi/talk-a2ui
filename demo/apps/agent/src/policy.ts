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

/** The ids a component holds as children: `child`, a `children` list, or a template's id. */
function childIds(component: Json): string[] {
  const ids: string[] = [];
  if (typeof component.child === 'string') ids.push(component.child);
  const children = component.children;
  if (Array.isArray(children)) {
    ids.push(...children.filter((c): c is string => typeof c === 'string'));
  } else if (isObject(children) && typeof children.componentId === 'string') {
    ids.push(children.componentId);
  }
  return ids;
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
 * - a parent that lists it in `children` keeps its other children;
 * - a parent that holds it as its only `child` (`Card`, `Button`: required) is removed as well,
 *   since it cannot stay valid without it;
 * - a template whose `componentId` is removed becomes an empty `children` list.
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
      if (!removed.has(id) && typeof c.child === 'string' && removed.has(c.child)) {
        removed.add(id);
        changed = true;
        stripped.push(`removed ${describe(c)} (its only child ${c.child} was removed)`);
      }
    }
  }

  const kept = components
    .filter(c => !removed.has(String(c.id)))
    .map(c => {
      if (Array.isArray(c.children)) {
        return {...c, children: c.children.filter(id => !removed.has(id as string))};
      }
      if (isObject(c.children) && removed.has(c.children.componentId as string)) {
        return {...c, children: []};
      }
      return c;
    });
  if (kept.length === 0) return undefined;
  return {...message, updateComponents: {...body, components: kept}};
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
