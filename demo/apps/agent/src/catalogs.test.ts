// Demo: checks the ticket catalog the agent serves: its generated document, why the agent
// registers the Zod catalog instead of that document, and that the prompt examples are valid.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {describe, it} from 'node:test';

import {
  A2uiGenerator,
  type A2uiRequestProcessor,
  CatalogConfig,
  DirectJsonFormatFactory,
  InMemoryCatalogProvider,
  validatePayload,
} from '@a2ui/agent';
import {type CatalogApi} from '@a2ui/web_core/catalog';
import {TICKET_CATALOG_ID, ticketCatalogDocument} from '@demo/catalog';

import {loadBasicCatalogs, loadTicketCatalogs} from './catalogs.js';
import {readMessages, toResponseText} from './examples.js';
import {getPackageRootDir} from './tools.js';
import {V0_9} from './versions.js';

const ticketCatalog = loadTicketCatalogs().get('v0.9')!;
const basicCatalog = loadBasicCatalogs().get('v0.9')!;

function processorFor(catalog: CatalogApi): A2uiRequestProcessor {
  return new A2uiGenerator([new CatalogConfig(catalog)]).createProcessor(
    {supportedCatalogIds: [TICKET_CATALOG_ID]},
    new DirectJsonFormatFactory(),
  );
}

/** A ticket surface holding one button whose action context is `context`. */
function buttonReply(context: unknown): string {
  return toResponseText(V0_9, ticketCatalog, 'direct_json', [
    {version: 'v0.9', createSurface: {surfaceId: 's', catalogId: TICKET_CATALOG_ID}},
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 's',
        components: [
          {id: 'root', component: 'Button', child: 'label', action: {event: {name: 'open_ticket', context}}},
          {id: 'label', component: 'Text', text: 'Open'},
        ],
      },
    },
  ] as never);
}

describe('the ticket catalog', () => {
  it('has the custom components next to the reused basic ones', () => {
    assert.equal(ticketCatalog.id, TICKET_CATALOG_ID);
    assert.deepEqual(
      [...ticketCatalog.components.keys()],
      ['Text', 'Row', 'Column', 'Card', 'Divider', 'Button', 'TicketList', 'PriorityBadge', 'AssigneeChip'],
    );
  });

  it('generates a catalog document that InMemoryCatalogProvider loads', () => {
    const document = ticketCatalogDocument();
    assert.equal(document.catalogId, TICKET_CATALOG_ID);
    const loaded = new InMemoryCatalogProvider(document, 'v0.9', TICKET_CATALOG_ID).load();
    assert.equal(loaded.id, TICKET_CATALOG_ID);
    assert.equal(loaded.protocolVersion, 'v0.9');
    assert.deepEqual([...loaded.components.keys()], [...ticketCatalog.components.keys()]);
    // The loaded catalog still rejects a priority outside the enum.
    const priority = (document.components as Record<string, any>).PriorityBadge.properties.priority;
    assert.deepEqual(priority.oneOf[0].enum, ['low', 'medium', 'high', 'urgent']);
  });

  it('is served as Zod, because the document loaded back is looser (incident 2)', () => {
    const fromDocument = new InMemoryCatalogProvider(ticketCatalogDocument(), 'v0.9').load();
    const binding = buttonReply({ticketId: {path: 'id'}});
    const cutBinding = buttonReply({ticketId: {}});

    // A real binding passes both.
    assert.doesNotThrow(() => processorFor(ticketCatalog).parseResponse(binding));
    assert.doesNotThrow(() => processorFor(fromDocument).parseResponse(binding));
    // A binding cut mid-stream, `{}`, passes the catalog loaded from the document and fails
    // the Zod one, which is also the renderer's.
    assert.doesNotThrow(() => processorFor(fromDocument).parseResponse(cutBinding));
    assert.throws(
      () => processorFor(ticketCatalog).parseResponse(cutBinding),
      /Validation failed for component 'Button' \(root\): action\.event\.context\.ticketId/,
    );
  });

  it('rejects a component that is not in it', () => {
    const reply = toResponseText(V0_9, ticketCatalog, 'direct_json', [
      {version: 'v0.9', createSurface: {surfaceId: 's', catalogId: TICKET_CATALOG_ID}},
      {version: 'v0.9', updateComponents: {surfaceId: 's', components: [{id: 'root', component: 'Image', url: 'x'}]}},
    ] as never);
    assert.throws(
      () => processorFor(ticketCatalog).parseResponse(reply),
      new RegExp(`Unknown component type 'Image' not found in catalog '${TICKET_CATALOG_ID}'`),
    );
  });

  it('rejects a prop that is not in a component', () => {
    const reply = toResponseText(V0_9, ticketCatalog, 'direct_json', [
      {version: 'v0.9', createSurface: {surfaceId: 's', catalogId: TICKET_CATALOG_ID}},
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's',
          components: [{id: 'root', component: 'PriorityBadge', priority: 'high', color: 'red'}],
        },
      },
    ] as never);
    assert.throws(
      () => processorFor(ticketCatalog).parseResponse(reply),
      /Validation failed for component 'PriorityBadge' \(root\): root: Unrecognized key\(s\) in object: 'color'/,
    );
  });
});

describe('the prompt examples and the stub notice', () => {
  const root = getPackageRootDir();
  const files = [
    ...fs
      .readdirSync(path.join(root, 'examples', 'v0.9'))
      .map(f => path.join(root, 'examples', 'v0.9', f)),
    path.join(root, 'stub_notice', 'v0.9.json'),
  ];
  for (const file of files) {
    it(`${path.basename(file)} is valid against the ticket catalog`, () => {
      const messages = readMessages(file);
      assert.ok(messages.some(m => JSON.stringify(m).includes(TICKET_CATALOG_ID)));
      validatePayload([ticketCatalog, basicCatalog], messages);
      processorFor(ticketCatalog).parseResponse(toResponseText(V0_9, ticketCatalog, 'direct_json', messages));
    });
  }
});
