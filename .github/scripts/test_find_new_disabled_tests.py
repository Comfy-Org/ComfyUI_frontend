#!/usr/bin/env python3

import unittest
from unittest.mock import patch

import find_new_disabled_tests as detector


class DisabledDeclarationTest(unittest.TestCase):
    def test_matches_supported_unconditional_declarations(self) -> None:
        source = """\
test.fixme(
  true,
  'temporarily disabled'
)
test.skip(isCloud, 'runtime condition')
it.skip(`parked test`, () => {})
test.describe.fixme('parked suite', () => {})
"""

        self.assertEqual(
            list(detector.disabled_declaration_lines(source)), [1, 6, 7]
        )

    def test_ignores_comments_and_string_contents(self) -> None:
        source = """\
// test.skip('commented out', () => {})
const line = "it.fixme('inside a string', () => {})"
/* describe.skip('block comment', () => {}) */
test('active test', () => {})
"""

        self.assertEqual(list(detector.disabled_declaration_lines(source)), [])

    def test_added_lines_use_target_coordinates(self) -> None:
        diff = b"""\
@@ -1 +1 @@
-test(
+test.skip(
   'existing test name',
@@ -20,0 +42 @@
+describe.fixme('second', () => {})
"""

        self.assertEqual(detector.added_target_lines(diff), {1, 42})

    @patch.object(detector, "git")
    def test_added_modifier_uses_unchanged_multiline_name(self, git) -> None:
        git.side_effect = [
            b"tests/example.spec.ts\0",
            b"@@ -1 +1 @@\n-test(\n+test.skip(\n",
            b"test.skip(\n  'existing test name',\n  () => {}\n)\n",
        ]

        self.assertEqual(
            list(detector.find_violations("base", "head")),
            ["  tests/example.spec.ts:1: test.skip("],
        )

    @patch.object(detector, "git")
    def test_non_ascii_paths_are_read_from_nul_delimited_output(self, git) -> None:
        git.side_effect = [
            "tests/café.spec.ts\0".encode(),
            b"@@ -0,0 +3 @@\n+test.fixme('parked', () => {})\n",
            b"\n\ntest.fixme('parked', () => {})\n",
        ]

        self.assertEqual(
            list(detector.find_violations("base", "head")),
            ["  tests/café.spec.ts:3: test.fixme('parked', () => {})"],
        )


if __name__ == "__main__":
    unittest.main()
