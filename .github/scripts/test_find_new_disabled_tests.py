#!/usr/bin/env python3

import unittest
from unittest.mock import patch

import find_new_disabled_tests as detector


class AddedBlocksTest(unittest.TestCase):
    def test_multiline_and_literal_true_use_target_line(self) -> None:
        diff = b"""\
@@ -4,0 +10,6 @@
+test.fixme(
+  true,
+  'temporarily disabled'
+)
+test.skip(isCloud, 'runtime condition')
+it.skip(`parked test`, () => {})
"""

        matches = [
            match
            for block in detector.added_blocks(diff)
            for match in detector.matches_in_block(block)
        ]

        self.assertEqual(
            matches,
            [(10, "test.fixme("), (15, "it.skip(`parked test`, () => {})")],
        )

    def test_hunks_keep_their_own_target_lines(self) -> None:
        diff = b"""\
@@ -1,0 +7 @@
+test.skip('first', () => {})
@@ -20,0 +42 @@
+describe.fixme('second', () => {})
"""

        matches = [
            match
            for block in detector.added_blocks(diff)
            for match in detector.matches_in_block(block)
        ]

        self.assertEqual(
            matches,
            [
                (7, "test.skip('first', () => {})"),
                (42, "describe.fixme('second', () => {})"),
            ],
        )

    @patch.object(detector, "git")
    def test_non_ascii_paths_are_read_from_nul_delimited_output(self, git) -> None:
        git.side_effect = [
            "tests/café.spec.ts\0".encode(),
            b"@@ -0,0 +3 @@\n+test.fixme('parked', () => {})\n",
        ]

        self.assertEqual(
            list(detector.find_violations("base", "head")),
            ["  tests/café.spec.ts:3: test.fixme('parked', () => {})"],
        )


if __name__ == "__main__":
    unittest.main()
