#!/usr/bin/env python3
"""Resolve which templates release to check, and which JSON bundle it pins.

`comfyui-workflow-templates` is a meta package that pins each of its bundles
exactly, so the JSON bundle belonging to a release is read off that release's
metadata rather than guessed. Installing the JSON bundle unpinned would drift
from the release ComfyUI actually ships.

With no argument it reports the version ComfyUI pins on master. Pass a version
to check a candidate instead.

    python3 scripts/cicd/resolve-shipped-templates.py            # what core pins
    python3 scripts/cicd/resolve-shipped-templates.py 0.11.100   # a specific release

Writes `version=` and `json_pin=` to GITHUB_OUTPUT when running in Actions, and
prints them either way.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.request

CORE_REQUIREMENTS = (
    "https://raw.githubusercontent.com/Comfy-Org/ComfyUI/master/requirements.txt"
)
RELEASE_METADATA = "https://pypi.org/pypi/comfyui-workflow-templates/{}/json"
JSON_BUNDLE = re.compile(r"comfyui-workflow-templates-json==([^;\s]+)")


def fetch(url: str) -> str:
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read().decode("utf-8")


def version_comfyui_pins() -> str:
    for line in fetch(CORE_REQUIREMENTS).splitlines():
        name, _, pinned = line.strip().partition("==")
        if name == "comfyui-workflow-templates" and pinned:
            return pinned
    raise SystemExit(
        "ComfyUI's requirements.txt does not pin comfyui-workflow-templates"
    )


def json_bundle_pin(version: str) -> str:
    metadata = json.loads(fetch(RELEASE_METADATA.format(version)))
    for spec in metadata["info"].get("requires_dist") or []:
        # The same pin appears again under several extras; the first is enough.
        match = JSON_BUNDLE.fullmatch(spec.strip())
        if match:
            return match.group(1)
    raise SystemExit(
        f"comfyui-workflow-templates=={version} does not pin a JSON bundle"
    )


def main(argv: list[str]) -> int:
    version = argv[1] if len(argv) > 1 and argv[1] else version_comfyui_pins()
    pin = json_bundle_pin(version)

    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as handle:
            handle.write(f"version={version}\njson_pin={pin}\n")
    sys.stdout.write(f"version={version}\njson_pin={pin}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
