import { ApplicationConfig, Injector, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BasicCatalog, provideA2Ui, provideMarkdownRenderer } from '@a2ui/angular/v0_9';
import { renderMarkdown } from '@a2ui/markdown-it';
import { A2uiClientAction } from '@a2ui/web_core/v0_9';
import { AgentClient } from './agent-client';
import { createTicketCatalog } from './catalog/ticket-catalog';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideA2Ui(() => {
      const injector = inject(Injector);
      return {
        // The ticket catalog draws what the agent sends. The basic catalog stays registered so a
        // surface on it still renders; the app only asks the agent for the ticket one (server.ts).
        catalogs: [createTicketCatalog(), new BasicCatalog()],
        actionHandler: (action: A2uiClientAction) => injector.get(AgentClient).handleAction(action),
      };
    }),
    provideMarkdownRenderer(renderMarkdown as any),
  ],
};
