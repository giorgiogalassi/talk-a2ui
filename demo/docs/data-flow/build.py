"""Checks graph.json and writes index.html from template.html. Run: python3 build.py"""
import json
from pathlib import Path

here = Path(__file__).parent
graphs = json.loads((here / 'graph.json').read_text())
for g in graphs:
    ids = {n['id'] for n in g['nodes']}
    assert len(ids) == len(g['nodes']), f"{g['key']}: duplicate node id"
    assert {n['group'] for n in g['nodes']} <= {gr['id'] for gr in g['groups']}, f"{g['key']}: unknown group"
    for e in g['edges']:
        assert e['from'] in ids and e['to'] in ids, f"{g['key']}: edge to a missing node {e}"
    for p in g.get('paths', []):
        for a, b in zip(p['nodes'], p['nodes'][1:]):
            assert any({e['from'], e['to']} == {a, b} for e in g['edges']), f"{g['key']}/{p['id']}: no edge {a} - {b}"
template = (here / 'template.html').read_text()
assert '/*DATA*/[]' in template
(here / 'index.html').write_text(template.replace('/*DATA*/[]', json.dumps(graphs, ensure_ascii=False), 1))
print('index.html written:', {g['key']: len(g['nodes']) for g in graphs})
