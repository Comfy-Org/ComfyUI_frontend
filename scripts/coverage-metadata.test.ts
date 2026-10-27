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
  it('reads what the packager wrote', () => {
    expect(
      parseCoverageMetadata('{"complete":false,"sourceSha":"abc1234"}')
    ).toEqual({ complete: false, sourceSha: 'abc1234' })
  })

  it('omits a source sha it cannot read', () => {
    expect(parseCoverageMetadata('{"complete":true}')).toEqual({
      complete: true,
      sourceSha: undefined
    })
  })

  it('ignores unrelated fields rather than rejecting the file', () => {
    expect(
      parseCoverageMetadata('{"complete":true,"shardsFound":14}')?.complete
    ).toBe(true)
  })

  it.for([
    ['malformed JSON', '{'],
    ['a JSON scalar', '42'],
    ['null', 'null'],
    ['a missing complete flag', '{"sourceSha":"abc1234"}'],
    ['a non-boolean complete flag', '{"complete":"yes"}']
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
      const result = spawnSync(TSX, [MODULE, target], { encoding: 'utf8' })
      // The workflow reads this under `bash -e`, so a nonzero exit fails the
      // step rather than yielding a value. A case must not pass on stdout the
      // step would never have used.
      if (result.status !== 0) {
        throw new Error(
          `coverage-metadata.ts exited ${result.status}: ${result.stderr}`
        )
      }
      return result.stdout
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  it('prints true only for a whole merge', () => {
    expect(run('{"complete":true,"sourceSha":"abc1234"}')).toBe('true')
  })

  it.for([
    ['an incomplete merge', '{"complete":false}'],
    ['malformed metadata', '{ truncated'],
    ['metadata without a flag', '{}'],
    ['an absent file', null]
  ])('prints false for %s', ([, contents]) => {
    expect(run(contents)).toBe('false')
  })
})
