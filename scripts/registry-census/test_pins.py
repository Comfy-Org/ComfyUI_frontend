#!/usr/bin/env python3

from __future__ import annotations

import unittest
from datetime import date
from unittest import mock

import pins


class LoadPins(unittest.TestCase):
    def tearDown(self) -> None:
        pins.load.cache_clear()

    def test_pin_file_is_parsed_once_per_process(self) -> None:
        pins.load.cache_clear()
        opened = mock.mock_open(
            read_data='{"updated":"2026-08-17","packs":{"pack":"sha"}}'
        )
        with mock.patch('builtins.open', opened):
            self.assertEqual(pins.packs(), {'pack': 'sha'})
            self.assertEqual(pins.packs(), {'pack': 'sha'})

        opened.assert_called_once_with(pins.PINS, encoding='utf-8')


class PinAge(unittest.TestCase):
    def tearDown(self) -> None:
        pins.load.cache_clear()

    def stale_on(self, pinned: str, today: date) -> bool:
        pins.load.cache_clear()
        body = f'{{"updated":"{pinned}","packs":{{}}}}'
        with mock.patch('builtins.open', mock.mock_open(read_data=body)):
            return pins.is_stale(today)

    def test_a_monthly_bump_under_review_is_not_stale(self) -> None:
        self.assertFalse(self.stale_on('2026-12-01', date(2027, 1, 5)))

    def test_a_missed_monthly_bump_is_stale(self) -> None:
        self.assertTrue(self.stale_on('2026-12-01', date(2027, 1, 6)))


if __name__ == '__main__':
    unittest.main()
