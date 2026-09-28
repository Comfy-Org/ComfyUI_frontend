import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { z } from 'zod'

import { workshopNodePricingSchema } from '../src/config/workshop-node-pricing.schema'

const directory = process.argv[2]
if (!directory)
  throw new Error('Usage: generate-workshop-node-pricing.ts <ComfyUI checkout>')
const comfy = resolve(directory)
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: comfy,
  encoding: 'utf8'
}).trim()
if (
  execFileSync('git', ['diff', 'HEAD', '--', 'comfy_api_nodes', 'comfy_api'], {
    cwd: comfy,
    encoding: 'utf8'
  }).trim()
)
  throw new Error('Pricing source must have no tracked node or schema edits')

const bindings = z
  .array(
    z.object({
      routerId: z.string(),
      module: z.string().regex(/^nodes_[a-z0-9_]+$/),
      nodeType: z.string().regex(/^[A-Za-z0-9_]+$/),
      model: z.string().optional(),
      useCases: z.array(z.string()).optional()
    })
  )
  .parse(
    JSON.parse(
      readFileSync(
        new URL(
          '../src/data/workshop-node-pricing-bindings.json',
          import.meta.url
        ),
        'utf8'
      )
    )
  )

const exported: unknown = JSON.parse(
  execFileSync(
    resolve(comfy, '.venv/bin/python'),
    [
      '-c',
      `
import contextlib, importlib, json, sys
bindings = json.load(sys.stdin)
rows = []
with contextlib.redirect_stdout(sys.stderr):
    for binding in bindings:
        module = importlib.import_module('comfy_api_nodes.' + binding['module'])
        node = getattr(module, binding['nodeType']).GET_NODE_INFO_V1()
        specs = {**node['input'].get('required', {}), **node['input'].get('optional', {})}
        overrides = {'model': binding['model']} if 'model' in binding else {}
        for name, value in overrides.items():
            spec = specs[name]
            choices = spec[1].get('options', spec[0] if isinstance(spec[0], list) else [])
            choices = [option.get('key') if isinstance(option, dict) else option for option in choices]
            if value not in choices:
                raise ValueError('Unknown pricing model: ' + value)
        def default(spec):
            kind = spec[0]
            options = spec[1] if len(spec) > 1 and isinstance(spec[1], dict) else {}
            if 'default' in options:
                return options['default']
            choices = options.get('options', kind if isinstance(kind, list) else [])
            if choices:
                return choices[0].get('key') if isinstance(choices[0], dict) else choices[0]
            return None
        for name, spec in list(specs.items()):
            if spec[0] != 'COMFY_DYNAMICCOMBO_V3':
                continue
            choice = overrides.get(name, default(spec))
            option = next((o for o in spec[1]['options'] if o['key'] == choice), None)
            if option is None:
                raise ValueError('Unknown model choice: ' + str(choice))
            nested = option.get('inputs', {})
            for key, value in {**nested.get('required', {}), **nested.get('optional', {})}.items():
                specs[name + '.' + key] = value
        badge = node['price_badge']
        if not badge:
            raise ValueError('No price_badge for ' + binding['nodeType'])
        values = {}
        for dep in badge['depends_on']['widgets']:
            name = dep['name']
            values[name] = overrides[name] if name in overrides else default(specs[name])
            if values[name] is None:
                raise ValueError('Missing pricing default: ' + name)
        rows.append({'routerId': binding['routerId'], 'nodeType': binding['nodeType'], 'priceBadge': badge, 'widgets': values, **({'useCases': binding['useCases']} if 'useCases' in binding else {})})
print(json.dumps(rows))
`
    ],
    {
      cwd: comfy,
      input: JSON.stringify(bindings),
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024
    }
  )
)
if (!Array.isArray(exported)) throw new Error('Expected exported pricing rows')
const rows = workshopNodePricingSchema.parse(
  exported.map((row: unknown) => {
    if (typeof row !== 'object' || row === null)
      throw new Error('Invalid pricing row')
    return { ...row, sourceCommit }
  })
)
const output = fileURLToPath(
  new URL('../src/data/workshop-node-pricing.json', import.meta.url)
)
writeFileSync(
  output,
  `[\n${rows.map((row) => JSON.stringify(row)).join(',\n')}\n]\n`
)
process.stdout.write(
  `Wrote ${rows.length} node pricing rules from ${sourceCommit}\n`
)
