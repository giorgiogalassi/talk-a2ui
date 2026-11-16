"""Checks graph.json and writes index.html from template.html.

    python3 build.py           write index.html
    python3 build.py --check   fail if index.html is out of date (npm run test:docs)

A node's `code` entries point at the code it describes: `path` (from the repo root), `from` (text
on the first line) and optionally `to` (text on the last line, searched after `from`). Without
`to`, the block runs until its brackets close. Each entry becomes a GitHub link with line numbers,
so a code change that moves the lines makes --check fail until the page is rebuilt.

Each link also says where the file comes from, read from its header: an `Original: <url>` line
means adapted from Google's A2UI samples (the link goes to that file upstream); no Apache header
means the demo's own code.
"""
import re
import json
import sys
from pathlib import Path

here = Path(__file__).parent
repo = here.parents[2]
GITHUB = 'https://github.com/giorgiogalassi/talk-a2ui/blob/main/'
OPEN, CLOSE = '({[', ')}]'


def block(lines: list[str], start: int) -> int:
    """The last line of the bracketed block that opens on `start` (0-based), or `start` itself."""
    depth, opened = 0, False
    for i in range(start, len(lines)):
        for ch in lines[i]:
            if ch in OPEN:
                depth += 1
                opened = True
            elif ch in CLOSE:
                depth -= 1
        if not opened or depth <= 0:
            return i
    return start


def locate(entry: dict, where: str) -> dict:
    path = repo / entry['path']
    assert path.is_file(), f'{where}: no file {entry["path"]}'
    lines = path.read_text().splitlines()
    starts = [i for i, l in enumerate(lines) if entry['from'] in l]
    assert starts, f'{where}: "{entry["from"]}" not found in {entry["path"]}'
    a = starts[0]
    if 'to' in entry:
        ends = [i for i in range(a, len(lines)) if entry['to'] in lines[i]]
        assert ends, f'{where}: "{entry["to"]}" not found after line {a + 1} in {entry["path"]}'
        b = ends[0]
    else:
        b = block(lines, a)
    anchor = f'#L{a + 1}' + (f'-L{b + 1}' if b > a else '')
    head = '\n'.join(lines[:30])
    original = re.search(r'Original: (https://\S+)', head)
    assert original or 'Google LLC' not in head, f'{where}: {entry["path"]} has a Google header but no "Original:" line'
    origin = {'origin': 'sample', 'upstream': original.group(1)} if original else {'origin': 'demo'}
    return {'path': entry['path'], 'lines': f'{a + 1}' + (f'–{b + 1}' if b > a else ''), 'url': GITHUB + entry['path'] + anchor, **origin}


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
    for n in g['nodes']:
        if n.get('code'):
            n['links'] = [locate(c, f"{g['key']}/{n['id']}") for c in n['code']]
        n.pop('code', None)

template = (here / 'template.html').read_text()
assert '/*DATA*/[]' in template
page = template.replace('/*DATA*/[]', json.dumps(graphs, ensure_ascii=False), 1)
target = here / 'index.html'
if '--check' in sys.argv:
    if target.read_text() != page:
        sys.exit('docs/data-flow/index.html is out of date (code lines moved, or graph.json/template.html changed): run python3 docs/data-flow/build.py')
    print('index.html is up to date')
else:
    target.write_text(page)
    print('index.html written:', {g['key']: len(g['nodes']) for g in graphs})
