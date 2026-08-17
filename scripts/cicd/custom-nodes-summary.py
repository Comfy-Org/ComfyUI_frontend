#!/usr/bin/env python3
"""Render the custom-node core gate's results table.

Reads custom-nodes-results.json from the working directory and renders the
run's context (branch tested, head SHA, ComfyUI ref, filters) plus a
per-pack x tier verdict table - as an aligned table on stdout for the job
log, and as markdown appended to GITHUB_STEP_SUMMARY. Tolerates a missing
results file (the suite died before Playwright reported) by emitting the
context alone. Inputs arrive via env: BRANCH_TESTED, COMFYUI_REF_USED,
GREP_FILTER, plus the standard GITHUB_* vars.
"""

import json, os, re, subprocess

RESULT_FILE = 'custom-nodes-results.json'
LOG_FILE = 'custom-nodes.log'
SUITE_TITLE = 'Custom-node cloud snapshot suite'

def out(md, log=None):
    with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as f:
        f.write(md + '\n')
    print(log if log is not None else md)

head = subprocess.run(['git', 'rev-parse', 'HEAD'],
                      capture_output=True, text=True).stdout.strip()
ctx = [
    ('Branch tested', os.environ.get('BRANCH_TESTED', '?')),
    ('Head SHA', head[:12]),
    ('ComfyUI ref', os.environ.get('COMFYUI_REF_USED', '?')[:12]),
    ('Event / actor', f"{os.environ.get('GITHUB_EVENT_NAME','?')} / {os.environ.get('GITHUB_ACTOR','?')}"),
    ('Grep filter', os.environ.get('GREP_FILTER') or '(full suite)'),
]
if not os.path.exists(RESULT_FILE):
    out(f'## {SUITE_TITLE}\n\n**No results json was written** - the suite step died before Playwright could report.')
    for k, v in ctx:
        out(f'- **{k}**: {v}', f'{k}: {v}')
    raise SystemExit(0)

data = json.load(open(RESULT_FILE))
stats = data.get('stats', {})

TIERS = ['startup/load', 'S1', 'S2', 'S3', 'S9', 'curated run', 'dynamic inputs']
packs, wide = {}, {}
auto_run_exclusions = []

def bucket(file, path):
    title = ' > '.join(path)
    pack = None
    m = re.search(r'(?:custom node|all nodes|dynamic inputs): ([^@>]+?)(?:\s*@|\s*>|$)', title)
    if m:
        pack = m.group(1).strip()
    if 'allNodes' in file:
        tier = re.search(r'all nodes by tier @custom-nodes > (S(?:1|2|3|9)):', title)
        if tier:
            return (None, tier.group(1))
        return (pack, 'all nodes') if pack else (None, 'manifest coverage')
    if 'customNode.regression' in file:
        if pack is None:
            return (None, 'harness self-checks')
        tier = 'startup/load' if 'startup/load' in title else 'curated run'
        return (pack, tier)
    if 'dynamicInputs' in file:
        return (pack, 'dynamic inputs')
    if 'connectivity' in file:
        return (None, 'connectivity')
    if 'coreSmoke' in file:
        return (None, 'core smoke')
    return (None, 'pure specs')

RANK = {'skipped': 1, 'flaky': 2, 'unexpected': 3}
SYM = {0: 'PASS', 1: 'SKIP', 2: 'FLAKY', 3: 'FAIL'}
failed = []

def visit(suite, file, path):
    file = suite.get('file') or file
    path = path + ([suite['title']] if suite.get('title') else [])
    for spec in suite.get('specs', []):
        worst = max((RANK.get(t.get('status'), 0) for t in spec.get('tests', [])), default=0)
        pack, tier = bucket(file or '', path + [spec.get('title', '')])
        cell = packs.setdefault(pack, {}) if pack else wide
        key = tier
        prev = cell.get(key, (0, 0, 0))
        cell[key] = (max(prev[0], worst), prev[1] + 1, prev[2] + (1 if worst == 3 else 0))
        if worst == 3:
            err = ''
            for t in spec.get('tests', []):
                for r in t.get('results', []):
                    msg = (r.get('error') or {}).get('message') or ''
                    if msg:
                        err = re.sub(r'\x1b\[[0-9;]*m', '', msg).split('\n')[0][:140]
                        break
                if err:
                    break
            failed.append((f"{' > '.join(p for p in path[1:] if p)} > {spec.get('title','')}"[:120], err))
    for child in suite.get('suites', []):
        visit(child, file, path)

for s in data.get('suites', []):
    visit(s, s.get('file'), [])

if os.path.exists(LOG_FILE):
    for line in open(LOG_FILE):
        excluded = re.fullmatch(r'(.+): (.+) excluded from auto-run \((.+)\)\n?', line)
        if excluded:
            auto_run_exclusions.append(excluded.groups())
            continue
        m = re.fullmatch(r'\[tier-pack\] tier=(S(?:1|2|3|9)) pack=(.+) result=(pass|fail)\n?', line)
        if not m:
            continue
        tier, pack, result = m.groups()
        prev = packs.setdefault(pack, {}).get(tier, (0, 0, 0))
        failed_pack = result == 'fail'
        packs[pack][tier] = (
            max(prev[0], 3 if failed_pack else 0),
            prev[1] + 1,
            prev[2] + failed_pack,
        )

def cell(v):
    if v is None:
        return '-'
    worst, total, fails = v
    return SYM[worst] if fails == 0 else f'FAIL {fails}/{total}'

out(f'## {SUITE_TITLE}')
out('')
out('| | |\n|---|---|')
for k, v in ctx:
    out(f'| **{k}** | {v} |', f'{k:16} {v}')
mins = stats.get('duration', 0) / 60000
totals = f"{stats.get('expected',0)} passed / {stats.get('unexpected',0)} failed / {stats.get('flaky',0)} flaky / {stats.get('skipped',0)} skipped in {mins:.1f}m"
out(f'| **Result** | {totals} |', f'{"Result":16} {totals}')
out('')
out('| Pack | ' + ' | '.join(TIERS) + ' |',
    f'{"Pack":34}' + ''.join(f'{t:>16}' for t in TIERS))
out('|---|' + '---|' * len(TIERS), '-' * 100)
for pack in sorted(packs):
    row = [cell(packs[pack].get(t)) for t in TIERS]
    out(f'| {pack} | ' + ' | '.join(row) + ' |', f'{pack:34}' + ''.join(f'{c:>16}' for c in row))
out('')
for name in sorted(wide):
    out(f'- **{name}**: {cell(wide[name])}', f'{name:34}{cell(wide[name])}')
if failed:
    out('\n### Failed tests')
    for title, err in failed[:20]:
        out(f'- `{title}`\n  - {err}', f'FAILED: {title}\n        {err}')
if auto_run_exclusions:
    out('\n### Execution coverage exclusions')
    out('Every entry below was classified as model-free but was not executed.')
    for pack, node, reason in sorted(set(auto_run_exclusions)):
        out(f'- **{pack} / {node} - SKIP**\n  - {reason}')
        print(f'::warning title=Custom-node execution excluded::{pack} / {node} - {reason}')
