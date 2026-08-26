#!/usr/bin/env python3

from __future__ import annotations

import json
import os
import tempfile
import unittest
from unittest import mock

import refresh_registry


class CachedSnapshot(unittest.TestCase):
    def test_corrupt_snapshot_is_replaced_after_a_successful_refresh(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            snapshot = os.path.join(tmp, 'registry.json')
            with open(snapshot, 'w', encoding='utf-8') as fh:
                fh.write('{')
            fresh = {
                'totalPages': 1,
                'nodes': [
                    {
                        'id': 'pack',
                        'repository': 'https://github.com/owner/repo',
                        'downloads': 1,
                    }
                ],
            }
            with (
                mock.patch.object(
                    refresh_registry, 'registry_snapshot', return_value=snapshot
                ),
                mock.patch.object(
                    refresh_registry,
                    'STALE_MARKER',
                    os.path.join(tmp, 'registry-stale.json'),
                ),
                mock.patch.object(
                    refresh_registry, 'fetch_page', return_value=fresh
                ),
            ):
                self.assertEqual(refresh_registry.main(), 0)

            with open(snapshot, encoding='utf-8') as fh:
                saved = json.load(fh)
            self.assertEqual(saved, [
                {
                    'downloads': 1,
                    'id': 'pack',
                    'repo': 'https://github.com/owner/repo',
                }
            ])


if __name__ == '__main__':
    unittest.main()
