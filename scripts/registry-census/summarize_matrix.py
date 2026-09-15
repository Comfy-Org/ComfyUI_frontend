#!/usr/bin/env python3
"""Combine ecosystem-matrix rows into one population table and one verdict.

Reads every $MATRIX_OUT/<pack>.json row the runner wrote (all shards merged
into one directory by the verdict job) and applies, in order:

  population     with $MATRIX_EXPECT_SHARDS set, that many shard manifests
                 must be present and the packs they built specs for must
                 match the rows exactly. A dead shard otherwise yields a
                 PASS over a partial corpus, which then becomes the
                 baseline the next run is measured against.

  harness gate   a majority of stub rows, or < 50% of packs passing the
                 runner's self-check (the default workflow materialized),
                 means the graph was broadly degraded by the HARNESS, not
                 the ecosystem - the verdict is withheld and the exit code
                 is 2, never a FAIL that reads as an ecosystem regression.

  PASS criteria  entry JS loads (any entry per pack) >= 95% (base 97.3%)
                 entry files load clean              >= 91% (base 94.0%)
                 registerNodeDef OK                  >= 99% (base 100%)
                 registerCustomNodes OK              >= 99% (base 100%)
                 packs free of contained hook errors >= 98% (base 99.3%)
                 every operation clean, err OR desync>= 99% (base 99.8%)
                 rows complete (no hang or crash)    >= 98% (base 100%)

  delta gate     entry-files-clean must not drop more than 1.5 points below
                 the previous run's value ($MATRIX_PREV, written each run to
                 $MATRIX_METRICS_OUT and carried between runs by the actions
                 cache). Catches gradual erosion the absolute floors ignore.

Floors sit under the measured baselines (run 31624366070, 1,879 packs) so a
handful of broken pack HEADs cannot flip the verdict, while a frontend
regression that breaks pack integration craters them all at once. Exit
codes: 0 PASS, 1 FAIL, 2 harness failure / no rows. Row fields listed in
TELEMETRY are recorded and printed but deliberately never gated.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
from collections import Counter
from dataclasses import dataclass, field

STATUS_STAGES = ('registerNodeDef', 'registerCustomNodes')
DELTA_TOLERANCE = 1.5

FLOORS = {
    'any_loaded': 95.0,
    'entry_clean': 91.0,
    'register_node_def': 99.0,
    'register_custom_nodes': 99.0,
    'hook_free': 98.0,
    'op_clean': 99.0,
    'rows_complete': 98.0,
}

CRITERION_LABELS = {
    'any_loaded': 'entry JS loads (any entry per pack)',
    'entry_clean': 'entry files load clean',
    'register_node_def': 'registerNodeDef OK',
    'register_custom_nodes': 'registerCustomNodes OK',
    'hook_free': 'packs free of contained hook errors',
    'op_clean': 'every operation clean',
    'rows_complete': 'rows complete (no hang or crash)',
}
DELTA_CRITERION_LABEL = 'entry-clean delta vs previous run'

EXPECTED_ROW_KEYS = (
    'selfCheck',
    'vueNodesMode',
    'load',
    'loadedOk',
    'ops',
    'hookErrors',
    'registerNodeDef',
    'registerCustomNodes',
    'storeReadErrors',
    'newTypes',
    'driveTypes',
)

TELEMETRY = (
    'newTypes, driveTypes, per-op sig/depr, extension counts, no-JS skips'
)


@dataclass
class Verdict:
    code: int
    lines: list[str] = field(default_factory=list)
    breaches: list[str] = field(default_factory=list)
    metrics: dict | None = None


def _manifest_packs(manifests: dict[str, dict], key: str) -> set[str]:
    return {
        pack
        for manifest in manifests.values()
        for pack, entry in manifest.items()
        if isinstance(entry, dict) and key in entry
    }


def _named(packs: list[str], limit: int = 10) -> str:
    shown = ', '.join(packs[:limit])
    return shown + (f' (+{len(packs) - limit} more)'
                    if len(packs) > limit else '')


def evaluate(
    rows: list[dict],
    manifests: dict[str, dict],
    prev: object = None,
    run_id: str = '',
    expect_shards: int | None = None,
    stale: dict | None = None,
    renderer: str = '',
) -> Verdict:
    if not rows:
        return Verdict(2, ['no matrix rows to summarize'])

    lines: list[str] = []
    if stale:
        lines.append(
            'STALE REGISTRY AT CACHE BUILD: the corpus target list came from'
            ' the prior cached snapshot - '
            + str(stale.get('reason', 'reason not recorded'))
        )
        lines.append(
            '  every warm run over this corpus intentionally retains that'
            ' cache-build provenance and denominator.'
        )
        lines.append('')

    stubs = [r for r in rows if r.get('incomplete')]
    done = [r for r in rows if not r.get('incomplete')]

    if not done:
        lines.append(
            f'all {len(stubs)} rows are incomplete stubs - every pack hung'
            ' or crashed before measuring'
        )
        return Verdict(2, lines)

    missing_by_key = {
        key: [str(row.get('pack', '?')) for row in done if key not in row]
        for key in EXPECTED_ROW_KEYS
    }
    missing_by_key = {
        key: packs for key, packs in missing_by_key.items() if packs
    }
    if missing_by_key:
        lines.append(
            'ROW SCHEMA DRIFT: completed rows are missing fields this verdict'
            ' reads, so their rates would be vacuous rather than clean.'
        )
        for key, packs in missing_by_key.items():
            lines.append(f'  {key}: {len(packs)} row(s): {_named(packs)}')
        lines.append('')
        return Verdict(2, lines)

    if renderer:
        expected_vue_mode = renderer == 'vue'
        expected_mode_label = str(expected_vue_mode).lower()
        observed_vue_modes = Counter(
            'true'
            if row['vueNodesMode'] is True
            else 'false'
            if row['vueNodesMode'] is False
            else type(row['vueNodesMode']).__name__
            for row in done
        )
        if set(observed_vue_modes) != {expected_mode_label}:
            lines.append(
                f'RENDERER MODE MISMATCH: {renderer} expected'
                f' vueNodesMode = {expected_mode_label}, observed'
                f' {dict(sorted(observed_vue_modes.items()))}.'
                ' Verdict withheld.'
            )
            return Verdict(2, lines)
        lines.append(
            f'renderer: {renderer}'
            f' (vueNodesMode = {expected_mode_label})'
        )

    # build_matrix.py marks a pack indeterminate when it cannot tell which
    # files ComfyUI would actually serve. Those packs still run - the row is
    # kept for the artifact - but folding a guess into a compatibility rate
    # is how a measurement acquires a number it has not earned.
    unresolved = _manifest_packs(manifests, 'indeterminate')
    indeterminate = [r for r in done if r.get('pack') in unresolved]
    done = [r for r in done if r.get('pack') not in unresolved]
    if not done:
        lines.append(
            f'every one of {len(indeterminate)} completed packs is'
            ' indeterminate - nothing is left to measure'
        )
        return Verdict(2, lines)

    assisted = len(_manifest_packs(manifests, 'packSpecificRewrites'))
    skipped = len(_manifest_packs(manifests, 'skipped'))
    lines.append(
        f'packs with extension JS executed: {len(done)}'
        + (f' (no-JS packs ignored: {skipped})' if skipped else '')
        + (f' (hung or crashed: {len(stubs)})' if stubs else '')
        + (f' (indeterminate, excluded: {len(indeterminate)})'
           if indeterminate else '')
        + (f' (needed a pack-specific rewrite: {assisted})' if assisted else '')
    )

    self_ok = sum(1 for r in done if r.get('selfCheck') == 'OK')
    any_loaded = sum(1 for r in done if r.get('loadedOk'))
    total_entries = sum(len(r.get('load') or {}) for r in done)
    ok_entries = sum(
        1
        for r in done
        for v in (r.get('load') or {}).values()
        if v == 'OK'
    )
    any_pct = any_loaded / len(done) * 100
    entry_pct = ok_entries / total_entries * 100 if total_entries else 0.0
    # Indeterminate packs completed; they are excluded from compatibility
    # rates, not counted as hangs.
    complete_pct = (len(done) + len(indeterminate)) / len(rows) * 100

    lines.append(
        f'{"packs with >=1 entry loaded":28s} {any_loaded:5d} ({any_pct:5.1f}%)'
    )
    lines.append(
        f'{"entry files loaded clean":28s} {ok_entries:5d} of {total_entries}'
        f' ({entry_pct:5.1f}%)'
    )
    stage_pct = {}
    for stage in STATUS_STAGES:
        ok = sum(1 for r in done if r.get(stage) == 'OK')
        measured = sum(1 for r in done if stage in r)
        stage_pct[stage] = ok / measured * 100 if measured else 0.0
        lines.append(f'{stage:28s} {ok:5d} of {measured} OK')
    hook_packs = sum(1 for r in done if r.get('hookErrors'))
    hook_free_pct = (len(done) - hook_packs) / len(done) * 100
    lines.append(f'{"contained hook errors":28s} {hook_packs:5d} pack(s)')
    lines.append(
        f'{"harness self-check OK":28s} {self_ok:5d} of {len(done)}'
    )

    op_total: Counter = Counter()
    op_err: Counter = Counter()
    op_desync: Counter = Counter()
    op_bad: Counter = Counter()
    op_static: Counter = Counter()
    err_msgs: Counter = Counter()
    sig_hashes: dict[str, str] = {}
    op_names = sorted(
        {
            op
            for row in done
            for op in (row['ops'] if isinstance(row['ops'], dict) else {})
        }
    )
    for r in done:
        digest = hashlib.sha1()
        ops = r['ops'] if isinstance(r['ops'], dict) else {}
        for op in op_names:
            info = ops.get(op)
            op_total[op] += 1
            if not isinstance(info, dict):
                digest.update(f'{op}=<missing>'.encode())
                op_bad[op] += 1
                continue
            digest.update(f'{op}={info.get("sig", "")}'.encode())
            # A bare property write calls nothing into the app, so its error
            # arm cannot fail and must not be read as evidence of health. Its
            # desync arm still can - widget-array surgery shows up there.
            dispatching = info.get('dispatching', True)
            if not dispatching:
                op_static[op] += 1
            if info.get('err'):
                op_err[op] += 1
                err_msgs[f'{op}: {str(info["err"])[:90]}'] += 1
            if info.get('desync'):
                op_desync[op] += 1
            if (info.get('err') and dispatching) or info.get('desync'):
                op_bad[op] += 1
        sig_hashes[str(r.get('pack'))] = digest.hexdigest()[:12]
    lines.append('')
    lines.append('operation battery (packs with an error / widget desync):')
    for op in op_total:
        lines.append(
            f'  {op:18s} {op_total[op] - op_bad[op]:5d} of {op_total[op]} clean'
            + (f'   errors {op_err[op]}' if op_err[op] else '')
            + (f'   desync {op_desync[op]}' if op_desync[op] else '')
            + ('   [no dispatch: desync only]'
               if op_static[op] == op_total[op] else '')
        )
    if err_msgs:
        lines.append('')
        lines.append('most common operation errors:')
        for msg, n in err_msgs.most_common(8):
            lines.append(f'  {n:4d}x {msg}')
    lines.append('')
    lines.append(f'telemetry only - recorded, never gated: {TELEMETRY}')

    if expect_shards is not None:
        expected = _manifest_packs(manifests, 'entries')
        measured = {r.get('pack') for r in rows}
        unmeasured = sorted(expected - measured)
        unclaimed = sorted(measured - expected)
        if len(manifests) != expect_shards or unmeasured or unclaimed:
            lines.append('')
            lines.append(
                f'PARTIAL POPULATION: {len(manifests)} of {expect_shards}'
                f' shard manifests present, {len(expected)} packs expected,'
                f' {len(rows)} rows written.'
            )
            if unmeasured:
                lines.append(f'  no row for: {_named(unmeasured)}')
            if unclaimed:
                lines.append(f'  row with no manifest: {_named(unclaimed)}')
            lines.append(
                '  Every criterion is a ratio, so a dead shard PASSes on a'
                ' plausible number and then becomes the baseline the next'
                ' run is measured against. Verdict withheld.'
            )
            return Verdict(2, lines)

    if len(stubs) > len(done):
        lines.append('')
        lines.append(
            f'HARNESS FAILURE: {len(stubs)} of {len(rows)} packs left'
            ' incomplete stub rows (hung or crashed) - a majority-hang'
            ' points at the harness, not the ecosystem. Verdict withheld.'
        )
        return Verdict(2, lines)

    self_pct = self_ok / len(done) * 100
    if self_pct < 50:
        lines.append('')
        lines.append(
            f'HARNESS FAILURE: only {self_pct:.1f}% of packs passed the'
            ' runner self-check (default workflow materialized). The graph'
            ' was broadly degraded by the harness, not the ecosystem -'
            ' verdict withheld.'
        )
        return Verdict(2, lines)

    worst_op = '-'
    worst_pct = 100.0 if op_total else 0.0
    for op in op_total:
        pct = (op_total[op] - op_bad[op]) / op_total[op] * 100
        if pct < worst_pct:
            worst_op, worst_pct = op, pct

    criteria = (
        (
            CRITERION_LABELS['any_loaded'],
            any_pct,
            FLOORS['any_loaded'],
        ),
        (
            CRITERION_LABELS['entry_clean'],
            entry_pct,
            FLOORS['entry_clean'],
        ),
        (
            CRITERION_LABELS['register_node_def'],
            stage_pct['registerNodeDef'],
            FLOORS['register_node_def'],
        ),
        (
            CRITERION_LABELS['register_custom_nodes'],
            stage_pct['registerCustomNodes'],
            FLOORS['register_custom_nodes'],
        ),
        (
            CRITERION_LABELS['hook_free'],
            hook_free_pct,
            FLOORS['hook_free'],
        ),
        (
            f'{CRITERION_LABELS["op_clean"]} (worst: {worst_op})',
            worst_pct,
            FLOORS['op_clean'],
        ),
        (
            CRITERION_LABELS['rows_complete'],
            complete_pct,
            FLOORS['rows_complete'],
        ),
    )
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

    prev_entry = prev.get('entryPct') if isinstance(prev, dict) else None
    if prev is None:
        lines.append(
            f'  {DELTA_CRITERION_LABEL:42s}   n/a'
            '  (no previous metrics)'
        )
    elif isinstance(prev, dict) and run_id and prev.get('runId') == run_id:
        # A re-run restored this same run's earlier write; comparing a
        # run against itself would blind the gate exactly when someone
        # is re-running a red verdict.
        lines.append(
            f'  {DELTA_CRITERION_LABEL:42s}   n/a'
            '  (previous metrics are from this run)'
        )
    elif isinstance(prev_entry, (int, float)):
        delta = entry_pct - prev_entry
        held = delta >= -DELTA_TOLERANCE
        lines.append(
            f'  {DELTA_CRITERION_LABEL:42s} {delta:+5.1f}pp'
            f'  (floor -{DELTA_TOLERANCE}pp)  {"OK" if held else "BREACH"}'
        )
        if not held:
            breaches.append(
                f'entry files clean dropped {-delta:.1f}pp'
                f' (from {prev_entry:.1f}% to {entry_pct:.1f}%)'
            )
    else:
        lines.append(
            f'  {DELTA_CRITERION_LABEL:42s}   n/a'
            '  (previous metrics malformed)'
        )

    # Each op records a full graph signature and the criteria above read one
    # bit of it: did the call throw. A regression that changes what an
    # operation DOES without throwing - collapsed nodes that stop hiding
    # widget rows, say - moves the signature and nothing else. Reported, not
    # gated: a legitimate frontend change moves these too, so a floor here
    # would cry wolf on the diffs it is supposed to be measuring.
    prev_sigs = prev.get('sigHashes') if isinstance(prev, dict) else None
    if isinstance(prev_sigs, dict):
        shared = sig_hashes.keys() & prev_sigs.keys()
        moved = sorted(p for p in shared if sig_hashes[p] != prev_sigs[p])
        lines.append(
            f'  {"packs whose op signature moved":42s} {len(moved):5d}'
            f' of {len(shared)}  (telemetry)'
        )
        if moved:
            lines.append(f'    {_named(moved)}')

    lines.append(
        'VERDICT: ' + ('FAIL - ' + '; '.join(breaches) if breaches else 'PASS')
    )
    if breaches:
        return Verdict(1, lines, breaches)

    # Baseline-from-health: a FAILing or withheld run must not ratchet the
    # baseline down to its own eroded numbers, or next week's delta forgives
    # the regression exactly once it has become permanent.
    return Verdict(
        0,
        lines,
        [],
        {
            'packs': len(done),
            'incomplete': len(stubs),
            'anyPct': round(any_pct, 3),
            'entryPct': round(entry_pct, 3),
            'regPct': round(stage_pct['registerNodeDef'], 3),
            'customPct': round(stage_pct['registerCustomNodes'], 3),
            'hookFreePct': round(hook_free_pct, 3),
            'completePct': round(complete_pct, 3),
            'worstOp': worst_op,
            'worstOpPct': round(worst_pct, 3),
            'shardManifests': len(manifests),
            'sigHashes': sig_hashes,
            'staleRegistry': (
                str(stale.get('reason', 'unspecified')) if stale else None
            ),
            'renderer': renderer or None,
            'runId': run_id,
            'verdict': 'PASS',
        },
    )


def _read_json(path: str, label: str) -> object:
    try:
        with open(path, encoding='utf-8') as fh:
            return json.load(fh)
    except (OSError, ValueError):
        print(f'unreadable {label}: {path}', file=sys.stderr)
        return None


def main() -> int:
    out_dir = os.environ.get('MATRIX_OUT', '/tmp/matrix')
    rows: list[dict] = []
    manifests: dict[str, dict] = {}
    unreadable_rows: list[str] = []
    for name in sorted(os.listdir(out_dir) if os.path.isdir(out_dir) else []):
        if not name.endswith('.json'):
            continue
        manifest = name.startswith('_manifest')
        if name.startswith('_') and not manifest:
            continue
        label = 'shard manifest' if manifest else 'row'
        data = _read_json(os.path.join(out_dir, name), label)
        if not isinstance(data, dict):
            if data is not None:
                print(f'malformed {label}: {name}', file=sys.stderr)
            if not manifest:
                unreadable_rows.append(name)
            continue
        if manifest:
            manifests[name] = data
        else:
            rows.append(data)
    if unreadable_rows:
        print(
            f'{len(unreadable_rows)} row file(s) unreadable, so every rate'
            ' would be measured over a short denominator:'
            f' {unreadable_rows[:10]}',
            file=sys.stderr,
        )
        return 2
    if not rows:
        print(f'no matrix rows in {out_dir}', file=sys.stderr)
        return 2

    expect_raw = os.environ.get('MATRIX_EXPECT_SHARDS', '')
    if expect_raw and not expect_raw.isdigit():
        print(
            f'MATRIX_EXPECT_SHARDS is not a shard count: {expect_raw!r}',
            file=sys.stderr,
        )
        return 2

    renderer = os.environ.get('MATRIX_RENDERER', '')
    if renderer not in ('', 'legacy', 'vue'):
        print(f'MATRIX_RENDERER is invalid: {renderer!r}', file=sys.stderr)
        return 2

    prev_path = os.environ.get('MATRIX_PREV', '')
    prev = (
        _read_json(prev_path, 'previous metrics')
        if prev_path and os.path.exists(prev_path)
        else None
    )

    marker = os.environ.get('MATRIX_STALE_MARKER', '')
    stale = (
        _read_json(marker, 'stale-registry marker')
        if marker and os.path.exists(marker)
        else None
    )
    if marker and os.path.exists(marker) and not isinstance(stale, dict):
        stale = {'reason': 'marker present but unreadable'}

    verdict = evaluate(
        rows,
        manifests,
        prev,
        os.environ.get('MATRIX_RUN_ID', ''),
        int(expect_raw) if expect_raw else None,
        stale,
        renderer,
    )

    report = '\n'.join(verdict.lines)
    print(report)
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a', encoding='utf-8') as fh:
            title = 'Ecosystem matrix' + (f' ({renderer})' if renderer else '')
            fh.write(f'## {title}\n\n```\n{report}\n```\n')

    metrics_out = os.environ.get('MATRIX_METRICS_OUT', '')
    if metrics_out and verdict.metrics is not None:
        os.makedirs(os.path.dirname(metrics_out) or '.', exist_ok=True)
        with open(metrics_out, 'w', encoding='utf-8') as fh:
            json.dump(verdict.metrics, fh, indent=1)

    return verdict.code


if __name__ == '__main__':
    raise SystemExit(main())
