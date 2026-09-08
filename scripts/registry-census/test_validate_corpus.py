#!/usr/bin/env python3

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import validate_corpus


class CorpusCacheValidation(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.write_json(
            'data/registry.json',
            [
                {'id': 'available-pack', 'repo': 'https://example.com/available'},
                {'id': 'missing-pack', 'repo': 'https://example.com/missing'},
                {'id': 'not-a-target', 'repo': ''},
            ],
        )
        self.write_json(
            'corpus.lock.json',
            {
                'packs': {
                    'available-pack': {
                        'etag': 'etag-1',
                        'ref': 'commit-1',
                        'status': 'ok',
                    },
                    'missing-pack': {
                        'status': 'failed',
                        'detail': 'http 404 curl 22',
                    },
                }
            },
        )
        self.write_json(
            'corpus.ready.json',
            {
                'available': 1,
                'coverageAvailable': 1,
                'coverageFloor': 0.95,
                'coverageTargets': 2,
                'targets': 2,
            },
        )
        self.write_json(
            'corpus/registry_js/available-pack/.identity',
            {'etag': 'etag-1', 'ref': 'commit-1'},
        )
        (self.root / 'corpus/registry_js/available-pack/.done').write_text(
            'etag-1', encoding='utf-8'
        )

    def tearDown(self) -> None:
        self.temp.cleanup()

    def write_json(self, relative_path: str, value: object) -> None:
        path = self.root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value), encoding='utf-8')

    def validate(self) -> tuple[int, int]:
        return validate_corpus.validate(
            self.root, {'available-pack', 'missing-pack'}
        )

    def test_accepts_matching_snapshot_lock_and_staged_identity(self) -> None:
        self.assertEqual(self.validate(), (1, 2))

    def test_rejects_missing_provenance(self) -> None:
        (self.root / 'corpus.lock.json').unlink()

        with self.assertRaisesRegex(
            validate_corpus.CorpusValidationError, 'corpus.lock.json'
        ):
            self.validate()

    def test_rejects_ready_population_from_another_snapshot(self) -> None:
        self.write_json(
            'corpus.ready.json',
            {
                'available': 1,
                'coverageAvailable': 1,
                'coverageFloor': 0.95,
                'coverageTargets': 2,
                'targets': 3,
            },
        )

        with self.assertRaisesRegex(
            validate_corpus.CorpusValidationError,
            'records 3 targets; snapshot has 2',
        ):
            self.validate()

    def test_rejects_artifact_owned_coverage_floor(self) -> None:
        ready = json.loads(
            (self.root / 'corpus.ready.json').read_text(encoding='utf-8')
        )
        ready['coverageFloor'] = 0.01
        self.write_json('corpus.ready.json', ready)

        with self.assertRaisesRegex(
            validate_corpus.CorpusValidationError,
            'code requires 0.95',
        ):
            self.validate()

    def test_rejects_artifact_owned_coverage_population(self) -> None:
        ready = json.loads(
            (self.root / 'corpus.ready.json').read_text(encoding='utf-8')
        )
        ready['coverageAvailable'] = 2
        self.write_json('corpus.ready.json', ready)

        with self.assertRaisesRegex(
            validate_corpus.CorpusValidationError,
            'lock and pins have 1/2',
        ):
            self.validate()

    def test_rejects_staged_identity_from_another_lock(self) -> None:
        self.write_json(
            'corpus/registry_js/available-pack/.identity',
            {'etag': 'etag-1', 'ref': 'other-commit'},
        )

        with self.assertRaisesRegex(
            validate_corpus.CorpusValidationError,
            'staged identity differs from lock',
        ):
            self.validate()


if __name__ == '__main__':
    unittest.main()
