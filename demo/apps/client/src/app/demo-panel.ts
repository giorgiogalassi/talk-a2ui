import { ChangeDetectionStrategy, Component, afterNextRender, signal } from '@angular/core';

/** The agent's stage switches, as GET/PUT /demo/flags carries them (agent: src/demo-flags.ts). */
interface DemoFlagsState {
  stub: boolean;
  invalidFirst: boolean;
  leaky: boolean;
  thinkingLevel: string;
  liveAvailable: boolean;
  model: string;
}

const THINKING_LEVELS = ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH', 'DEFAULT'];

/**
 * Demo: a presenter-only panel for the agent's switches, so stub/live, the invalid first
 * attempt and the leaky replies change between turns without restarting the agent.
 * Hidden by default; Alt+Shift+D (⌥⇧D) shows and hides it. Changes apply from the next turn.
 */
@Component({
  selector: 'app-demo-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    @if (open()) {
      <aside class="panel" aria-label="Demo controls">
        <header>
          <strong>Demo controls</strong>
          <button type="button" class="close" (click)="open.set(false)" aria-label="Close demo controls">×</button>
        </header>

        @if (flags(); as f) {
          <div class="seg" role="radiogroup" aria-label="Model">
            <span class="thumb" [class.right]="f.stub" aria-hidden="true"></span>
            <button type="button" role="radio" [attr.aria-checked]="!f.stub" [class.on]="!f.stub"
              [disabled]="!f.liveAvailable || busy()" (click)="set({ stub: false })"
              [title]="f.liveAvailable ? f.model : 'Needs GEMINI_API_KEY in apps/agent/.env'">Live</button>
            <button type="button" role="radio" [attr.aria-checked]="f.stub" [class.on]="f.stub"
              [disabled]="busy()" (click)="set({ stub: true })">Stub</button>
          </div>
          <p class="hint">{{ f.stub ? 'Canned replies, no model.' : 'Live: ' + f.model }}</p>

          <label class="row" [class.off]="!f.stub">
            <input type="checkbox" [checked]="f.invalidFirst" [disabled]="!f.stub || busy()"
              (change)="set({ invalidFirst: checked($event) }, $event)" />
            <span>First attempt invalid <small>shows the retry (stage 5)</small></span>
          </label>
          <label class="row" [class.off]="!f.stub">
            <input type="checkbox" [checked]="f.leaky" [disabled]="!f.stub || busy()"
              (change)="set({ leaky: checked($event) }, $event)" />
            <span>Leaky replies <small>internal notes + Delete, for the policy (stage 3)</small></span>
          </label>
          <label class="row" [class.off]="f.stub">
            <span>Thinking</span>
            <select [value]="f.thinkingLevel" [disabled]="f.stub || busy()"
              (change)="set({ thinkingLevel: value($event) }, $event)">
              @for (level of levels; track level) {
                <option [value]="level">{{ level }}</option>
              }
            </select>
          </label>
          <p class="hint">Applies from the next prompt or click.</p>
        } @else if (!error()) {
          <p class="hint">Loading…</p>
        }

        @if (error(); as error) {
          <p class="error">{{ error }}</p>
        }
      </aside>
    }
  `,
  styles: `
    .panel {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 10;
      width: 300px;
      padding: 14px 16px 12px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--paper);
      box-shadow: 0 12px 32px rgb(17 17 17 / 0.12);
      font-size: 14px;
      line-height: 1.4;
    }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    header strong { font: 600 16px var(--font-display); letter-spacing: -0.02em; }
    .close { border: 0; background: none; font-size: 20px; line-height: 1; color: var(--muted); cursor: pointer; }
    /* Live / Stub: the blog header's sliding pill (ggalassi.dev .pill-indicator): one highlight
       behind the active option that slides across, 380 ms on the blog's ease-smooth curve. */
    .seg {
      position: relative;
      display: grid;
      grid-template-columns: 1fr 1fr;
      padding: 3px;
      border: 1px solid var(--line);
      border-radius: 999px;
    }
    .thumb {
      position: absolute;
      top: 3px;
      bottom: 3px;
      left: 3px;
      width: calc(50% - 3px);
      border-radius: 999px;
      background: var(--ink);
      transition: transform 380ms cubic-bezier(0.2, 0.75, 0.2, 1);
    }
    .thumb.right { transform: translateX(100%); }
    .seg button {
      position: relative;
      z-index: 1;
      padding: 6px 0;
      border: 0;
      border-radius: 999px;
      background: none;
      font: 500 14px var(--font-body);
      color: var(--muted);
      cursor: pointer;
      transition: color 140ms cubic-bezier(0.2, 0.75, 0.2, 1), background-color 140ms cubic-bezier(0.2, 0.75, 0.2, 1);
    }
    .seg button:hover:not(.on):not(:disabled) { color: var(--ink); background: color-mix(in srgb, var(--ink) 5%, transparent); }
    .seg button.on { color: var(--cream); }
    .seg button:disabled:not(.on) { opacity: 0.6; cursor: not-allowed; }
    @media (prefers-reduced-motion: reduce) { .thumb { transition: none; } }
    .row { display: flex; align-items: flex-start; gap: 10px; margin-top: 12px; cursor: pointer; }
    .row.off { opacity: 0.45; }
    .row input { margin-top: 3px; accent-color: var(--accent-fill); }
    .row small { display: block; color: var(--muted); font-size: 12px; }
    /* Own chevron, 10px in from the right edge (the native arrow sat on the border). */
    .row select {
      margin-left: auto;
      padding: 5px 30px 5px 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      appearance: none;
      background: var(--cream) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%235c5648' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 10px center;
      color: var(--ink);
      font: inherit;
      cursor: pointer;
    }
    .row select:disabled { cursor: not-allowed; }
    .hint { margin: 8px 0 0; font-size: 12px; color: var(--muted); }
    .error { margin: 8px 0 0; font-size: 12px; color: var(--accent-text); }
  `,
})
export class DemoPanel {
  protected readonly open = signal(false);
  protected readonly flags = signal<DemoFlagsState | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly levels = THINKING_LEVELS;

  constructor() {
    // The browser only: the server render has no agent to ask.
    afterNextRender(() => void this.load());
  }

  protected onKey(event: KeyboardEvent) {
    if (event.altKey && event.shiftKey && event.code === 'KeyD') {
      event.preventDefault();
      this.open.update((open) => !open);
      if (this.open()) void this.load();
    }
  }

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected value(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  protected async set(patch: Partial<DemoFlagsState>, event?: Event) {
    this.busy.set(true);
    const ok = await this.request('PUT', patch);
    this.busy.set(false);
    // Refused (e.g. live without a key): put the control back to what the agent still has.
    // The binding alone won't, since the bound value never changed.
    const control = event?.target;
    const f = this.flags();
    if (!ok && f) {
      if (control instanceof HTMLInputElement) control.checked = !control.checked;
      if (control instanceof HTMLSelectElement) control.value = f.thinkingLevel;
    }
  }

  private load() {
    return this.request('GET');
  }

  private async request(method: 'GET' | 'PUT', body?: object): Promise<boolean> {
    try {
      const response = await fetch('/demo/flags', {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
      this.flags.set(json as DemoFlagsState);
      this.error.set(null);
      return true;
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
      return false;
    }
  }
}
