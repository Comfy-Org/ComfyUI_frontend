#!/usr/bin/env python3

from __future__ import annotations

import os
import tempfile
import unittest

import build_matrix


class PackRootAnchor(unittest.TestCase):
    def test_source_web_directory_does_not_depend_on_copy_order(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, 'source')
            dst = os.path.join(tmp, 'destination')
            entry = os.path.join(src, 'nested', 'sibling', 'main.js')
            os.makedirs(os.path.join(src, 'nested', 'web'))
            os.makedirs(os.path.dirname(entry))

            anchor = build_matrix.packroot_anchor(src, dst, entry)

            self.assertEqual(
                os.path.normpath(anchor),
                os.path.join(dst, 'nested'),
            )

    def test_pack_root_is_the_fallback_without_a_web_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, 'source')
            dst = os.path.join(tmp, 'destination')
            entry = os.path.join(src, 'main.js')
            os.makedirs(src)

            self.assertEqual(build_matrix.packroot_anchor(src, dst, entry), dst)


if __name__ == '__main__':
    unittest.main()
