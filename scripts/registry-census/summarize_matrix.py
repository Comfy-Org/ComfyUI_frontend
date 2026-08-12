#!/usr/bin/env python3
"""Aggregate ecosystem-matrix rows into a census-style population table.

Reads every $MATRIX_OUT/<pack>.json row the runner wrote and prints stage
pass counts plus the most common failure messages per stage - to stdout for
the job log, and as markdown to GITHUB_STEP_SUMMARY when set.
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
    for name in sorted(os.listdir(out_dir) if os.path.isdir(out_dir) else []):
        if not name.endswith('.json'):
            continue
        try:
            rows.append(json.load(open(os.path.join(out_dir, name))))
        except (OSError, ValueError):
            print(f'unreadable row: {name}', file=sys.stderr)
    if not rows:
        print(f'no matrix rows in {out_dir}', file=sys.stderr)
        return 2

    skipped = 0
    manifest_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        os.pardir, os.pardir, 'src', '__ecs_matrix__', 'manifest.json'
    )
    if os.path.exists(manifest_path):
        manifest = json.load(open(manifest_path))
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

    report = '\n'.join(lines)
    print(report)
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a', encoding='utf-8') as fh:
            fh.write('## Ecosystem matrix\n\n```\n' + report + '\n```\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
