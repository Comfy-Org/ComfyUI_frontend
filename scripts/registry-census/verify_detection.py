#!/usr/bin/env python3
"""Detection proof: assert every poison pack tripped its designated channel.

Counter-evidence for the ecosystem matrix. detection-proof/corpus/ holds one
synthetic pack per measurement channel, each broken in exactly one way. After
running the matrix over it (CENSUS_ROOT=scripts/registry-census/detection-proof),
this script fails unless every channel fired with its exact poison message,
the clean control stayed fully clean, and every spec still wrote its row.
The workflow pairs it with summarize_matrix.py, which must exit FAIL on this
corpus - a green weekly verdict is only meaningful if poison reliably reds it.
"""

from __future__ import annotations

import json
import os
import sys

FIXTURE_CORPUS = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    'detection-proof', 'corpus', 'registry_js',
)


def expected_packs() -> int:
    if os.path.isdir(FIXTURE_CORPUS):
        return sum(
            1
            for d in os.listdir(FIXTURE_CORPUS)
            if os.path.isdir(os.path.join(FIXTURE_CORPUS, d))
        )
    return 9


def main() -> int:
    out = os.environ.get('MATRIX_OUT', '/tmp/matrix')
    rows: dict[str, dict] = {}
    for name in os.listdir(out) if os.path.isdir(out) else []:
        if not name.endswith('.json') or name.startswith('_'):
            continue
        try:
            r = json.load(open(os.path.join(out, name)))
            rows[r['pack']] = r
        except (OSError, ValueError, KeyError, TypeError):
            # The harness-integrity check below reports the shortfall; a
            # malformed row must not kill the reporter that exists to name it.
            print(f'  unreadable row: {name}', file=sys.stderr)

    failures: list[str] = []

    def check(label: str, fired: bool) -> None:
        print(f'  {"PASS" if fired else "MISS"}  {label}')
        if not fired:
            failures.append(label)

    def ops(pack: str) -> dict:
        return rows.get(pack, {}).get('ops') or {}

    def hook_errors(pack: str) -> list[str]:
        return rows.get(pack, {}).get('hookErrors') or []

    expected = expected_packs()
    print('detection proof over', out)
    check(
        f'harness integrity: {len(rows)}/{expected} rows written'
        ' despite universal breakage',
        len(rows) == expected,
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
    if failures:
        print(f'DETECTION PROOF FAILED: {len(failures)} channel(s) silent')
        return 1
    print(
        f'DETECTION PROOF PASSED: every channel fired, control clean,'
        f' {len(rows)}/{expected} rows'
    )
    return 0


if __name__ == '__main__':
    sys.exit(main())
