import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { parseCoverageMetadata } from './coverage-metadata'

const ROOT = join(import.meta.dirname, '..')
const TSX = join(ROOT, 'node_modules/.bin/tsx')
const MODULE = join(import.meta.dirname, 'coverage-metadata.ts')

describe('parseCoverageMetadata', () => {
  it('reads the shard accounting written by the packager', () => {
    expect(
      parseCoverageMetadata(
        '{"shardsFound":14,"shardsExpected":16,"complete":false}'
      )
    ).toEqual({
      shardsFound: 14,
      shardsExpected: 16,
      complete: false,
      reason: undefined
    })
  })

  // Only `complete` gates the trust decision, so it must survive counts that
  // are absent or the wrong shape rather than being discarded with them.
  it.for([
    ['absent', '{"complete":false}'],
    ['non-numeric', '{"complete":false,"shardsFound":"14"}']
  ])(
    'honours an explicit incomplete flag when counts are %s',
    ([, content]) => {
      expect(parseCoverageMetadata(content)?.complete).toBe(false)
    }
  )

  it('omits fields it cannot read', () => {
    expect(parseCoverageMetadata('{"complete":true}')).toEqual({
      complete: true,
      shardsFound: undefined,
      shardsExpected: undefined,
      reason: undefined
    })
  })

  it('carries the reason an incomplete merge gives', () => {
    expect(
      parseCoverageMetadata('{"complete":false,"reason":"matrix did not pass"}')
        ?.reason
    ).toBe('matrix did not pass')
  })

  it('treats an empty reason as absent', () => {
    expect(
      parseCoverageMetadata('{"complete":true,"reason":""}')?.reason
    ).toBeUndefined()
  })

  it.for([
    ['malformed JSON', '{'],
    ['a JSON scalar', '42'],
    ['null', 'null'],
    ['a missing complete flag', '{"shardsFound":16,"shardsExpected":16}'],
    [
      'a non-boolean complete flag',
      '{"shardsFound":16,"shardsExpected":16,"complete":"yes"}'
    ]
  ])('returns null for %s', ([, content]) => {
    expect(parseCoverageMetadata(content)).toBeNull()
  })
})

// The notify workflow gates its baseline on this shim, so it must print a
// bare `true` only for a metadata file that reads as a whole merge.
describe('completeness CLI', () => {
  function run(contents: string | null) {
    const dir = mkdtempSync(join(tmpdir(), 'coverage-metadata-'))
    const target = join(dir, 'coverage-metadata.json')
    if (contents !== null) writeFileSync(target, contents)
    try {
      return spawnSync(TSX, [MODULE, target], { encoding: 'utf8' }).stdout
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  it('prints true only for a whole merge', () => {
    expect(run('{"shardsFound":16,"shardsExpected":16,"complete":true}')).toBe(
      'true'
    )
  })

  it.for([
    [
      'an incomplete merge',
      '{"shardsFound":14,"shardsExpected":16,"complete":false}'
    ],
    ['malformed metadata', '{ truncated'],
    ['metadata without a flag', '{}'],
    ['an absent file', null]
  ])('prints false for %s', ([, contents]) => {
    expect(run(contents)).toBe('false')
  })
})
