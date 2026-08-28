#!/usr/bin/env python3
"""Detection proof: every poison pack must trip, and gate, its own channel.

Counter-evidence for the ecosystem matrix. detection-proof/corpus/ holds one
synthetic pack per measurement channel, each broken in exactly one way. After
running the matrix over it (CENSUS_ROOT=scripts/registry-census/detection-proof),
this script asserts two things:

  observation  each channel recorded its exact poison message, the clean
               controls stayed clean, and every spec still wrote its row.

  gating       summarize_matrix.evaluate() over that one poison row plus the
               clean controls breaches the criterion the pack targets, and
               names it. Observation alone is not a proof: the workflow's
               other leg only requires the COMBINED verdict to be FAIL, so a
               channel can be certified as fired while contributing nothing
               to the judgment, and one surviving poison keeps the aggregate
               red while another channel quietly goes dead.
"""

from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from summarize_matrix import (  # noqa: E402
    CRITERION_LABELS,
    DELTA_CRITERION_LABEL,
    Verdict,
    evaluate,
)

FIXTURE_CORPUS = os.path.join(HERE, 'detection-proof', 'corpus', 'registry_js')

CONTROLS = ('clean-control', 'clean-mjs-control', 'clean-asset-control')

# The PASS criterion each poison pack exists to breach, by the label
# summarize_matrix.evaluate() reports it under. A poison pack with no entry
# here fails the coverage leg below, so a new channel cannot be added as
# observation-only. The two hook poisons share a criterion because the app
# contains both throws (registerNodeDef/registerCustomNodes stay OK) - they
# still test different dispatch points, since a dispatch that stopped firing
# would empty hookErrors and stop the breach.
GATES = {
    'poison-load-throw': (
        CRITERION_LABELS['any_loaded'],
        CRITERION_LABELS['entry_clean'],
    ),
    'poison-regdef-throw': (CRITERION_LABELS['hook_free'],),
    'poison-customnodes-throw': (CRITERION_LABELS['hook_free'],),
    'poison-op-break': (CRITERION_LABELS['op_clean'],),
    'poison-serialize-throw': (CRITERION_LABELS['op_clean'],),
    'poison-desync': (CRITERION_LABELS['op_clean'],),
    'poison-foreign-widget': (CRITERION_LABELS['op_clean'],),
    'poison-store-read-throw': (CRITERION_LABELS['op_clean'],),
}

PROOF_EXEMPTIONS = {
    CRITERION_LABELS['register_node_def']: (
        'pack hook failures are contained before this service status; verdict'
        ' sensitivity is unit-tested'
    ),
    CRITERION_LABELS['register_custom_nodes']: (
        'pack hook failures are contained before this service status; verdict'
        ' sensitivity is unit-tested'
    ),
    CRITERION_LABELS['rows_complete']: (
        'a deliberately hung pack would consume the worker timeout; stub'
        ' sensitivity is unit-tested'
    ),
    DELTA_CRITERION_LABEL: (
        'requires a prior baseline rather than a poison pack; baseline'
        ' sensitivity is unit-tested'
    ),
}


def corpus_packs() -> list[str]:
    if not os.path.isdir(FIXTURE_CORPUS):
        sys.exit(
            f'poison corpus missing: {FIXTURE_CORPUS} - without it the proof'
            ' has no population and no idea how many channels exist'
        )
    return sorted(
        d
        for d in os.listdir(FIXTURE_CORPUS)
        if os.path.isdir(os.path.join(FIXTURE_CORPUS, d))
    )


def outcome(verdict: Verdict) -> str:
    if verdict.code == 2:
        return 'verdict withheld (exit 2)'
    if not verdict.breaches:
        return 'verdict PASS - no criterion covers this channel'
    return 'breached instead: ' + '; '.join(verdict.breaches)


def main() -> int:
    out = os.environ.get('MATRIX_OUT', '/tmp/matrix')
    rows: dict[str, dict] = {}
    for name in os.listdir(out) if os.path.isdir(out) else []:
        if not name.endswith('.json') or name.startswith('_'):
            continue
        try:
            with open(os.path.join(out, name), encoding='utf-8') as fh:
                r = json.load(fh)
            rows[r['pack']] = r
        except (OSError, ValueError, KeyError, TypeError):
            # The harness-integrity check below reports the shortfall; a
            # malformed row must not kill the reporter that exists to name it.
            print(f'  unreadable row: {name}', file=sys.stderr)

    failures: list[str] = []

    def check(label: str, fired: bool, detail: str = '') -> None:
        print(f'  {"PASS" if fired else "MISS"}  {label}'
              + (f'   [{detail}]' if detail else ''))
        if not fired:
            failures.append(label)

    def ops(pack: str) -> dict:
        return rows.get(pack, {}).get('ops') or {}

    def hook_errors(pack: str) -> list[str]:
        return rows.get(pack, {}).get('hookErrors') or []

    packs = corpus_packs()
    print('detection proof over', out)
    print('observation - every channel must record its own breakage:')
    check(
        f'harness integrity: {len(rows)}/{len(packs)} rows written'
        ' despite universal breakage',
        len(rows) == len(packs),
    )

    check(
        'entry-load: an .mjs entry loads (glob covers both extensions)',
        rows.get('clean-mjs-control', {}).get('loadedOk') == 1,
    )
    check(
        'entry-load: an asset-importing entry loads (css/json ship in'
        ' the corpus)',
        rows.get('clean-asset-control', {}).get('loadedOk') == 1,
    )

    loader = rows.get('poison-load-throw', {})
    check('entry-load: loadedOk drops to 0', loader.get('loadedOk') == 0)
    check(
        'entry-load: exact poison message recorded in the load map',
        any(
            'poison: entry module throws' in v
            for v in (loader.get('load') or {}).values()
        ),
    )

    check(
        'contained-hook: beforeRegisterNodeDef throw lands in hookErrors',
        any(
            'poison: beforeRegisterNodeDef throws' in h
            for h in hook_errors('poison-regdef-throw')
        ),
    )
    check(
        'contained-hook: registerNodeDef field stays OK (app containment,'
        ' not a service failure)',
        rows.get('poison-regdef-throw', {}).get('registerNodeDef') == 'OK',
    )
    check(
        'contained-hook: registerCustomNodes throw lands in hookErrors',
        any(
            'poison: registerCustomNodes throws' in h
            for h in hook_errors('poison-customnodes-throw')
        ),
    )

    check(
        'operation: load op err carries the poison',
        'poison: onNodeCreated throws'
        in (ops('poison-op-break').get('load') or {}).get('err', ''),
    )
    check(
        'operation: addNode op err carries the poison',
        'poison: onNodeCreated throws'
        in (ops('poison-op-break').get('addNode') or {}).get('err', ''),
    )
    check(
        'serialize: serialize op err carries the poison',
        'poison: onSerialize throws'
        in (ops('poison-serialize-throw').get('serialize') or {}).get('err', ''),
    )
    check(
        'foreign-widget: prototype method loss is recorded despite the'
        ' mangled-row exclusion',
        (ops('poison-foreign-widget').get('wPushForeignClass') or {}).get(
            'err', ''
        )
        == 'Error: foreign widget prototype methods lost:'
        ' draw,mouse,computeSize',
    )

    check(
        'self-check: op-break degraded graph trips the runner self-check',
        rows.get('poison-op-break', {}).get('selfCheck', 'OK') != 'OK',
    )
    check(
        'self-check: clean control passes the runner self-check',
        rows.get('clean-control', {}).get('selfCheck') == 'OK',
    )

    check(
        'signature: ghost widget recorded in the load signature',
        'poison_ghost=GHOST'
        in (ops('poison-desync').get('load') or {}).get('sig', ''),
    )
    check(
        'signature: ghost absent from the clean control',
        'poison_ghost'
        not in (ops('clean-control').get('load') or {}).get('sig', ''),
    )
    # The signature legs above are built from live node.widgets and hold
    # whether or not the store comparator ran, which is how the comparator
    # stayed dead through a green proof. These two read the comparator's own
    # output, so it cannot be silently disabled again.
    check(
        'desync: the store comparator itself fires on the poison',
        bool((ops('poison-desync').get('load') or {}).get('desync')),
    )
    check(
        'desync: the store comparator stays silent on the clean control',
        rows.get('clean-control', {}).get('storeMeasured') is True
        and rows.get('clean-control', {}).get('storeReadErrors') == 0
        and not any(
            v.get('desync') for v in ops('clean-control').values()
        ),
    )
    check(
        'store-read: a thrown store read is counted',
        rows.get('poison-store-read-throw', {}).get('storeReadErrors', 0) > 0,
    )
    check(
        'store-read: a thrown store read makes its operation unclean',
        bool(
            (ops('poison-store-read-throw').get('load') or {}).get('desync')
        ),
    )

    control = rows.get('clean-control', {})
    check(
        'specificity: clean control is fully clean',
        control.get('loadedOk') == 1
        and control.get('registerNodeDef') == 'OK'
        and control.get('registerCustomNodes') == 'OK'
        and not any(v.get('err') for v in ops('clean-control').values())
        and not any('poison' in h for h in hook_errors('clean-control')),
    )

    print()
    print('gating - each channel must breach the criterion it targets:')
    unmapped = sorted(set(packs) - set(CONTROLS) - set(GATES))
    check(
        'coverage: every poison pack names the criterion it must breach',
        not unmapped,
        'unmapped: ' + ', '.join(unmapped) if unmapped else '',
    )
    all_criteria = set(CRITERION_LABELS.values()) | {DELTA_CRITERION_LABEL}
    poison_criteria = {
        label for labels in GATES.values() for label in labels
    }
    uncovered = sorted(
        all_criteria - poison_criteria - set(PROOF_EXEMPTIONS)
    )
    unknown_exemptions = sorted(set(PROOF_EXEMPTIONS) - all_criteria)
    coverage_detail = []
    if uncovered:
        coverage_detail.append('uncovered: ' + ', '.join(uncovered))
    if unknown_exemptions:
        coverage_detail.append(
            'unknown exemptions: ' + ', '.join(unknown_exemptions)
        )
    check(
        'coverage: every gated criterion has poison counter-evidence or an'
        ' explicit exemption',
        not coverage_detail,
        '; '.join(coverage_detail),
    )
    for label, reason in PROOF_EXEMPTIONS.items():
        print(f'  EXEMPT  {label}   [{reason}]')

    # Each poison is judged over its own row plus the clean controls: a
    # one-row population trips the self-check harness gate, which withholds
    # the verdict (exit 2) before any criterion is reached. The controls give
    # that gate a healthy majority, so only the poison can breach.
    controls = [rows[c] for c in CONTROLS if c in rows]
    baseline = evaluate(controls, {})
    check(
        'control: the clean controls alone return PASS',
        baseline.code == 0,
        '' if baseline.code == 0 else outcome(baseline),
    )

    for poison, labels in sorted(GATES.items()):
        if poison not in rows:
            for label in labels:
                check(f'gating: {poison} breaches "{label}"', False, 'no row')
            continue
        verdict = evaluate([*controls, rows[poison]], {})
        for label in labels:
            breach = next(
                (b for b in verdict.breaches if b.startswith(label)), ''
            )
            # Attribution: the criterion has to be clean without the poison, or
            # the breach says nothing about the channel this pack injects.
            if any(b.startswith(label) for b in baseline.breaches):
                breach = ''
                detail = 'the clean controls already breach this criterion'
            else:
                detail = breach or outcome(verdict)
            check(f'gating: {poison} breaches "{label}"', bool(breach), detail)

    print()
    if failures:
        print(f'DETECTION PROOF FAILED: {len(failures)} channel(s) silent')
        return 1
    print(
        'DETECTION PROOF PASSED: every channel fired and gated its own'
        f' criterion, control clean, {len(rows)}/{len(packs)} rows'
    )
    return 0


if __name__ == '__main__':
    sys.exit(main())
