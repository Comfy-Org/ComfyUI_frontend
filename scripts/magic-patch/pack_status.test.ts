import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { packStatus } from './pack_status.mjs'

const fixtureRoots: string[] = []

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function writeConversion(result: string) {
  const root = mkdtempSync(join(tmpdir(), 'magic-patch-status-'))
  fixtureRoots.push(root)
  const snapshot = join(root, 'example-pack', 'snapshot')
  const converted = join(snapshot, 'v2')
  mkdirSync(converted, { recursive: true })
  writeFileSync(join(snapshot, 'extension.js'), 'app.registerExtension({})\n')
  writeFileSync(join(converted, 'extension.js'), result)
  return root
}

describe('packStatus', () => {
  it('settles a retired legacy repair that declares nothing inoperable', () => {
    const root = writeConversion('// INOPERABLE: nothing — Nodes 2.0 owns it\n')

    expect(packStatus(root)).toMatchObject({
      totals: { converted: 1, refused: 0, outstanding: 0 },
      settled: 1
    })
  })
})
