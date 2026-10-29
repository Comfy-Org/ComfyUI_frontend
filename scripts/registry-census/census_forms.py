"""Report the `widgets_values_form` population over a directory of matrix rows.

Two populations, and conflating them is the mistake this script exists to make
impossible:

  REGISTRY CLASSES   every class in `object_info.shape.json`, instantiated and
                     proven once with no pack code loaded (`registryForms` on
                     the `_registry-baseline` row). This is the denominator for
                     "how much of the registry would a form cover".

  PACK EFFECT        the same sweep re-run inside each pack's process, reported
                     as the DELTA against that baseline. A pack that changes no
                     class's verdict contributes nothing, which is the answer
                     for almost all of them, and the ones that do are named.

Plus the pack-local channel the first census had: `formAgreement`, over the
battery's standard-workflow nodes and each pack's own frontend-registered node
types.

Reporting only. Nothing here gates: a refusal is `proveWidgetForm` working as
designed on a shape it was built to decline, so a floor would fail the run for
correct behaviour.

Usage:
    python3 scripts/registry-census/census_forms.py <rows-dir> [--json out.json]
"""

import argparse
import collections
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BASELINE_PACK = '_registry-baseline'
PIN = os.path.join(HERE, 'object_info.pin.json')

# Every verdict `matrix_runner.ts` can write. Listed so a verdict the predicate
# renames shows up as an unknown key instead of silently vanishing from a
# percentage, and so a refusal that fired ZERO times is still printed -- a zero
# is a finding, and an absent row reads as an unasked question.
PREDICATE_REFUSALS = (
    'class_may_rewrite_payload',
    'replayed_serialization',
    'widgets_not_serialized',
    'values_replaced',
    'values_not_positional',
    'length_mismatch',
    'duplicate_widget_name',
    'unnameable_widget',
)
HARNESS_VERDICTS = ('!serialize_threw', '!createNode_null', '!no_refusal_named')
ALL_VERDICTS = ('provable', *PREDICATE_REFUSALS, *HARNESS_VERDICTS)


def read_rows(rows_dir: str):
    """Rows, split into the baseline row and the pack rows."""
    baseline, packs, stubs, missing = None, [], 0, 0
    for path in sorted(glob.glob(os.path.join(rows_dir, '*.json'))):
        try:
            with open(path, encoding='utf-8') as fh:
                row = json.load(fh)
        except Exception:
            continue
        if row.get('pack') == BASELINE_PACK:
            baseline = row.get('registryForms')
            continue
        if row.get('incomplete'):
            stubs += 1
            continue
        if 'formAgreement' not in row and 'registryForms' not in row:
            missing += 1
            continue
        packs.append(row)
    return baseline, packs, stubs, missing


def table(title, counter, note=''):
    total = sum(counter.values())
    print(f'\n{title}: {total} verdicts{note}')
    if not total:
        print('  (none)')
        return
    seen = set(counter)
    for key in ALL_VERDICTS:
        n = counter.get(key, 0)
        if n or key in PREDICATE_REFUSALS:
            print(f'  {n:8d}  {n / total * 100:6.2f}%  {key}')
        seen.discard(key)
    for key in sorted(seen):
        print(f'  {counter[key]:8d}  {counter[key] / total * 100:6.2f}%'
              f'  {key}  <-- UNKNOWN verdict, not in this script\'s union')


def report_registry(baseline, packs):
    """The class census, and each pack's delta against it."""
    if not baseline:
        print('\nNO BASELINE ROW. Run the baseline census first:')
        print('  npx vitest run --config vitest.census.config.mts')
        print('...then point this script at a directory holding both.')
        return
    if baseline.get('err'):
        print(f"\nBASELINE MEASUREMENT FAILED: {baseline['err']}")
        return

    pin = {}
    if os.path.exists(PIN):
        with open(PIN, encoding='utf-8') as fh:
            pin = json.load(fh)
    pop = pin.get('population', {})
    hist = collections.Counter(baseline['histogram'])
    total = sum(hist.values())
    provable = hist.get('provable', 0)
    print('=' * 74)
    print('REGISTRY CLASSES  (no pack code loaded)')
    print('=' * 74)
    print(f"  source       {baseline['source']}")
    print(f"  classes      {baseline['classes']} "
          f"({pop.get('coreClasses', '?')} core, {pop.get('packClasses', '?')}"
          f" from {pop.get('packs', '?')} packs)")
    print(f"  registered   {baseline['registered']}"
          f"  ({len(baseline['registerErrors'])} registration errors)")
    print(f"  provable     {provable} of {total}"
          f"  ({provable / total * 100:.2f}%)" if total else '  provable 0')
    table('VERDICTS over registry classes', hist)
    print(f"\n  needsFormButHasNone fired: {len(baseline['needsForm'])}"
          f"  {baseline['needsForm'][:10]}")
    print(f"  prototype serialization patched: {baseline['prototypePatched']}")

    print('\nSubgraphNode (built through LGraph.convertToSubgraph):')
    for probe in baseline.get('subgraph') or []:
        if probe.get('err'):
            print(f"  {probe.get('scenario')}: MEASUREMENT FAILED {probe['err']}")
            continue
        print(f"  {probe['scenario']}:")
        print(f"    verdict                  {probe['verdict']}")
        print(f"    coreIsLastWriter         {probe['coreIsLastWriter']}")
        print(f"    host widgets             {probe['widgets']}")
        print(f"    if assumed final, here   {probe['ifAssumedFinal']}")
        print(f"    if assumed final, at the hook site"
              f"   {probe['ifAssumedFinalAtHookSite']}")
        print(f"    order that would publish {json.dumps(probe['wrongOrder'])}")
        print(f"    values actually written  {json.dumps(probe['finalValues'])}")

    # Pack effect: the delta against the baseline, per class.
    base_verdicts = dict.fromkeys(baseline['refusals'], None)
    base_verdicts.update(baseline['refusals'])
    changed = collections.defaultdict(list)
    measured, agreeing, failed = 0, 0, []
    for row in packs:
        forms = row.get('registryForms')
        if not forms:
            continue
        if forms.get('err'):
            failed.append((row['pack'], forms['err']))
            continue
        measured += 1
        if forms['digest'] == baseline['digest']:
            agreeing += 1
            continue
        # Only classes whose verdict differs. A pack that merely refuses the
        # same 643 classes the baseline refuses has changed nothing.
        for cls, verdict in forms['refusals'].items():
            if base_verdicts.get(cls) != verdict:
                changed[(cls, verdict)].append(row['pack'])
        for cls, verdict in baseline['refusals'].items():
            if forms['refusals'].get(cls) != verdict:
                changed[(cls, f'{verdict} -> provable')].append(row['pack'])

    print('\n' + '=' * 74)
    print('PACK EFFECT on those classes  (delta vs the baseline above)')
    print('=' * 74)
    print(f'  packs whose sweep was measured:          {measured}')
    print(f'  ...that changed NO class verdict:        {agreeing}')
    print(f'  ...that changed at least one:            {measured - agreeing}')
    if failed:
        print(f'  measurement failed on {len(failed)} packs: {failed[:5]}')
    if not changed:
        print('  no pack changed any class verdict.')
    for (cls, verdict), who in sorted(
        changed.items(), key=lambda kv: (-len(kv[1]), kv[0])
    ):
        print(f'  {len(who):5d} packs  {cls} -> {verdict}')
        print(f'             {sorted(who)[:8]}')

    hooks = [(r['pack'], len(r['registryForms']['hookErrors'])) for r in packs
             if r.get('registryForms', {}).get('hookErrors')]
    print(f'\n  packs whose hooks errored while registering the real defs:'
          f' {len(hooks)} of {measured}')
    for pack, n in sorted(hooks, key=lambda kv: -kv[1])[:10]:
        print(f'    {n:4d} distinct  {pack}')
    patched = [r['pack'] for r in packs
               if any(r.get('registryForms', {}).get('prototypePatched', {}).values())]
    print(f'  packs that reassigned a prototype serialization entry point:'
          f' {len(patched)} {sorted(patched)[:10]}')


def report_pack_local(packs):
    """`formAgreement`: the battery's workflow nodes and packs' own types."""
    graph = collections.Counter()
    driven = collections.Counter()
    failed, needs_form = [], []
    pack_refusals = collections.defaultdict(set)
    for row in packs:
        agreement = row.get('formAgreement')
        if not agreement:
            continue
        if agreement.get('err'):
            failed.append(row['pack'])
            continue
        g = agreement.get('graph') or {}
        d = agreement.get('driven') or {}
        graph.update(g.values())
        driven.update(d.values())
        for verdict in set(g.values()) | set(d.values()):
            if verdict not in ('provable', 'widgets_not_serialized'):
                pack_refusals[verdict].add(row['pack'])
        if agreement.get('needsForm'):
            needs_form.append(row['pack'])

    print('\n' + '=' * 74)
    print('PACK-LOCAL CHANNEL  (formAgreement, as the first census measured it)')
    print('=' * 74)
    print(f'  measurement failed on {len(failed)} packs {failed[:5]}')
    table('STANDARD-WORKFLOW NODES, post-battery', graph)
    table("PACKS' OWN FRONTEND-REGISTERED NODE TYPES", driven)
    print(f'\n  packs with object-shaped values and no form: {len(needs_form)}'
          f' {sorted(needs_form)[:10]}')
    print('\n  packs affected, per refusal:')
    if not pack_refusals:
        print('    (none)')
    for verdict, who in sorted(pack_refusals.items(), key=lambda kv: -len(kv[1])):
        print(f'    {len(who):5d}  {verdict}  {sorted(who)[:8]}')


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('rows', help='directory of per-pack row JSON')
    ap.add_argument('--json', default='', help='also write the summary as JSON')
    args = ap.parse_args()

    baseline, packs, stubs, missing = read_rows(args.rows)
    print(f'rows: {len(packs)} packs'
          f'  (stubs {stubs}, missing both channels {missing},'
          f" baseline {'present' if baseline else 'MISSING'})")
    report_registry(baseline, packs)
    report_pack_local(packs)
    if args.json:
        with open(args.json, 'w', encoding='utf-8') as fh:
            json.dump(
                {
                    'packs': len(packs),
                    'stubs': stubs,
                    'baseline': baseline,
                    'packDigests': collections.Counter(
                        r['registryForms']['digest']
                        for r in packs
                        if r.get('registryForms', {}).get('digest')
                    ),
                },
                fh,
                indent=1,
            )
    return 0


if __name__ == '__main__':
    sys.exit(main())
