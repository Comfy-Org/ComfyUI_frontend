#!/usr/bin/env python3

from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import fetch_corpus as fc


def results(*statuses: str) -> list[fc.Fetched]:
    return [
        fc.Fetched(f'pack-{index}', status, None, '')
        for index, status in enumerate(statuses)
    ]


def all_pinned(fetched: list[fc.Fetched]) -> set[str]:
    return {result.pack_id for result in fetched}


class CorpusCoverage(unittest.TestCase):
    def test_empty_target_list_fails_closed(self) -> None:
        self.assertTrue(fc.corpus_is_too_small([], set()))

    def test_successful_and_cached_packs_are_available(self) -> None:
        fetched = results('ok', 'empty', 'cached', 'failed')
        self.assertEqual(
            fc.corpus_coverage(fetched, all_pinned(fetched)),
            (3, 4, 0.75),
        )

    def test_cold_fetch_fails_below_the_population_floor(self) -> None:
        fetched = results(*(['ok'] * 94), *(['failed'] * 6))
        self.assertTrue(fc.corpus_is_too_small(fetched, all_pinned(fetched)))

    def test_population_at_the_floor_is_accepted(self) -> None:
        fetched = results(*(['ok'] * 95), *(['failed'] * 5))
        self.assertFalse(fc.corpus_is_too_small(fetched, all_pinned(fetched)))

    def test_small_smoke_run_keeps_the_mass_failure_minimum(self) -> None:
        fetched = results(*(['ok'] * 46), *(['failed'] * 4))
        self.assertFalse(fc.corpus_is_too_small(fetched, all_pinned(fetched)))

    def test_unpinned_targets_do_not_consume_the_population_floor(self) -> None:
        fetched = results(*(['ok'] * 94), *(['failed'] * 6))
        pinned = {result.pack_id for result in fetched[:94]}
        self.assertEqual(fc.corpus_coverage(fetched, pinned), (94, 94, 1.0))
        self.assertFalse(fc.corpus_is_too_small(fetched, pinned))

    def test_structural_exclusions_do_not_consume_the_population_floor(self) -> None:
        fetched = results(
            *(['ok'] * 94),
            'bad-url',
            'no-subdir',
            'oversize',
            'unsupported-host',
            'bad-id',
            'failed',
        )
        pinned = all_pinned(fetched)
        self.assertEqual(fc.corpus_coverage(fetched, pinned), (94, 95, 94 / 95))
        self.assertFalse(fc.corpus_is_too_small(fetched, pinned))


if __name__ == '__main__':
    unittest.main()
