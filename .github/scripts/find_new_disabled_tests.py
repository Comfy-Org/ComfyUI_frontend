#!/usr/bin/env python3
"""Find newly added, unconditionally disabled test declarations in a Git diff."""

from __future__ import annotations

import re
import subprocess
import sys
from collections.abc import Iterable
from dataclasses import dataclass


TEST_PATHS = (
    b"*.spec.ts",
    b"*.spec.js",
    b"*.spec.mts",
    b"*.test.ts",
    b"*.test.js",
    b"*.test.mts",
)
HUNK_RE = re.compile(rb"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@")
IDENTIFIER_RE = re.compile(r"[A-Za-z_$][\w$]*")
DISABLE_CALLEES = (
    ("test", ".", "skip", "("),
    ("test", ".", "fixme", "("),
    ("it", ".", "skip", "("),
    ("it", ".", "fixme", "("),
    ("describe", ".", "skip", "("),
    ("describe", ".", "fixme", "("),
    ("test", ".", "describe", ".", "skip", "("),
    ("test", ".", "describe", ".", "fixme", "("),
)


@dataclass(frozen=True)
class Token:
    kind: str
    value: str
    line: int


def added_target_lines(patch: bytes) -> set[int]:
    """Return target-file line numbers added by a zero-context Git diff."""
    added: set[int] = set()
    target_line: int | None = None

    for raw_line in patch.splitlines():
        hunk = HUNK_RE.match(raw_line)
        if hunk:
            target_line = int(hunk.group(1))
        elif target_line is not None and raw_line.startswith(b"+"):
            added.add(target_line)
            target_line += 1
        elif target_line is not None and raw_line.startswith(b"-"):
            continue
        elif target_line is not None and raw_line.startswith(b" "):
            target_line += 1

    return added


def tokens(source: str) -> Iterable[Token]:
    """Tokenize the small JavaScript surface needed to identify test calls."""
    index = 0
    line = 1

    while index < len(source):
        char = source[index]
        if char.isspace():
            line += char == "\n"
            index += 1
            continue
        if source.startswith("//", index):
            newline = source.find("\n", index + 2)
            index = len(source) if newline == -1 else newline
            continue
        if source.startswith("/*", index):
            end = source.find("*/", index + 2)
            end = len(source) if end == -1 else end + 2
            line += source.count("\n", index, end)
            index = end
            continue
        if char in "'\"`":
            quote = char
            start_line = line
            index += 1
            while index < len(source):
                if source[index] == "\\":
                    index += 2
                    continue
                if source[index] == quote:
                    index += 1
                    break
                line += source[index] == "\n"
                index += 1
            yield Token("string", quote, start_line)
            continue

        identifier = IDENTIFIER_RE.match(source, index)
        if identifier:
            value = identifier.group()
            yield Token("identifier", value, line)
            index = identifier.end()
            continue

        yield Token("punctuation", char, line)
        index += 1


def disabled_declaration_lines(source: str) -> Iterable[int]:
    parsed = list(tokens(source))
    for index, token in enumerate(parsed):
        if token.kind != "identifier":
            continue
        if index and parsed[index - 1].value == ".":
            continue

        for callee in DISABLE_CALLEES:
            values = tuple(item.value for item in parsed[index : index + len(callee)])
            if values != callee:
                continue
            argument_index = index + len(callee)
            if argument_index >= len(parsed):
                continue
            argument = parsed[argument_index]
            if argument.kind == "string" or (
                argument.kind == "identifier" and argument.value == "true"
            ):
                yield parsed[index + len(callee) - 2].line
            break


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
        source = git(b"show", head_sha.encode() + b":" + path).decode(
            "utf-8", errors="replace"
        )
        source_lines = source.splitlines()
        added_lines = added_target_lines(patch)
        display_path = path.decode("utf-8", errors="replace")
        for line_number in disabled_declaration_lines(source):
            if line_number in added_lines:
                content = source_lines[line_number - 1].strip()
                yield f"  {display_path}:{line_number}: {content}"


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
