#!/usr/bin/env python3
"""Combine ecosystem-matrix rows into one population table and one verdict.

Reads every $MATRIX_OUT/<pack>.json row the runner wrote (all shards merged
into one directory by the verdict job) and applies, in order:

  harness gate   >= 50% of packs must pass the runner's self-check (the
                 default workflow materialized). Below that the graph was
                 broadly degraded by the HARNESS, not the ecosystem - the
                 verdict is withheld and the exit code is 2, never a FAIL
                 that reads as an ecosystem regression.

  PASS criteria  entry JS loads (any entry per pack)  >= 95%  (baseline 97.4%)
                 entry files load clean               >= 91%  (baseline 94.1%)
                 registerNodeDef OK                   >= 99%  (baseline 100%)
                 every operation clean                >= 99%  (baseline ~100%)

  delta gate     entry-files-clean must not drop more than 1.5 points below
                 the previous run's value ($MATRIX_PREV, written each run to
                 $MATRIX_METRICS_OUT and carried between runs by the actions
                 cache). Catches gradual erosion the absolute floors ignore.

Floors sit under the measured baselines so a handful of broken pack HEADs
cannot flip the verdict, while a frontend regression that breaks pack
integration craters them all at once. Exit codes: 0 PASS, 1 FAIL, 2 harness
failure / no rows. Shard manifests (_manifest-*.json) carry the no-JS skip
counts, reported once as a count and otherwise ignored.
"""

from __future__ import annotations

import json
import os
import sys
from collections import Counter

STATUS_STAGES = ('registerNodeDef', 'registerCustomNodes')
DELTA_TOLERANCE = 1.5


def main() -> int:
    out_dir = os.environ.get('MATRIX_OUT', '/tmp/matrix')
    rows = []
    for name in sorted(os.listdir(out_dir) if os.path.isdir(out_dir) else []):
        if not name.endswith('.json') or name.startswith('_'):
            continue
        try:
            rows.append(json.load(open(os.path.join(out_dir, name))))
        except (OSError, ValueError):
            print(f'unreadable row: {name}', file=sys.stderr)
    if not rows:
        print(f'no matrix rows in {out_dir}', file=sys.stderr)
        return 2

    skipped = 0
    for name in os.listdir(out_dir):
        if name.startswith('_manifest') and name.endswith('.json'):
            try:
                manifest = json.load(open(os.path.join(out_dir, name)))
            except (OSError, ValueError):
                print(f'unreadable shard manifest: {name}', file=sys.stderr)
                continue
            skipped += sum(1 for v in manifest.values() if 'skipped' in v)

    lines = [
        f'packs with extension JS executed: {len(rows)}'
        + (f' (no-JS packs ignored: {skipped})' if skipped else '')
    ]

    self_ok = sum(1 for r in rows if r.get('selfCheck', 'OK') == 'OK')
    any_loaded = sum(1 for r in rows if r.get('loadedOk'))
    total_entries = sum(len(r.get('load') or {}) for r in rows)
    ok_entries = sum(
        1
        for r in rows
        for v in (r.get('load') or {}).values()
        if v == 'OK'
    )
    any_pct = any_loaded / len(rows) * 100
    entry_pct = ok_entries / total_entries * 100 if total_entries else 0.0

    lines.append(
        f'{"packs with >=1 entry loaded":28s} {any_loaded:5d} ({any_pct:5.1f}%)'
    )
    lines.append(
        f'{"entry files loaded clean":28s} {ok_entries:5d} of {total_entries}'
        f' ({entry_pct:5.1f}%)'
    )
    for stage in STATUS_STAGES:
        ok = sum(1 for r in rows if r.get(stage) == 'OK')
        measured = sum(1 for r in rows if stage in r)
        lines.append(f'{stage:28s} {ok:5d} of {measured} OK')
    hook_packs = sum(1 for r in rows if r.get('hookErrors'))
    lines.append(f'{"contained hook errors":28s} {hook_packs:5d} pack(s)')
    lines.append(
        f'{"harness self-check OK":28s} {self_ok:5d} of {len(rows)}'
    )

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

    def flush(code: int) -> int:
        report = '\n'.join(lines)
        print(report)
        summary = os.environ.get('GITHUB_STEP_SUMMARY')
        if summary:
            with open(summary, 'a', encoding='utf-8') as fh:
                fh.write('## Ecosystem matrix\n\n```\n' + report + '\n```\n')
        return code

    self_pct = self_ok / len(rows) * 100
    if self_pct < 50:
        lines.append('')
        lines.append(
            f'HARNESS FAILURE: only {self_pct:.1f}% of packs passed the'
            ' runner self-check (default workflow materialized). The graph'
            ' was broadly degraded by the harness, not the ecosystem -'
            ' verdict withheld.'
        )
        return flush(2)

    reg_ok = sum(1 for r in rows if r.get('registerNodeDef') == 'OK')
    reg_measured = sum(1 for r in rows if 'registerNodeDef' in r)
    reg_pct = reg_ok / reg_measured * 100 if reg_measured else 0.0
    worst_op, worst_pct = '-', 100.0
    for op in op_total:
        pct = (op_total[op] - op_err[op]) / op_total[op] * 100
        if pct < worst_pct:
            worst_op, worst_pct = op, pct

    criteria = [
        ('entry JS loads (any entry per pack)', any_pct, 95.0),
        ('entry files load clean', entry_pct, 91.0),
        ('registerNodeDef OK', reg_pct, 99.0),
        (f'every operation clean (worst: {worst_op})', worst_pct, 99.0),
    ]
    lines.append('')
    lines.append('PASS criteria - all must hold, all shards combined:')
    breaches = []
    for label, measured_pct, floor in criteria:
        held = measured_pct >= floor
        lines.append(
            f'  {label:42s} {measured_pct:5.1f}%  (floor {floor:.0f}%)'
            f'  {"OK" if held else "BREACH"}'
        )
        if not held:
            breaches.append(f'{label} {measured_pct:.1f}% < {floor:.0f}%')

    run_id = os.environ.get('MATRIX_RUN_ID', '')
    prev_path = os.environ.get('MATRIX_PREV', '')
    if prev_path and os.path.exists(prev_path):
        prev = json.load(open(prev_path))
        prev_entry = prev.get('entryPct')
        if run_id and prev.get('runId') == run_id:
            # A re-run restored this same run's earlier write; comparing a
            # run against itself would blind the gate exactly when someone
            # is re-running a red verdict.
            lines.append(
                f'  {"entry-clean delta vs previous run":42s}   n/a'
                '  (previous metrics are from this run)'
            )
        elif isinstance(prev_entry, (int, float)):
            delta = entry_pct - prev_entry
            held = delta >= -DELTA_TOLERANCE
            lines.append(
                f'  {"entry-clean delta vs previous run":42s} {delta:+5.1f}pp'
                f'  (floor -{DELTA_TOLERANCE}pp)  {"OK" if held else "BREACH"}'
            )
            if not held:
                breaches.append(
                    f'entry files clean dropped {-delta:.1f}pp'
                    f' (from {prev_entry:.1f}% to {entry_pct:.1f}%)'
                )
    else:
        lines.append(
            f'  {"entry-clean delta vs previous run":42s}   n/a'
            '  (no previous metrics)'
        )

    lines.append(
        'VERDICT: ' + ('FAIL - ' + '; '.join(breaches) if breaches else 'PASS')
    )

    # Baseline-from-health: a FAILing run must not ratchet the baseline down
    # to its own eroded numbers, or next week's delta forgives the
    # regression exactly once it has become permanent.
    metrics_out = os.environ.get('MATRIX_METRICS_OUT', '')
    if metrics_out and not breaches:
        os.makedirs(os.path.dirname(metrics_out) or '.', exist_ok=True)
        json.dump(
            {
                'packs': len(rows),
                'anyPct': round(any_pct, 3),
                'entryPct': round(entry_pct, 3),
                'regPct': round(reg_pct, 3),
                'worstOp': worst_op,
                'worstOpPct': round(worst_pct, 3),
                'runId': run_id,
                'verdict': 'PASS',
            },
            open(metrics_out, 'w'),
            indent=1,
        )

    return flush(1 if breaches else 0)


if __name__ == '__main__':
    raise SystemExit(main())
