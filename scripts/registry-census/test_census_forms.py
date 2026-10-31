import contextlib
import io
import json
import os
import tempfile
import unittest

import census_forms as cf


def row(name, **fields):
    return dict(pack=name, safe=name, **fields)


def baseline(**over):
    base = {
        'source': '/x/object_info.shape.json',
        'classes': 3,
        'registered': 3,
        'registerErrors': [],
        'histogram': {'provable': 2, 'widgets_not_serialized': 1},
        'refusals': {'C': 'widgets_not_serialized'},
        'needsForm': [],
        'byModule': {'nodes': [2, 3]},
        'digest': 'base',
        'subgraph': [{
            'scenario': 'promoted-only',
            'verdict': 'class_may_rewrite_payload',
            'coreIsLastWriter': False,
            'widgets': 1,
            'ifAssumedFinal': 'values_replaced',
            'ifAssumedFinalAtHookSite': 'provable',
            'wrongOrder': ['text'],
            'finalValues': [''],
        }],
        'prototypePatched': {'serialize': False, 'serializeFromStoreState': False},
        'hookErrors': [],
    }
    base.update(over)
    return base


@contextlib.contextmanager
def rows_dir(rows):
    with tempfile.TemporaryDirectory() as d:
        for r in rows:
            with open(os.path.join(d, f"{r['safe']}.json"), 'w') as fh:
                json.dump(r, fh)
        yield d


def report(rows):
    with rows_dir(rows) as d:
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            b, packs, stubs, missing = cf.read_rows(d)
            cf.report_registry(b, packs)
            cf.report_pack_local(packs)
        return out.getvalue(), stubs, missing


class ReadRows(unittest.TestCase):
    def test_baseline_is_not_counted_as_a_pack(self):
        rows = [row(cf.BASELINE_PACK, registryForms=baseline()),
                row('p', registryForms=baseline(), formProof={'graph': {}})]
        with rows_dir(rows) as d:
            b, packs, stubs, missing = cf.read_rows(d)
        self.assertIsNotNone(b)
        self.assertEqual([p['pack'] for p in packs], ['p'])
        self.assertEqual((stubs, missing), (0, 0))

    def test_stubs_and_channel_less_rows_are_separated_not_dropped(self):
        rows = [row('hung', incomplete=True), row('old', ops={})]
        with rows_dir(rows) as d:
            _, packs, stubs, missing = cf.read_rows(d)
        self.assertEqual((len(packs), stubs, missing), (0, 1, 1))


class RegistryDelta(unittest.TestCase):
    def test_a_pack_that_changes_nothing_is_reported_as_agreeing(self):
        text, _, _ = report([
            row(cf.BASELINE_PACK, registryForms=baseline()),
            row('quiet', registryForms=baseline(), formProof={'graph': {}}),
        ])
        self.assertIn('that changed NO class verdict:        1', text)
        self.assertIn('no pack changed any class verdict.', text)

    def test_a_pack_that_breaks_a_class_is_named_with_its_verdict(self):
        broken = baseline(
            digest='other',
            refusals={'C': 'widgets_not_serialized', 'A': 'values_replaced'},
            histogram={'provable': 1, 'widgets_not_serialized': 1,
                       'values_replaced': 1},
        )
        text, _, _ = report([
            row(cf.BASELINE_PACK, registryForms=baseline()),
            row('breaker', registryForms=broken, formProof={'graph': {}}),
        ])
        self.assertIn('provable -> values_replaced', text)
        self.assertIn('breaker', text)

    def test_a_pack_that_makes_a_refused_class_provable_is_also_named(self):
        fixed = baseline(digest='other', refusals={},
                         histogram={'provable': 3})
        text, _, _ = report([
            row(cf.BASELINE_PACK, registryForms=baseline()),
            row('fixer', registryForms=fixed, formProof={'graph': {}}),
        ])
        self.assertIn('widgets_not_serialized -> provable', text)
        self.assertIn('fixer', text)

    def test_missing_baseline_says_so_rather_than_reporting_zero(self):
        text, _, _ = report([
            row('p', registryForms=baseline(), formProof={'graph': {}})
        ])
        self.assertIn('NO BASELINE ROW', text)

    def test_prototype_patchers_and_hook_errors_are_surfaced(self):
        patched = baseline(
            prototypePatched={'serialize': True,
                              'serializeFromStoreState': False},
            hookErrors=['Error calling extension boom'],
        )
        text, _, _ = report([
            row(cf.BASELINE_PACK, registryForms=baseline()),
            row('patcher', registryForms=patched, formProof={'graph': {}}),
        ])
        self.assertIn("reassigned a prototype serialization entry point: 1", text)
        self.assertIn('1 distinct  patcher', text)


class Tables(unittest.TestCase):
    def test_every_predicate_refusal_is_printed_even_at_zero(self):
        text, _, _ = report([
            row(cf.BASELINE_PACK, registryForms=baseline()),
            row('p', registryForms=baseline(),
                formProof={'graph': {'K#1': 'provable'}, 'driven': {}}),
        ])
        for refusal in cf.PREDICATE_REFUSALS:
            self.assertIn(refusal, text)

    def test_an_unknown_verdict_is_flagged_not_absorbed(self):
        text, _, _ = report([
            row(cf.BASELINE_PACK, registryForms=baseline()),
            row('p', registryForms=baseline(),
                formProof={'graph': {'K#1': 'brand_new_refusal'},
                               'driven': {}}),
        ])
        self.assertIn('UNKNOWN verdict', text)
        self.assertIn('brand_new_refusal', text)

    def test_failed_measurement_is_counted_separately_from_a_clean_row(self):
        text, _, _ = report([
            row(cf.BASELINE_PACK, registryForms=baseline()),
            row('sad', registryForms=baseline(digest='x', err='boom'),
                formProof={'err': 'boom'}),
        ])
        self.assertIn('measurement failed on 1 packs', text)


if __name__ == '__main__':
    unittest.main()
