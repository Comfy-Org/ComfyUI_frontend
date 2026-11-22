#!/usr/bin/env python3
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
SAFE_VERSION = re.compile(r"[A-Za-z0-9][A-Za-z0-9.+_-]*")


def fetch(url: str) -> str:
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read().decode("utf-8")


def version_comfyui_pins() -> str:
    for line in fetch(CORE_REQUIREMENTS).splitlines():
        spec = line.split("#", 1)[0].split(";", 1)[0].strip()
        name, _, pinned = spec.partition("==")
        if name.strip() == "comfyui-workflow-templates" and pinned.strip():
            return pinned.strip()
    raise SystemExit(
        "ComfyUI's requirements.txt does not pin comfyui-workflow-templates"
    )


def json_bundle_pin(version: str) -> str:
    metadata = json.loads(fetch(RELEASE_METADATA.format(version)))
    for spec in metadata["info"].get("requires_dist") or []:
        match = JSON_BUNDLE.fullmatch(spec.strip())
        if match:
            pin = match.group(1)
            if not SAFE_VERSION.fullmatch(pin):
                raise SystemExit(
                    f"comfyui-workflow-templates=={version} pins a JSON bundle "
                    f"version that isn't a plain PEP 440-shaped token: {pin!r}"
                )
            return pin
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
