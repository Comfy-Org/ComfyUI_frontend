#!/usr/bin/env python3
"""Combine all ecosystem-matrix shard rows into one table and one verdict.

Reads every $MATRIX_OUT/<pack>.json row (the verdict job merges all shards
into one directory), prints the population table, then applies the PASS
criteria and exits with the verdict:

    PASS requires  entry JS loads clean   >= 95%
                   registerNodeDef OK     >= 99%
                   every operation clean  >= 99% of packs

Each floor sits under the measured baseline (97.9% / 100% / ~100%) so a
handful of broken pack HEADs cannot flip the verdict, while a frontend
regression that breaks pack integration craters all three at once.
Shard manifests (_manifest-*.json alongside the rows) are merged by pack
name to count no-JS packs, which are reported only as that count.
"""

from __future__ import annotations

import json
import os
import sys
from collections import Counter

STATUS_STAGES = ('registerNodeDef', 'registerCustomNodes')


def main() -> int:
    out_dir = os.environ.get('MATRIX_OUT', '/tmp/matrix')
    rows = []
    manifest = {}
    for name in sorted(os.listdir(out_dir) if os.path.isdir(out_dir) else []):
        if not name.endswith('.json'):
            continue
        path = os.path.join(out_dir, name)
        try:
            if name.startswith('_manifest'):
                manifest.update(json.load(open(path)))
            else:
                rows.append(json.load(open(path)))
        except (OSError, ValueError):
            print(f'unreadable row: {name}', file=sys.stderr)
    if not rows:
        print(f'no matrix rows in {out_dir}', file=sys.stderr)
        return 2

    skipped = sum(1 for v in manifest.values() if 'skipped' in v)
    lines = [
        f'packs with extension JS executed: {len(rows)}'
        + (f' (no-JS packs ignored: {skipped})' if skipped else '')
    ]
    loaded = sum(1 for r in rows if r.get('loadedOk'))
    lines.append(f'{"entry JS loaded":22s} {loaded:5d} ({loaded / len(rows) * 100:5.1f}%)')
    for stage in STATUS_STAGES:
        ok = sum(1 for r in rows if r.get(stage) == 'OK')
        measured = sum(1 for r in rows if stage in r)
        lines.append(f'{stage:22s} {ok:5d} of {measured} OK')
    hook_packs = sum(1 for r in rows if r.get('hookErrors'))
    lines.append(f'{"contained hook errors":22s} {hook_packs:5d} pack(s)')

    op_total: Counter = Counter()
    op_err: Counter = Counter()
    op_desync: Counter = Counter()
    err_msgs: Counter = Counter()
    for r in rows:
        for op, info in (r.get('ops') or {}).items():
            op_total[op] += 1
            if info.get('err'):
                op_err[op] += 1
                err_msgs[f'{op}: {str(info["err"])[:90]}'] += 1
            if info.get('desync'):
                op_desync[op] += 1
    lines.append('')
    lines.append('operation battery (packs with an error / widget desync):')
    for op in op_total:
        lines.append(
            f'  {op:18s} {op_total[op] - op_err[op]:5d} of {op_total[op]} clean'
            + (f'   errors {op_err[op]}' if op_err[op] else '')
            + (f'   desync {op_desync[op]}' if op_desync[op] else '')
        )
    if err_msgs:
        lines.append('')
        lines.append('most common operation errors:')
        for msg, n in err_msgs.most_common(8):
            lines.append(f'  {n:4d}x {msg}')

    load_pct = loaded / len(rows) * 100
    reg_measured = sum(1 for r in rows if 'registerNodeDef' in r)
    reg_ok = sum(1 for r in rows if r.get('registerNodeDef') == 'OK')
    reg_pct = reg_ok / reg_measured * 100 if reg_measured else 0.0
    worst_op, worst_pct = 'n/a', 100.0
    for op in op_total:
        pct = (op_total[op] - op_err[op]) / op_total[op] * 100
        if pct < worst_pct:
            worst_op, worst_pct = op, pct
    criteria = [
        ('entry JS loads clean', load_pct, 95.0),
        ('registerNodeDef OK', reg_pct, 99.0),
        (f'every operation clean (worst: {worst_op})', worst_pct, 99.0),
    ]
    lines.append('')
    lines.append('PASS criteria - all must hold, all shards combined:')
    breaches = []
    for label, measured_pct, floor in criteria:
        held = measured_pct >= floor
        lines.append(
            f'  {label:42s} {measured_pct:5.1f}%  (floor {floor:.0f}%)  '
            + ('OK' if held else 'BREACH')
        )
        if not held:
            breaches.append(f'{label} {measured_pct:.1f}% < {floor:.0f}%')
    lines.append(f'VERDICT: {"FAIL - " + "; ".join(breaches) if breaches else "PASS"}')

    report = '\n'.join(lines)
    print(report)
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a', encoding='utf-8') as fh:
            fh.write('## Ecosystem matrix\n\n```\n' + report + '\n```\n')
    return 1 if breaches else 0


if __name__ == '__main__':
    raise SystemExit(main())
