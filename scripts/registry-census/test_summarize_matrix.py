#!/usr/bin/env python3
"""Unit tests for the ecosystem-matrix verdict.

    python3 -m unittest discover -s scripts/registry-census

summarize_matrix.evaluate() is the gate: it decides whether a run
reads as PASS, as an ecosystem FAIL, or as a withheld harness failure.
Everything asserted here was previously asserted only by running the whole
matrix workflow against the poison corpus.
"""

from __future__ import annotations

import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import summarize_matrix as sm


def row(pack: str, **over: object) -> dict:
    base: dict = {
        'pack': pack,
        'selfCheck': 'OK',
        'vueNodesMode': False,
        'load': {'./a.js': 'OK', './b.js': 'OK'},
        'loadedOk': 2,
        'registerNodeDef': 'OK',
        'registerCustomNodes': 'OK',
        'storeReadErrors': 0,
        'newTypes': [],
        'driveTypes': {},
        'hookErrors': [],
        'ops': {'load': {'err': '', 'sig': '{}', 'depr': '', 'desync': ''}},
    }
    base.update(over)
    return base


def population(n: int = 100) -> list[dict]:
    return [row(f'pack-{i:03d}') for i in range(n)]


def manifests_for(rows: list[dict], shards: int = 4) -> dict[str, dict]:
    out: dict[str, dict] = {
        f'_manifest-shard-{n + 1}.json': {} for n in range(shards)
    }
    for i, r in enumerate(rows):
        out[f'_manifest-shard-{i % shards + 1}.json'][r['pack']] = {
            'files': 2,
            'entries': 2,
            'safe': r['pack'].replace('-', '_'),
        }
    return out


def break_both_entries(r: dict) -> None:
    r['load'] = {'./a.js': 'THREW boom', './b.js': 'THREW boom'}
    r['loadedOk'] = 0


def break_one_entry(r: dict) -> None:
    r['load'] = {'./a.js': 'OK', './b.js': 'THREW boom'}
    r['loadedOk'] = 1


def break_register_node_def(r: dict) -> None:
    r['registerNodeDef'] = 'KSampler:boom'


def break_register_custom_nodes(r: dict) -> None:
    r['registerCustomNodes'] = 'boom'


def add_hook_error(r: dict) -> None:
    r['hookErrors'] = ['Error calling extension "x" beforeRegisterNodeDef']


def break_op_err(r: dict) -> None:
    r['ops']['load']['err'] = 'boom'


def break_op_desync(r: dict) -> None:
    r['ops']['load']['desync'] = 'KSampler#3(w7/r5)'


def stub_out(r: dict) -> None:
    pack = r['pack']
    r.clear()
    r.update({'pack': pack, 'incomplete': True})


def read_if_present(path: str) -> str:
    if not os.path.exists(path):
        return ''
    with open(path, encoding='utf-8') as fh:
        return fh.read()


def broken(n: int, mutate) -> list[dict]:
    rows = population()
    for r in rows[:n]:
        mutate(r)
    return rows


F = sm.FLOORS

# Each broken pack costs one point of its criterion over a 100-pack
# population, except entry-clean, whose denominator is the 200 entry files.
CRITERION_CASES = (
    ('entry JS loads', break_both_entries, 100 - F['any_loaded']),
    ('entry files load clean', break_one_entry,
     (100 - F['entry_clean']) * 2),
    ('registerNodeDef OK', break_register_node_def,
     100 - F['register_node_def']),
    ('registerCustomNodes OK', break_register_custom_nodes,
     100 - F['register_custom_nodes']),
    ('packs free of contained hook errors', add_hook_error,
     100 - F['hook_free']),
    ('every operation clean', break_op_err, 100 - F['op_clean']),
    ('every operation clean', break_op_desync, 100 - F['op_clean']),
    ('rows complete', stub_out, 100 - F['rows_complete']),
)


class Criteria(unittest.TestCase):
    def test_clean_population_passes_and_writes_metrics(self) -> None:
        v = sm.evaluate(population(), {})
        self.assertEqual(v.code, 0)
        self.assertEqual(v.breaches, [])
        self.assertEqual(v.metrics['packs'], 100)
        self.assertEqual(v.metrics['verdict'], 'PASS')

    def test_each_criterion_fails_only_past_its_own_floor(self) -> None:
        for label, mutate, allowed in CRITERION_CASES:
            allowed = int(allowed)
            with self.subTest(criterion=label, broken=allowed):
                v = sm.evaluate(broken(allowed, mutate), {})
                self.assertEqual(v.code, 0, v.lines)
            with self.subTest(criterion=label, broken=allowed + 1):
                v = sm.evaluate(broken(allowed + 1, mutate), {})
                self.assertEqual(v.code, 1, v.lines)
                self.assertEqual(len(v.breaches), 1, v.breaches)
                self.assertIn(label, v.breaches[0])
                self.assertIsNone(v.metrics)

    def test_desync_alone_is_an_unclean_operation(self) -> None:
        v = sm.evaluate(broken(50, break_op_desync), {})
        self.assertEqual(v.code, 1)
        self.assertIn('every operation clean', v.breaches[0])

    def test_ungated_row_fields_are_labelled_telemetry(self) -> None:
        report = '\n'.join(sm.evaluate(population(), {}).lines)
        self.assertIn('telemetry only', report)
        for field in ('newTypes', 'driveTypes'):
            self.assertIn(field, report)


class HarnessGates(unittest.TestCase):
    def test_no_rows_is_withheld(self) -> None:
        self.assertEqual(sm.evaluate([], {}).code, 2)

    def test_every_row_a_stub_is_withheld(self) -> None:
        v = sm.evaluate(broken(100, stub_out), {})
        self.assertEqual(v.code, 2)
        self.assertIsNone(v.metrics)

    def test_stub_majority_is_withheld_not_failed(self) -> None:
        v = sm.evaluate(broken(51, stub_out), {})
        self.assertEqual(v.code, 2)
        self.assertIn('HARNESS FAILURE', '\n'.join(v.lines))
        self.assertIsNone(v.metrics)

    def test_self_check_floor_withholds(self) -> None:
        degraded = broken(
            51, lambda r: r.update(selfCheck='default workflow degraded')
        )
        self.assertEqual(sm.evaluate(degraded, {}).code, 2)
        held = broken(
            50, lambda r: r.update(selfCheck='default workflow degraded')
        )
        self.assertEqual(sm.evaluate(held, {}).code, 0)

    def test_missing_producer_key_is_reported_loudly(self) -> None:
        rows = [row(f'pack-{i}') for i in range(10)]
        for r in rows:
            r['driveTypes2'] = r.pop('driveTypes')
        verdict = sm.evaluate(rows, {})
        report = '\n'.join(verdict.lines)
        self.assertEqual(verdict.code, 2)
        self.assertIn('ROW SCHEMA DRIFT', report)
        self.assertIn('driveTypes', report)
        self.assertIsNone(verdict.metrics)

    def test_partially_missing_producer_key_is_withheld(self) -> None:
        rows = population()
        for r in rows[:99]:
            del r['selfCheck']
        verdict = sm.evaluate(rows, {})
        report = '\n'.join(verdict.lines)
        self.assertEqual(verdict.code, 2)
        self.assertIn('selfCheck: 99 row(s)', report)
        self.assertIsNone(verdict.metrics)

    def test_renderer_mode_must_match_the_verdict_arm(self) -> None:
        legacy = sm.evaluate(population(), {}, renderer='legacy')
        self.assertEqual(legacy.code, 0)
        self.assertIn(
            'renderer: legacy (vueNodesMode = false)', legacy.lines
        )

        vue_rows = population()
        for r in vue_rows:
            r['vueNodesMode'] = True
        vue = sm.evaluate(vue_rows, {}, renderer='vue')
        self.assertEqual(vue.code, 0)
        self.assertIn('renderer: vue (vueNodesMode = true)', vue.lines)

        mismatch = sm.evaluate(population(), {}, renderer='vue')
        self.assertEqual(mismatch.code, 2)
        self.assertIn('RENDERER MODE MISMATCH', '\n'.join(mismatch.lines))

    def test_empty_operation_maps_fail_closed(self) -> None:
        rows = population()
        for r in rows:
            r['ops'] = {}
        verdict = sm.evaluate(rows, {})
        self.assertEqual(verdict.code, 1)
        self.assertIn('every operation clean', verdict.breaches[0])

    def test_partially_missing_operations_fail_closed(self) -> None:
        rows = population()
        for r in rows[:99]:
            r['ops'] = {}
        verdict = sm.evaluate(rows, {})
        self.assertEqual(verdict.code, 1)
        self.assertIn('every operation clean', verdict.breaches[0])


class Population(unittest.TestCase):
    def test_full_population_passes(self) -> None:
        rows = population()
        v = sm.evaluate(rows, manifests_for(rows), expect_shards=4)
        self.assertEqual(v.code, 0, v.lines)
        self.assertEqual(v.metrics['shardManifests'], 4)

    def test_dead_shard_is_withheld_not_passed(self) -> None:
        rows = population()
        three_shards = {
            name: m
            for name, m in manifests_for(rows).items()
            if not name.endswith('4.json')
        }
        survivors = [
            r for r in rows if r['pack'] in set().union(*three_shards.values())
        ]
        v = sm.evaluate(survivors, three_shards, expect_shards=4)
        self.assertEqual(v.code, 2)
        self.assertIn('PARTIAL POPULATION', '\n'.join(v.lines))
        self.assertIsNone(v.metrics)

    def test_manifest_entry_without_a_row_is_named(self) -> None:
        rows = population()
        full = manifests_for(rows)
        v = sm.evaluate(rows[:-1], full, expect_shards=4)
        self.assertEqual(v.code, 2)
        self.assertIn('pack-099', '\n'.join(v.lines))

    def test_row_without_a_manifest_entry_is_named(self) -> None:
        rows = population()
        v = sm.evaluate(rows, manifests_for(rows[:-1]), expect_shards=4)
        self.assertEqual(v.code, 2)
        self.assertIn('pack-099', '\n'.join(v.lines))

    def test_stub_rows_still_count_as_population(self) -> None:
        rows = broken(2, stub_out)
        v = sm.evaluate(rows, manifests_for(rows), expect_shards=4)
        self.assertEqual(v.code, 0, v.lines)

    def test_unset_expectation_skips_the_population_gate(self) -> None:
        rows = population()
        self.assertEqual(sm.evaluate(rows[:40], manifests_for(rows)).code, 0)

    def test_indeterminate_packs_leave_rate_denominators(self) -> None:
        rows = population()
        manifests = manifests_for(rows)
        for shard in manifests.values():
            for pack, entry in shard.items():
                if pack in ('pack-000', 'pack-001'):
                    entry['indeterminate'] = 'entrypoint unresolved'
        for r in rows[:2]:
            break_both_entries(r)

        verdict = sm.evaluate(rows, manifests, expect_shards=4)

        self.assertEqual(verdict.code, 0, verdict.lines)
        self.assertEqual(verdict.metrics['packs'], 98)
        report = '\n'.join(verdict.lines)
        self.assertIn('indeterminate, excluded: 2', report)
        self.assertRegex(
            report, r'rows complete \(no hang or crash\)\s+100\.0%'
        )

    def test_all_indeterminate_is_withheld(self) -> None:
        rows = population()
        manifests = manifests_for(rows)
        for shard in manifests.values():
            for entry in shard.values():
                entry['indeterminate'] = 'entrypoint unresolved'

        verdict = sm.evaluate(rows, manifests)

        self.assertEqual(verdict.code, 2)
        self.assertIsNone(verdict.metrics)


class DeltaGate(unittest.TestCase):
    def eroded(self) -> list[dict]:
        return broken(10, break_one_entry)

    def test_absent_metrics_skip_the_delta(self) -> None:
        v = sm.evaluate(self.eroded(), {}, None, 'run-2')
        self.assertEqual(v.code, 0)
        self.assertIn('no previous metrics', '\n'.join(v.lines))

    def test_erosion_beyond_tolerance_fails(self) -> None:
        prev = {'entryPct': 100.0, 'runId': 'run-1'}
        v = sm.evaluate(self.eroded(), {}, prev, 'run-2')
        self.assertEqual(v.code, 1)
        self.assertIn('dropped 5.0pp', v.breaches[0])
        self.assertIsNone(v.metrics)

    def test_same_run_metrics_skip_the_delta(self) -> None:
        prev = {'entryPct': 100.0, 'runId': 'run-2'}
        v = sm.evaluate(self.eroded(), {}, prev, 'run-2')
        self.assertEqual(v.code, 0)
        self.assertIn('metrics are from this run', '\n'.join(v.lines))

    def test_malformed_metrics_skip_the_delta(self) -> None:
        for prev in ({'runId': 'run-1'}, {'entryPct': 'n/a'}, []):
            with self.subTest(prev=prev):
                v = sm.evaluate(self.eroded(), {}, prev, 'run-2')
                self.assertEqual(v.code, 0)
                self.assertIn(
                    'previous metrics malformed', '\n'.join(v.lines)
                )


class StaleRegistry(unittest.TestCase):
    def test_stale_marker_reaches_report_and_metrics(self) -> None:
        v = sm.evaluate(
            population(), {}, stale={'reason': 'registry API 503 x3'}
        )
        self.assertEqual(v.code, 0)
        self.assertIn('STALE REGISTRY', v.lines[0])
        self.assertIn('registry API 503 x3', v.lines[0])
        self.assertEqual(v.metrics['staleRegistry'], 'registry API 503 x3')

    def test_fresh_registry_records_no_marker(self) -> None:
        v = sm.evaluate(population(), {})
        self.assertIsNone(v.metrics['staleRegistry'])


class MainIO(unittest.TestCase):
    def run_main(
        self, rows, manifests=None, malformed_rows=(), **env
    ) -> tuple[int, str, str]:
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, 'rows')
            os.makedirs(out)
            for r in rows:
                name = r.get('pack', 'x').replace('-', '_')
                with open(f'{out}/{name}.json', 'w', encoding='utf-8') as fh:
                    json.dump(r, fh)
            for name, m in (manifests or {}).items():
                with open(f'{out}/{name}', 'w', encoding='utf-8') as fh:
                    json.dump(m, fh)
            for name in malformed_rows:
                with open(f'{out}/{name}', 'w', encoding='utf-8') as fh:
                    fh.write('{')
            metrics = os.path.join(tmp, 'metrics', 'metrics.json')
            summary = os.path.join(tmp, 'summary.md')
            environ = {
                'MATRIX_OUT': out,
                'MATRIX_METRICS_OUT': metrics,
                'GITHUB_STEP_SUMMARY': summary,
                **env,
            }
            buf = io.StringIO()
            with mock.patch.dict(os.environ, environ, clear=True):
                with redirect_stdout(buf):
                    code = sm.main()
            return (
                code,
                read_if_present(metrics),
                buf.getvalue() + read_if_present(summary),
            )

    def test_pass_writes_metrics_and_step_summary(self) -> None:
        code, metrics, output = self.run_main(population())
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(metrics)['verdict'], 'PASS')
        self.assertIn('## Ecosystem matrix', output)
        self.assertIn('VERDICT: PASS', output)

    def test_fail_does_not_ratchet_the_baseline(self) -> None:
        code, metrics, output = self.run_main(broken(50, break_op_err))
        self.assertEqual(code, 1)
        self.assertEqual(metrics, '')
        self.assertIn('VERDICT: FAIL', output)

    def test_empty_directory_is_withheld(self) -> None:
        code, metrics, _ = self.run_main([])
        self.assertEqual(code, 2)
        self.assertEqual(metrics, '')

    def test_unreadable_row_is_withheld(self) -> None:
        code, metrics, _ = self.run_main(
            population(), malformed_rows=('truncated.json',)
        )
        self.assertEqual(code, 2)
        self.assertEqual(metrics, '')

    def test_expected_shards_are_read_from_the_environment(self) -> None:
        rows = population()
        code, metrics, _ = self.run_main(
            rows, manifests_for(rows), MATRIX_EXPECT_SHARDS='5'
        )
        self.assertEqual(code, 2)
        self.assertEqual(metrics, '')
        code, _, _ = self.run_main(
            rows, manifests_for(rows), MATRIX_EXPECT_SHARDS='4'
        )
        self.assertEqual(code, 0)

    def test_non_numeric_shard_expectation_is_withheld(self) -> None:
        code, _, _ = self.run_main(population(), MATRIX_EXPECT_SHARDS='four')
        self.assertEqual(code, 2)

    def test_renderer_is_read_from_the_environment(self) -> None:
        rows = population()
        for r in rows:
            r['vueNodesMode'] = True
        code, metrics, output = self.run_main(rows, MATRIX_RENDERER='vue')
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(metrics)['renderer'], 'vue')
        self.assertIn('vueNodesMode = true', output)

        code, metrics, _ = self.run_main(
            population(), MATRIX_RENDERER='invalid'
        )
        self.assertEqual(code, 2)
        self.assertEqual(metrics, '')

    def test_stale_marker_is_read_from_the_environment(self) -> None:
        with tempfile.NamedTemporaryFile('w', suffix='.json') as fh:
            json.dump({'reason': 'pack count dropped 18%'}, fh)
            fh.flush()
            code, metrics, output = self.run_main(
                population(), MATRIX_STALE_MARKER=fh.name
            )
        self.assertEqual(code, 0)
        self.assertIn('pack count dropped 18%', output)
        self.assertEqual(
            json.loads(metrics)['staleRegistry'], 'pack count dropped 18%'
        )


if __name__ == '__main__':
    unittest.main()
