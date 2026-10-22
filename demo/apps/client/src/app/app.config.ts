import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BasicCatalog, provideA2Ui, provideMarkdownRenderer } from '@a2ui/angular/v0_9';
import { renderMarkdown } from '@a2ui/markdown-it';
import { A2uiClientAction } from '@a2ui/web_core/v0_9';

export const actions: A2uiClientAction[] = [];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideA2Ui(() => ({
      catalogs: [new BasicCatalog()],
      actionHandler: (action: A2uiClientAction) => {
        actions.push(action);
        console.log('[a2ui action]', JSON.stringify(action));
      },
    })),
    provideMarkdownRenderer(renderMarkdown as any),
  ],
};
