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

  it('counts a gap declared inside a block comment', () => {
    // Conversions write their reasoning as one `/* */` header rather than a
    // run of `//` lines, and the gap is stated inside it. Requiring a `//`
    // prefix let four such files report as converted while still asking for
    // API — the same defect that once hid 459 markers, one comment style down.
    const root = writeConversion(`/*
Supply-side resolution replaces the modify/serialize/restore bracket.

API-GAP (10): subgraphs. A supplier is invoked for one graph, and panels are
not nodes, so the broadcast cannot reach them.
*/
export function supply(view) {
  return view.self.outputs
}
`)

    expect(packStatus(root)).toMatchObject({
      totals: { converted: 0, refused: 0, outstanding: 1 },
      settled: 0
    })
  })

  it('still ignores the marker words in ordinary prose', () => {
    // The boundary: a file may discuss the vocabulary without declaring one.
    // Kept above the gutted threshold so this isolates the marker rule.
    const root = writeConversion(`/*
The original left no API-GAP behind; every export crossed the line.
*/
export function supply(view) {
  const outputs = view.self.outputs
  return outputs.filter((slot) => slot.type)
}
`)

    expect(packStatus(root)).toMatchObject({
      totals: { converted: 1, refused: 0, outstanding: 0 }
    })
  })
})
