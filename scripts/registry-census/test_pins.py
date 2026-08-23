#!/usr/bin/env python3

from __future__ import annotations

import unittest
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


if __name__ == '__main__':
    unittest.main()
