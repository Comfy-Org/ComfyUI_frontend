#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

const {
  values: { spec, file }
} = parseArgs({
  options: {
    spec: { type: 'string' },
    file: { type: 'string', default: 'package.json' }
  }
})
assert.match(
  spec ?? '',
  /^\d+\.\d+\.\d+$/,
  '--spec must name an exact stable npm version'
)

const manifest = JSON.parse(readFileSync(file, 'utf8'))
const name = '@comfyorg/comfy-multi-player'
assert.equal(manifest.dependencies[name], 'workspace:*')
manifest.dependencies[name] = spec
writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`)
process.stdout.write(`${file}: ${name} -> ${spec}\n`)
