import { DataBindingSchema, formatZodIssue } from '@a2ui/web_core/v0_9';

/** The part of a Zod schema this check uses (Zod 3, as in @demo/catalog). */
interface FieldSchema {
  safeParse(value: unknown): { success: true } | { success: false; error: { issues: Parameters<typeof formatZodIssue>[0][] } };
}

/**
 * Demo: checks the value a bound prop resolved to against the catalog's own schema for that prop.
 *
 * web_core validates a component when it arrives, so `priority: {path: 'priority'}` passes: the
 * schema allows a binding. What the binding resolves to is read from the data model only here,
 * at render time, and nothing in web_core 0.14.0 checks it (nor in the agent, which runs the same
 * validation). A literal prop needs no check: web_core already validated it.
 *
 * @returns null when the value is fine, not a binding, or not there yet; otherwise the absolute
 *   data-model path the value came from and why it was refused.
 */
export function resolvedValueProblem(
  api: { name: string; schema: unknown },
  key: string,
  raw: unknown,
  value: unknown,
  dataContextPath: string,
): { path: string; message: string } | null {
  if (!raw || typeof raw !== 'object' || typeof (raw as { path?: unknown }).path !== 'string') return null;
  if (value === undefined) return null;
  const field = (api.schema as { shape: Record<string, FieldSchema | undefined> }).shape?.[key];
  if (!field) return null;
  if (field.safeParse(value).success) return null;
  // Demo: the value is already resolved, so the binding branch of a `value | binding` union
  // only adds noise ("root: Expected object, received string"). Report the value branch alone.
  const result = valueBranch(field).safeParse(value);
  if (result.success) return null;
  const path = absolutePath((raw as { path: string }).path, dataContextPath);
  const why = result.error.issues.map(formatZodIssue).join('; ');
  return {
    path,
    message: `${key} resolved to ${JSON.stringify(value)} from ${path}, which the ${api.name} schema does not allow (${why})`,
  };
}

/** A binding's path, made absolute against the component's data context (a template row). */
export function absolutePath(path: string, dataContextPath: string): string {
  if (path.startsWith('/')) return path;
  return `${dataContextPath.replace(/\/$/, '')}/${path}`;
}

/** A `z.union([valueSchema, DataBindingSchema])` without its binding option; any other schema as it is. */
function valueBranch(field: FieldSchema): FieldSchema {
  const options = (field as { _def?: { options?: FieldSchema[] } })._def?.options;
  const values = options?.filter((option) => option !== (DataBindingSchema as unknown));
  return values?.length === 1 ? values[0] : field;
}
