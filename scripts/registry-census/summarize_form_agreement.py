#!/usr/bin/env python3
"""Widget form/values agreement over the ecosystem matrix rows.

Reads the `formAgreement` / `formNodes` telemetry `matrix_runner.ts` writes at
the `serialize` op and reports a count with a class-by-class breakdown. It is
deliberately **not** a verdict: there is no floor, no baseline, no exit-1, and
`summarize_matrix.py` does not read these fields. Exit 1 here means the rows
could not be read at all, which is a harness condition, not an ecosystem one.

The thing being measured is the producer itself: the runner calls
`classifyWidgetValuesForm` from `widgetValuesForm.ts`, which declares
`widgets_values_form.order` only when it can prove it against the post-hook
serialisation, and records its suppression reason otherwise. A node carrying
a form consults no catalogue on any leg, so a wrong form is authoritative and
strictly worse than no form. That asymmetry is the whole reason this is a
breakdown rather than a pass rate:

  emitAgree*          a form is emitted and agrees              -> wanted
  decline:<reason>    no form is emitted                        -> safe, and
                                                                   the size of
                                                                   the gap
  emitDisagree*       a form is emitted and does NOT agree      -> the defect
  absent / noNamed /  the node declares no widget values, or an
  noSerialisedNode /  older shape the producer cannot consume   -> unmeasured
  decline:no_value_widgets

A run whose rows carry no form telemetry at all reports `unmeasured`, never
0 violations: a channel that stopped firing must not read as agreement.

Environment: MATRIX_OUT (row directory), GITHUB_STEP_SUMMARY (optional).
"""

from __future__ import annotations

import json
import os
import sys
from collections import Counter, defaultdict

# Every verdict string the runner can emit, grouped by what it means for the
# producer. The `decline:` members are the producer's own suppression reasons,
# so this table follows `WidgetFormSuppression` in widgetValuesForm.ts. A
# verdict outside this table is reported under `unknown` rather than silently
# folded into a bucket.
EMIT_AGREE = ('emitAgree',)
# The form agrees with the named projection an agent op sends, but the node's
# positional widgets_values is not the array it describes - a hook substituted
# it. This is the post-hook drift that made the form necessary, so it is its
# own row rather than folded into either side.
EMIT_SUBSTITUTED = (
    'emitAgree:positionalSkew',
    'emitAgree:dictValues',
    'emitAgree:noPositional',
)
EMIT_DISAGREE = ('emitDisagree:keyOrder',)
DECLINE = (
    'decline:virtual_node',
    'decline:order_names_unserialized_widget',
    'decline:declared_keys_disagree',
    'decline:hook_changed_serialized_widgets',
    'decline:value_dependent_layout',
    'decline:shell_last_serialization',
    'decline:serialization_failed',
    'decline:value_has_no_live_widget',
    'decline:unnamed_value_widget',
    'decline:duplicate_widget_name',
)
UNMEASURED = (
    'absent',
    'noNamed',
    'noSerialisedNode',
    'decline:no_value_widgets',
)
KNOWN = EMIT_AGREE + EMIT_SUBSTITUTED + EMIT_DISAGREE + DECLINE + UNMEASURED

GROUPS = (
    ('form emitted and agrees', EMIT_AGREE),
    ('form agrees, positional array substituted', EMIT_SUBSTITUTED),
    ('form emitted and DISAGREES', EMIT_DISAGREE),
    ('form declined (safe)', DECLINE),
    ('no widget values to describe', UNMEASURED),
)


def bucket(verdict: str) -> str:
    for label, members in GROUPS:
        if verdict in members:
            return label
    return 'unknown verdict'


def markdown_cell(value: object) -> str:
    return (
        str(value)
        .replace('\\', '\\\\')
        .replace('|', '\\|')
        .replace('\r', ' ')
        .replace('\n', ' ')
        .replace('<', '&lt;')
        .replace('>', '&gt;')
        .replace('`', '\\`')
    )


def read_rows(out_dir: str) -> tuple[list[dict], list[str]]:
    rows: list[dict] = []
    unreadable: list[str] = []
    for name in sorted(os.listdir(out_dir) if os.path.isdir(out_dir) else []):
        if not name.endswith('.json') or name.startswith('_'):
            continue
        try:
            with open(os.path.join(out_dir, name), encoding='utf-8') as fh:
                data = json.load(fh)
        except (OSError, ValueError):
            unreadable.append(name)
            continue
        if isinstance(data, dict):
            rows.append(data)
        else:
            unreadable.append(name)
    return rows, unreadable


def report(rows: list[dict]) -> list[str]:
    """One population table plus the per-node-class and per-pack attribution."""
    lines: list[str] = []
    done = [r for r in rows if not r.get('incomplete')]
    stubs = len(rows) - len(done)
    with_telemetry = [r for r in done if isinstance(r.get('formNodes'), list)]
    harness_errors = [
        r
        for r in done
        if isinstance(r.get('formAgreement'), dict)
        and 'harnessError' in r['formAgreement']
    ]

    lines.append(
        f'packs: {len(rows)} rows, {len(done)} complete, {stubs} stub,'
        f' {len(with_telemetry)} carrying form telemetry'
    )
    if harness_errors:
        lines.append(
            f'  {len(harness_errors)} row(s) recorded a measurement error:'
            f' {sorted({str(r["formAgreement"]["harnessError"]) for r in harness_errors})[:3]}'
        )
    if not with_telemetry:
        lines.append('')
        lines.append(
            'UNMEASURED: no row carries formNodes. The measurement channel did'
            ' not fire, so this run says nothing about agreement - it is not'
            ' zero violations.'
        )
        return lines

    discovered_types = sum(
        len(r.get('newTypes', []))
        for r in done
        if isinstance(r.get('newTypes'), list)
    )
    driven_types = sum(
        len(r.get('driveTypes', {}))
        for r in done
        if isinstance(r.get('driveTypes'), dict)
    )
    omitted_types = sum(
        value
        for r in done
        if isinstance((value := r.get('driveTypesOmitted')), int)
    )
    lines.append(
        f'frontend-only types: {discovered_types} discovered, {driven_types}'
        f' driven, {omitted_types} omitted by the per-pack safety cap'
    )

    verdicts: Counter[str] = Counter()
    by_class: dict[str, Counter[str]] = defaultdict(Counter)
    packs_by_verdict: dict[str, set[str]] = defaultdict(set)
    by_src: Counter[str] = Counter()
    grouped_by_src: dict[str, Counter[str]] = defaultdict(Counter)
    disagree_detail: list[tuple[str, str, str, dict]] = []

    for row in with_telemetry:
        pack = str(row.get('pack', '?'))
        for node in row['formNodes']:
            if not isinstance(node, dict):
                continue
            verdict = str(node.get('v', 'unknown'))
            node_class = str(node.get('t', '?'))
            src = str(node.get('src', 'unknown'))
            verdicts[verdict] += 1
            by_class[node_class][verdict] += 1
            packs_by_verdict[verdict].add(pack)
            by_src[src] += 1
            grouped_by_src[src][bucket(verdict)] += 1
            if verdict in EMIT_DISAGREE:
                disagree_detail.append((pack, node_class, verdict, node))

    total = sum(verdicts.values())
    if not total:
        lines.append('')
        lines.append(
            'UNMEASURED: no row carries a measured node. The measurement'
            ' channel did not fire, so this run says nothing about agreement.'
        )
        return lines
    # `battery` nodes are the default workflow seen through the pack's hooks;
    # `driven` nodes are the pack's own registered classes, which is where a
    # custom serializer lives. Reporting one number over both would let a large
    # clean battery arm bury the arm that can actually carry a bad form.
    srcs = ', '.join(f'{src} {n}' for src, n in by_src.most_common())
    lines.append(f'nodes measured: {total} ({srcs})')
    lines.append('')

    grouped: dict[str, int] = defaultdict(int)
    for verdict, count in verdicts.items():
        grouped[bucket(verdict)] += count
    src_cols = [src for src, _ in by_src.most_common()]
    header = ' | '.join(src_cols)
    lines.append(f'| outcome | nodes | share | {header} |')
    lines.append('| --- | --- | --- |' + ' --- |' * len(src_cols))
    for label, _ in GROUPS + (('unknown verdict', ()),):
        count = grouped.get(label, 0)
        if not count and label == 'unknown verdict':
            continue
        cells = ' | '.join(
            str(grouped_by_src[src].get(label, 0)) for src in src_cols
        )
        lines.append(
            f'| {label} | {count} | {100 * count / total:.2f}% | {cells} |'
        )
    lines.append('')

    lines.append('| verdict | nodes | packs | node classes |')
    lines.append('| --- | --- | --- | --- |')
    for verdict, count in verdicts.most_common():
        classes = sorted(c for c, v in by_class.items() if v.get(verdict))
        shown = ', '.join(markdown_cell(c) for c in classes[:6])
        if len(classes) > 6:
            shown += f' (+{len(classes) - 6})'
        lines.append(
            f'| `{markdown_cell(verdict)}` | {count} | {len(packs_by_verdict[verdict])}'
            f' | {shown} |'
        )
    lines.append('')

    lines.append('| node class | nodes | verdicts |')
    lines.append('| --- | --- | --- |')
    for node_class in sorted(by_class, key=lambda c: -sum(by_class[c].values())):
        counts = by_class[node_class]
        detail = ', '.join(
            f'`{markdown_cell(v)}`×{n}' for v, n in counts.most_common()
        )
        lines.append(
            f'| {markdown_cell(node_class)} | {sum(counts.values())} | {detail} |'
        )
    lines.append('')

    if disagree_detail:
        lines.append(
            f'DISAGREEING FORMS: {len(disagree_detail)} node(s) across'
            f' {len({p for p, _, _, _ in disagree_detail})} pack(s). Each one'
            ' is a form that would be emitted and would be wrong.'
        )
        lines.append('')
        lines.append(
            '| pack | node class | arm | verdict | order | keys | widgets |'
            ' positional |'
        )
        lines.append('| --- | --- | --- | --- | --- | --- | --- | --- |')
        for pack, node_class, verdict, node in sorted(
            disagree_detail, key=lambda detail: detail[:3]
        )[:200]:
            lines.append(
                f'| `{markdown_cell(pack)}` | {markdown_cell(node_class)}'
                f' | {markdown_cell(node.get("src"))}'
                f' | `{markdown_cell(verdict)}`'
                f' | {node.get("o")} | {node.get("k")} | {node.get("w")}'
                f' | {node.get("a")} |'
            )
        if len(disagree_detail) > 200:
            lines.append(f'| … | +{len(disagree_detail) - 200} more | | | | | | |')
    elif not harness_errors and grouped.get('unknown verdict', 0) == 0:
        lines.append(
            'No disagreeing form in this population. Every node either emits a'
            ' form that agrees or declines to emit one.'
        )
    else:
        lines.append(
            'No disagreeing form was observed, but measurement errors or'
            ' unknown verdicts prevent a clean conclusion.'
        )
    return lines


def main() -> int:
    out_dir = os.environ.get('MATRIX_OUT', '/tmp/matrix')
    rows, unreadable = read_rows(out_dir)
    if unreadable:
        print(
            f'{len(unreadable)} row file(s) unreadable, so every share would be'
            f' measured over a short denominator: {unreadable[:10]}',
            file=sys.stderr,
        )
        return 1
    if not rows:
        print(f'no matrix rows in {out_dir}', file=sys.stderr)
        return 1

    lines = report(rows)
    text = '\n'.join(lines)
    print(text)
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a', encoding='utf-8') as fh:
            fh.write('## Widget form/values agreement\n\n')
            fh.write(text + '\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
