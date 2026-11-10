// Demo: the server-side policy (src/policy.ts) on its own: what it strips, and that what it
// leaves is still valid against the ticket catalog.

import assert from 'node:assert/strict';
import path from 'node:path';
import {describe, it} from 'node:test';

import {type AgentToRendererMessage, validatePayload} from '@a2ui/agent';

import {loadBasicCatalogs, loadTicketCatalogs} from './catalogs.js';
import {readMessages} from './examples.js';
import {leakInternalNotes} from './model.js';
import {applyPolicy, DEMO_POLICY, enforcePolicy, UNAVAILABLE_TEXT} from './policy.js';
import {getPackageRootDir} from './tools.js';

const root = getPackageRootDir();
const catalogs = [loadTicketCatalogs().get('v0.9')!, loadBasicCatalogs().get('v0.9')!];

function leaky(name: string): AgentToRendererMessage[] {
  return leakInternalNotes(readMessages(path.join(root, 'examples', 'v0.9', `${name}.json`)), root);
}

const json = (value: unknown) => JSON.stringify(value);

describe('applyPolicy', () => {
  it('strips internal_notes from every ticket in a list written at /', () => {
    const input = leaky('ticket_list');
    assert.ok(json(input).includes('internal_notes'));

    const {messages, stripped} = applyPolicy(input, DEMO_POLICY);

    assert.ok(!json(messages).includes('internal_notes'));
    assert.deepEqual(stripped, [
      'stripped /tickets/0/internal_notes',
      'stripped /tickets/1/internal_notes',
      'stripped /tickets/2/internal_notes',
    ]);
    // The rest of each ticket is untouched, and the input is not modified.
    const data = (messages[2] as any).updateDataModel.value.tickets[0];
    assert.equal(data.title, 'Checkout fails with a 502 on card payments');
    assert.ok(json(input).includes('internal_notes'));
    validatePayload(catalogs, messages as AgentToRendererMessage[]);
  });

  it('strips them from a list written at /tickets, and drops a write to the field itself', () => {
    const tickets = [{id: 'A', internal_notes: 'x'}, {id: 'B', internal_notes: 'y'}];
    const {messages, stripped} = applyPolicy(
      [
        {version: 'v0.9', updateDataModel: {surfaceId: 's', path: '/tickets', value: tickets}},
        {version: 'v0.9', updateDataModel: {surfaceId: 's', path: '/tickets/1', value: tickets[1]}},
        {version: 'v0.9', updateDataModel: {surfaceId: 's', path: '/tickets/1/internal_notes', value: 'y'}},
        {version: 'v0.9', updateDataModel: {surfaceId: 's', path: '/ticket', value: {id: 'A', internal_notes: 'x'}}},
      ],
      DEMO_POLICY,
    );
    assert.deepEqual(messages, [
      {version: 'v0.9', updateDataModel: {surfaceId: 's', path: '/tickets', value: [{id: 'A'}, {id: 'B'}]}},
      {version: 'v0.9', updateDataModel: {surfaceId: 's', path: '/tickets/1', value: {id: 'B'}}},
      {version: 'v0.9', updateDataModel: {surfaceId: 's', path: '/ticket', value: {id: 'A'}}},
    ]);
    assert.deepEqual(stripped, [
      'stripped /tickets/0/internal_notes',
      'stripped /tickets/1/internal_notes',
      'stripped /tickets/1/internal_notes',
      'dropped updateDataModel at /tickets/1/internal_notes',
      'stripped /ticket/internal_notes',
    ]);
  });

  it('removes the delete_ticket button with its label, and the Text bound to the notes', () => {
    const input = leaky('ticket_detail');
    assert.ok(json(input).includes('delete_ticket'));

    const {messages, stripped} = applyPolicy(input, DEMO_POLICY);

    assert.deepEqual(stripped, [
      'removed Text detail_notes (binds /ticket/internal_notes)',
      'removed Button delete_button (action delete_ticket)',
      'removed Text delete_text (inside delete_button)',
      'stripped /ticket/internal_notes',
    ]);
    const out = json(messages);
    for (const gone of ['delete_ticket', 'delete_button', 'delete_text', 'detail_notes', 'internal_notes']) {
      assert.ok(!out.includes(gone), gone);
    }
    // The parents keep their other children, so the surface is still a valid tree.
    const components = (messages[1] as any).updateComponents.components as any[];
    assert.deepEqual(components.find(c => c.id === 'detail_actions').children, ['resolve_button']);
    assert.ok(!components.find(c => c.id === 'detail_column').children.includes('detail_notes'));
    validatePayload(catalogs, messages as AgentToRendererMessage[]);
  });

  it('removes a Card whose only child is removed, and empties a template that pointed at it', () => {
    const {messages, stripped} = applyPolicy(
      [
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 's',
            components: [
              {id: 'root', component: 'Column', children: ['card', 'list']},
              {id: 'card', component: 'Card', child: 'del'},
              {id: 'del', component: 'Button', child: 'lbl', action: {event: {name: 'delete_ticket'}}},
              {id: 'lbl', component: 'Text', text: 'Delete'},
              {id: 'list', component: 'TicketList', title: 'x', children: {componentId: 'note', path: '/tickets'}},
              {id: 'note', component: 'Text', text: {path: 'internal_notes'}},
            ],
          },
        },
      ],
      DEMO_POLICY,
    );
    assert.deepEqual((messages[0] as any).updateComponents.components, [
      {id: 'root', component: 'Column', children: ['list']},
      {id: 'list', component: 'TicketList', title: 'x', children: []},
    ]);
    assert.ok(stripped.includes('removed Card card (its child del was removed)'));
    assert.ok(stripped.includes('removed Text note (binds internal_notes)'));
  });

  it('follows every reference prop the catalog declares: Modal, Tabs', () => {
    const del = {id: 'del', component: 'Button', child: 'lbl', action: {event: {name: 'delete_ticket'}}};
    const {messages, stripped} = applyPolicy(
      [
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 's',
            components: [
              {id: 'root', component: 'Column', children: ['modal', 'tabs', 'solo']},
              {id: 'modal', component: 'Modal', trigger: 'del', content: 'body'},
              {id: 'body', component: 'Text', text: 'Sure?'},
              del,
              {id: 'lbl', component: 'Text', text: 'Delete'},
              {id: 'tabs', component: 'Tabs', tabs: [{title: 'Info', child: 'info'}, {title: 'Danger', child: 'del'}]},
              {id: 'info', component: 'Text', text: 'Info'},
              {id: 'solo', component: 'Tabs', tabs: [{title: 'Danger', child: 'del'}]},
            ],
          },
        },
      ],
      DEMO_POLICY,
    );
    assert.deepEqual((messages[0] as any).updateComponents.components, [
      {id: 'root', component: 'Column', children: ['tabs']},
      {id: 'tabs', component: 'Tabs', tabs: [{title: 'Info', child: 'info'}]},
      {id: 'info', component: 'Text', text: 'Info'},
    ]);
    assert.ok(stripped.includes('removed Modal modal (its trigger del was removed)'));
    assert.ok(stripped.includes('removed Tabs solo (every item it held was removed)'));
    // Nothing kept points at a removed id.
    assert.ok(!json(messages).includes('"del"') && !json(messages).includes('"body"'));
  });

  it('replaces a removed root with a notice instead of a blank surface', () => {
    const {messages, stripped} = applyPolicy(
      [
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 's',
            components: [
              {id: 'root', component: 'Card', child: 'del'},
              {id: 'del', component: 'Button', child: 'lbl', action: {event: {name: 'delete_ticket'}}},
              {id: 'lbl', component: 'Text', text: 'Delete'},
            ],
          },
        },
      ],
      DEMO_POLICY,
    );
    assert.deepEqual((messages[0] as any).updateComponents.components, [
      {id: 'root', component: 'Text', text: UNAVAILABLE_TEXT},
    ]);
    assert.ok(stripped.includes('replaced root with a notice'));
    validatePayload(catalogs, messages as AgentToRendererMessage[]);
  });

  it('removes a component that interpolates a forbidden path into a string', () => {
    const {messages, stripped} = applyPolicy(
      [
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 's',
            components: [
              {id: 'root', component: 'Column', children: ['a', 'b']},
              {id: 'a', component: 'Text', text: 'Notes: ${/ticket/internal_notes}'},
              {id: 'b', component: 'Text', text: 'Title: ${/ticket/title}'},
            ],
          },
        },
      ],
      DEMO_POLICY,
    );
    assert.deepEqual((messages[0] as any).updateComponents.components.map((c: any) => c.id), ['root', 'b']);
    assert.ok(stripped.includes('removed Text a (binds /ticket/internal_notes)'));
  });

  it('leaves the plain examples alone, apart from the Delete button', () => {
    for (const name of ['ticket_list', 'ticket_resolved']) {
      const input = readMessages(path.join(root, 'examples', 'v0.9', `${name}.json`));
      assert.deepEqual(applyPolicy(input, DEMO_POLICY), {messages: input, stripped: []});
    }
  });
});

describe('enforcePolicy', () => {
  it('logs one line per strip and drops a part left empty', t => {
    const lines: string[] = [];
    t.mock.method(console, 'log', (line: string) => lines.push(line));
    const parts = enforcePolicy([
      {type: 'text', text: 'hi'},
      {
        type: 'a2ui',
        a2ui: [{version: 'v0.9', updateDataModel: {surfaceId: 's', path: '/ticket/internal_notes', value: 'x'}}] as never,
      },
    ]);
    assert.deepEqual(parts, [{type: 'text', text: 'hi'}]);
    assert.deepEqual(lines, ['--- policy: dropped updateDataModel at /ticket/internal_notes ---']);
  });
});
