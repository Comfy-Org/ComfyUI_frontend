#!/usr/bin/env python3
"""Unit tests for the widget form/values agreement breakdown.

    python3 -m unittest discover -s scripts/registry-census

This reporter is not a gate, so what has to be pinned is different from
summarize_matrix's floors: that a dead measurement channel reads as
`UNMEASURED` rather than as zero violations, that a disagreeing form is always
named with its pack and node class, and that the verdict vocabulary the runner
emits stays in step with the vocabulary this groups by. The last one is the
one a future runner change breaks silently.
"""

from __future__ import annotations

import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import summarize_form_agreement as sfa

RUNNER = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), 'matrix_runner.ts'
)
PRODUCER = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    '../../src/workbench/extensions/agent/crdt/widgetValuesForm.ts',
)


def node(verdict: str, node_class: str = 'KSampler', **over: object) -> dict:
    base = {'t': node_class, 'v': verdict, 'o': 7, 'k': 7, 'w': 7, 'a': 7}
    return {**base, 'src': 'battery', **over}


def row(pack: str, *nodes: dict, **over: object) -> dict:
    return {'pack': pack, 'formNodes': list(nodes), 'formAgreement': {}, **over}


class TestVocabulary(unittest.TestCase):
    def test_every_runner_verdict_is_grouped(self) -> None:
        """A verdict the runner can emit but this cannot group would land in
        `unknown verdict` and be invisible in the headline table."""
        shaped = self.runner_verdicts() | self.producer_declines()
        self.assertEqual(
            sorted(shaped - set(sfa.KNOWN)),
            [],
            'the runner or producer emits a verdict this reporter does not group',
        )
        # Reverse direction: a member this reporter groups but nothing can
        # emit any more is a stale row in every table it prints.
        self.assertEqual(
            sorted(set(sfa.KNOWN) - shaped),
            [],
            'this reporter groups a verdict nothing can emit',
        )

    def runner_verdicts(self) -> set[str]:
        """The runner's own verdicts, each a whole single-quoted literal.

        The one interpolation allowed is the producer's suppression reason,
        which `producer_declines` reads from its source instead.
        """
        source = self.measure_body()
        templates = re.findall(r'`(?:emit|decline)[^`]*`', source)
        self.assertEqual(
            templates,
            ['`decline:${reason}`'],
            'verdicts must be whole literals, not interpolated',
        )
        literals = set(re.findall(r"'([A-Za-z_:]+)'", source))
        verdicts = {
            token
            for token in literals
            if token.startswith(('emit', 'decline')) or token in sfa.UNMEASURED
        }
        self.assertTrue(verdicts, 'found no verdict literals in matrix_runner.ts')
        return verdicts

    def producer_declines(self) -> set[str]:
        """Every `WidgetFormSuppression` member, as the runner reports it."""
        with open(PRODUCER, encoding='utf-8') as fh:
            whole = fh.read()
        start = whole.index('type WidgetFormSuppression =')
        union = whole[start : whole.index('\n\n', start)]
        reasons = set(re.findall(r"\| '([a-z_]+)'", union))
        self.assertTrue(reasons, 'found no WidgetFormSuppression members')
        return {f'decline:{reason}' for reason in reasons}

    @staticmethod
    def measure_body() -> str:
        """The runner's form-agreement section, delimited by its own banner.

        Scoped rather than whole-file: the runner's operation battery contains
        plenty of quoted tokens, and folding those in would make the vocabulary
        assertions vacuous.
        """
        with open(RUNNER, encoding='utf-8') as fh:
            whole = fh.read()
        start = whole.index('function positionalShape(')
        return whole[start : whole.index('\nfunction signature(', start)]

    def test_groups_partition_known(self) -> None:
        members = [v for _, group in sfa.GROUPS for v in group]
        self.assertEqual(sorted(members), sorted(set(members)))
        self.assertEqual(sorted(members), sorted(sfa.KNOWN))


class TestReport(unittest.TestCase):
    def test_no_telemetry_reads_as_unmeasured_not_as_clean(self) -> None:
        text = '\n'.join(sfa.report([{'pack': 'p', 'ops': {}}]))
        self.assertIn('UNMEASURED', text)
        self.assertNotIn('No disagreeing form', text)

    def test_harness_error_is_surfaced(self) -> None:
        rows = [
            {'pack': 'p', 'formAgreement': {'harnessError': 'TypeError: boom'}},
            row('q', node('emitAgree')),
        ]
        text = '\n'.join(sfa.report(rows))
        self.assertIn('recorded a measurement error', text)
        self.assertIn('TypeError: boom', text)
        self.assertNotIn('No disagreeing form in this population', text)

    def test_empty_telemetry_reads_as_unmeasured(self) -> None:
        rows = [
            {
                'pack': 'p',
                'formNodes': [],
                'formAgreement': {'harnessError': 'TypeError: boom'},
            }
        ]
        text = '\n'.join(sfa.report(rows))
        self.assertIn('UNMEASURED', text)

    def test_agreeing_population_says_so_explicitly(self) -> None:
        text = '\n'.join(
            sfa.report([row('p', node('emitAgree'), node('decline:value_dependent_layout'))])
        )
        self.assertIn('No disagreeing form in this population', text)
        self.assertIn('form emitted and agrees | 1', text)
        self.assertIn('form declined (safe) | 1', text)

    def test_frontend_type_drive_coverage_is_explicit(self) -> None:
        rows = [
            row(
                'p',
                node('emitAgree'),
                newTypes=['One', 'Two', 'Three'],
                driveTypes={'One': 'ok', 'Two': 'ok'},
                driveTypesOmitted=1,
            )
        ]
        text = '\n'.join(sfa.report(rows))
        self.assertIn(
            'frontend-only types: 3 discovered, 2 driven, 1 omitted', text
        )

    def test_type_coverage_counts_rows_whose_form_channel_never_fired(self) -> None:
        """A row can record omitted types and still carry no formNodes.

        Summing only over rows with form telemetry reports zero omissions
        while a complete row recorded one, which reads as a clean cap.
        """
        rows = [
            row('measured', node('emitAgree')),
            {
                'pack': 'serialize-failed',
                'formAgreement': {'harnessError': 'onSerialize threw'},
                'newTypes': ['One', 'Two'],
                'driveTypes': {'One': 'ok'},
                'driveTypesOmitted': 1,
            },
        ]
        text = '\n'.join(sfa.report(rows))
        self.assertIn(
            'frontend-only types: 2 discovered, 1 driven, 1 omitted', text
        )

    def test_disagreement_names_pack_and_node_class(self) -> None:
        rows = [
            row('videohelpersuite', node('emitDisagree:keyOrder', 'VHS_VideoCombine')),
            row('clean-pack', node('emitAgree')),
        ]
        text = '\n'.join(sfa.report(rows))
        self.assertIn('DISAGREEING FORMS: 1 node(s) across 1 pack(s)', text)
        self.assertIn('videohelpersuite', text)
        self.assertIn('VHS_VideoCombine', text)
        self.assertNotIn('No disagreeing form', text)

    def test_disagreement_sort_does_not_compare_node_dicts(self) -> None:
        rows = [
            row(
                'same-pack',
                node('emitDisagree:keyOrder', 'SameClass', o=2),
                node('emitDisagree:keyOrder', 'SameClass', o=1),
            )
        ]
        text = '\n'.join(sfa.report(rows))
        self.assertIn('DISAGREEING FORMS: 2 node(s)', text)

    def test_pack_controlled_markdown_is_escaped(self) -> None:
        rows = [
            row(
                'pack|name\n<h1>',
                node('emitDisagree:keyOrder', 'Class|Name\n<script>'),
            )
        ]
        text = '\n'.join(sfa.report(rows))
        self.assertIn('pack\\|name &lt;h1&gt;', text)
        self.assertIn('Class\\|Name &lt;script&gt;', text)
        self.assertNotIn('\n<h1>', text)

    def test_stub_rows_are_excluded_from_the_denominator(self) -> None:
        rows = [
            row('p', node('emitAgree')),
            {'pack': 'q', 'safe': 'q', 'incomplete': True},
        ]
        text = '\n'.join(sfa.report(rows))
        self.assertIn('2 rows, 1 complete, 1 stub', text)
        self.assertIn('nodes measured: 1', text)

    def test_unknown_verdict_is_reported_rather_than_folded_in(self) -> None:
        text = '\n'.join(sfa.report([row('p', node('somethingNew'))]))
        self.assertIn('unknown verdict | 1', text)

    def test_the_two_arms_are_counted_separately(self) -> None:
        """A clean battery arm must not be able to bury the driven arm, which
        is the only one that carries a pack's own custom serializer."""
        rows = [
            row(
                'p',
                node('emitAgree'),
                node('emitDisagree:keyOrder', 'VHS_VideoCombine', src='driven'),
            )
        ]
        text = '\n'.join(sfa.report(rows))
        self.assertIn('nodes measured: 2 (battery 1, driven 1)', text)
        self.assertIn('| driven | `emitDisagree:keyOrder` |', text.replace('  ', ' '))


class TestMain(unittest.TestCase):
    def test_missing_rows_is_an_error_not_a_clean_report(self) -> None:
        os.environ['MATRIX_OUT'] = '/nonexistent-matrix-out'
        try:
            self.assertEqual(sfa.main(), 1)
        finally:
            del os.environ['MATRIX_OUT']


if __name__ == '__main__':
    unittest.main()
