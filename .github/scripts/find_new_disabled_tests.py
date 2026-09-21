#!/usr/bin/env python3
"""Find newly added, unconditionally disabled test declarations in a Git diff."""

from __future__ import annotations

import re
import subprocess
import sys
from collections.abc import Iterable


TEST_PATHS = (
    b"*.spec.ts",
    b"*.spec.js",
    b"*.spec.mts",
    b"*.test.ts",
    b"*.test.js",
    b"*.test.mts",
)
HUNK_RE = re.compile(rb"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@")
DISABLE_RE = re.compile(
    r"\b(?:test|it|describe)(?:\.describe)?\.(?:skip|fixme)\s*\(\s*"
    r"(?:['\"`]|true\b)",
    re.MULTILINE,
)


def added_blocks(patch: bytes) -> Iterable[list[tuple[int, str]]]:
    """Yield contiguous added lines paired with their target-file line numbers."""
    block: list[tuple[int, str]] = []
    target_line: int | None = None

    for raw_line in patch.splitlines():
        hunk = HUNK_RE.match(raw_line)
        if hunk:
            if block:
                yield block
                block = []
            target_line = int(hunk.group(1))
            continue

        if target_line is None:
            continue
        if raw_line.startswith(b"+"):
            block.append(
                (target_line, raw_line[1:].decode("utf-8", errors="replace"))
            )
            target_line += 1
        elif raw_line.startswith(b"-"):
            if block:
                yield block
                block = []
        elif raw_line.startswith(b" "):
            if block:
                yield block
                block = []
            target_line += 1
        else:
            if block:
                yield block
                block = []

    if block:
        yield block


def matches_in_block(block: list[tuple[int, str]]) -> Iterable[tuple[int, str]]:
    text = "\n".join(content for _, content in block)
    for match in DISABLE_RE.finditer(text):
        block_index = text.count("\n", 0, match.start())
        yield block[block_index]


def git(*args: bytes) -> bytes:
    result = subprocess.run(
        [b"git", *args],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return result.stdout


def find_violations(base_sha: str, head_sha: str) -> Iterable[str]:
    revision = f"{base_sha}...{head_sha}".encode()
    changed = git(
        b"diff",
        b"--name-only",
        b"-z",
        b"--diff-filter=d",
        revision,
        b"--",
        *TEST_PATHS,
    ).split(b"\0")

    for path in filter(None, changed):
        patch = git(
            b"diff",
            b"--unified=0",
            b"--no-color",
            b"--no-ext-diff",
            revision,
            b"--",
            path,
        )
        display_path = path.decode("utf-8", errors="replace")
        for block in added_blocks(patch):
            for line_number, content in matches_in_block(block):
                yield f"  {display_path}:{line_number}: {content.strip()}"


def main() -> int:
    if len(sys.argv) != 3:
        print(
            "usage: find_new_disabled_tests.py <base_sha> <head_sha>",
            file=sys.stderr,
        )
        return 2

    try:
        print("\n".join(find_violations(sys.argv[1], sys.argv[2])))
    except subprocess.CalledProcessError as error:
        detail = error.stderr.decode("utf-8", errors="replace").strip()
        print(f"git diff failed: {detail}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
