import { Injectable } from '@angular/core';

/** Demo: one thing the renderer could not show, as the v0.9 `VALIDATION_FAILED` error names it. */
export interface ValidationIssue {
  surfaceId: string;
  /** JSON pointer to the field that failed: into the message, or into the data model. */
  path: string;
  message: string;
}

/**
 * Demo: what the renderer rejected in the current reply. Whoever finds a problem (AgentClient
 * when web_core rejects a component, a catalog component when a bound value resolves to
 * something its schema forbids) files it under its own key and withdraws it once fixed;
 * AgentClient reports what is left when the reply has finished rendering.
 */
@Injectable({ providedIn: 'root' })
export class ValidationIssues {
  private readonly byKey = new Map<string, ValidationIssue>();

  /** Files the issue under `key`, or withdraws it when `issue` is null. */
  set(key: string, issue: ValidationIssue | null): void {
    if (issue) this.byKey.set(key, issue);
    else this.byKey.delete(key);
  }

  /** The open issues, oldest first. */
  list(): ValidationIssue[] {
    return [...this.byKey.values()];
  }

  clear(): void {
    this.byKey.clear();
  }
}
