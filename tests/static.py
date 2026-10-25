#!/usr/bin/env python3
"""Fast checks that need no browser: manifests are valid, ids are well-formed, and every inline script parses."""
import json, os, re, subprocess, sys, tempfile
root = os.path.join(os.path.dirname(__file__), '..', 'apps'); errs = []; titles = {}
for a in sorted(os.listdir(root)):
    d = os.path.join(root, a)
    if not re.fullmatch(r'[a-z0-9-]+', a): errs.append(f'{a}: id must match [a-z0-9-]+'); continue
    if not os.path.isfile(os.path.join(d, 'index.html')): errs.append(f'{a}: missing index.html'); continue
    try: m = json.load(open(os.path.join(d, 'app.json')))
    except Exception as e: errs.append(f'{a}: app.json {e}'); continue
    for k in ('title', 'description', 'color'):
        if not m.get(k): errs.append(f'{a}: app.json missing {k}')
    if not re.fullmatch(r'#[0-9a-fA-F]{6}', m.get('color', '')): errs.append(f'{a}: color must be #rrggbb')
    if m.get('cat') not in ('Utilities', 'Play'): errs.append(f'{a}: cat must be Utilities or Play')
    titles.setdefault(m.get('title', '').lower(), []).append(a)
    html = open(os.path.join(d, 'index.html')).read(); js = '\n'.join(re.findall(r'<script>(.*?)</script>', html, re.S))
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f: f.write(js)
    r = subprocess.run(['node', '--check', f.name], capture_output=True, text=True); os.unlink(f.name)
    if r.returncode: errs.append(f'{a}: script syntax error: {r.stderr.splitlines()[0] if r.stderr else ""}')
for t, ids in titles.items():
    if len(ids) > 1: errs.append(f'duplicate title "{t}": {", ".join(ids)}')
print(f'static: {len(os.listdir(root))} apps, {len(errs)} problems'); [print('  -', e) for e in errs]; sys.exit(1 if errs else 0)
