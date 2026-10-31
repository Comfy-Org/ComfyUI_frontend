"""Project a real `/object_info` dump down to the node SHAPE the census needs.

The census measures `proveWidgetForm` over real node classes. Registering a
class is the only way to get its real widget list, and the only input to that
is a node definition — so the census needs an `object_info`, and the six
hardcoded defs `matrix_runner.ts` used to carry made every Python-defined pack
class invisible to it.

The dump this runs against lives in `Comfy-Org/cloud`
(`services/ingest/data/object_info.json`), which is the same dump the agent
image bakes and therefore the production-representative one. That repo is
PRIVATE and this one is PUBLIC, so the committed fixture is a projection, not
a copy, and the projection is the narrow one on purpose:

  kept    input, output, output_name, output_node, python_module
  dropped description, display_name, category, input_order, output_tooltips,
          search_aliases, is_input_list, has_intermediate_output, and the
          `tooltip` / `description` entries inside every input's options bag

Everything kept is node-shape: it is what decides a node's widget list, and so
what the predicate's verdict is a function of. Everything dropped is prose or
presentation.

That is a claim, and it is checkable rather than assumed. Point the census at
the full dump and at the projection and compare the two runs' `digest`, which
is a hash of every class's verdict in sorted order:

    MATRIX_OBJECT_INFO=/path/to/cloud/.../object_info.json CENSUS_FORMS_OUT=full.json \
      pnpm exec vitest run --config vitest.census.config.mts
    CENSUS_FORMS_OUT=projected.json \
      pnpm exec vitest run --config vitest.census.config.mts

Do that on any bump. `--verify` is the cheaper, narrower check: that the
committed projection is byte-for-byte what this script derives from the dump the
pin records. It says nothing about verdicts.

`python_module` is kept because it is the only field that attributes a class to
the pack that defines it, and a census with no denominator per pack is the
scope limit this fixture exists to remove.

Usage:
    python3 scripts/registry-census/project_object_info.py \
        --source /path/to/cloud/services/ingest/data/object_info.json
    python3 scripts/registry-census/project_object_info.py \
        --source /path/to/object_info.json --verify
"""

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
SHAPE = os.path.join(HERE, 'object_info.shape.json')
PIN = os.path.join(HERE, 'object_info.pin.json')

KEEP = ('input', 'output', 'output_name', 'output_node', 'python_module')
DROP_OPTS = ('tooltip', 'description')


def project_input_spec(spec):
    """Strip prose from one input's options bag, leaving the shape intact."""
    out = {}
    for name, isp in spec.items():
        if not (isinstance(isp, list) and len(isp) >= 1):
            out[name] = isp
            continue
        options = isp[1] if len(isp) > 1 else None
        if isinstance(options, dict):
            options = {k: v for k, v in options.items() if k not in DROP_OPTS}
            out[name] = [isp[0], options]
        else:
            out[name] = list(isp)
    return out


def render(shaped: dict) -> str:
    """The one serialization of the projection, so write and verify agree."""
    return json.dumps(shaped, separators=(',', ':'), sort_keys=True) + '\n'


def project(dump: dict) -> dict:
    out = {}
    for name in sorted(dump):
        src = dump[name]
        node = {k: src[k] for k in KEEP if k in src}
        if isinstance(node.get('input'), dict):
            node['input'] = {
                section: project_input_spec(spec)
                for section, spec in sorted(node['input'].items())
                if isinstance(spec, dict)
            }
        out[name] = node
    return out


def read_source(source: str) -> bytes:
    with open(source, 'rb') as fh:
        return fh.read()


def write(source: str) -> None:
    raw = read_source(source)
    dump = json.loads(raw)
    if not isinstance(dump, dict) or not dump:
        sys.exit(f'{source} is not a non-empty /object_info object')
    shaped = project(dump)
    text = render(shaped)
    with open(SHAPE, 'w', encoding='utf-8') as fh:
        fh.write(text)

    modules = sorted({
        v['python_module'] for v in shaped.values() if v.get('python_module')
    })
    packs = sorted({
        m.split('.', 1)[1] for m in modules if m.startswith('custom_nodes.')
    })
    pin = {
        'source': {
            'repo': 'Comfy-Org/cloud',
            'path': 'services/ingest/data/object_info.json',
            'sha256': hashlib.sha256(raw).hexdigest(),
            'bytes': len(raw),
        },
        'projection': {
            'keptNodeFields': list(KEEP),
            'droppedOptionKeys': list(DROP_OPTS),
            'sha256': hashlib.sha256(text.encode()).hexdigest(),
            'bytes': len(text),
        },
        'population': {
            'classes': len(shaped),
            'pythonModules': len(modules),
            'packs': len(packs),
            'coreClasses': sum(
                1
                for v in shaped.values()
                if not str(v.get('python_module', '')).startswith('custom_nodes.')
            ),
            'packClasses': sum(
                1
                for v in shaped.values()
                if str(v.get('python_module', '')).startswith('custom_nodes.')
            ),
        },
        'projectedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    }
    with open(PIN, 'w', encoding='utf-8') as fh:
        json.dump(pin, fh, indent=2, sort_keys=True)
        fh.write('\n')
    pop = pin['population']
    print(
        f"{pop['classes']} classes ({pop['coreClasses']} core,"
        f" {pop['packClasses']} from {pop['packs']} packs)"
        f" -> {SHAPE} ({len(text) / 1e6:.2f} MB)",
        file=sys.stderr,
    )


def verify(source: str) -> None:
    """The projection must not change a single verdict. Re-derive and compare."""
    raw = read_source(source)
    with open(PIN, encoding='utf-8') as fh:
        recorded = json.load(fh)
    actual = hashlib.sha256(raw).hexdigest()
    if actual != recorded['source']['sha256']:
        sys.exit(
            f'source dump has moved: pin records {recorded["source"]["sha256"]},'
            f' {source} hashes to {actual}. Re-run without --verify to bump.'
        )
    text = render(project(json.loads(raw)))
    with open(SHAPE, encoding='utf-8') as fh:
        committed = fh.read()
    if text != committed:
        sys.exit(
            'the committed projection is not what this script derives from the'
            ' pinned dump. Re-run without --verify.'
        )
    print('projection matches the pinned dump', file=sys.stderr)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--source', required=True, help='path to object_info.json')
    ap.add_argument(
        '--verify',
        action='store_true',
        help='check the committed projection against the pinned dump',
    )
    args = ap.parse_args()
    (verify if args.verify else write)(args.source)
