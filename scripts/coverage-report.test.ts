import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..')
const TSX = join(ROOT, 'node_modules/.bin/tsx')
const SCRIPT = join(import.meta.dirname, 'coverage-report.ts')

const TRACEFILE = Array.from(
  { length: 3 },
  (_, index) =>
    `SF:src/components/Component${index}.vue\nDA:1,1\nDA:2,0\nLF:2\nLH:1\nend_of_record\n`
).join('')

function render(metadata: Record<string, unknown> | null): string {
  const dir = mkdtempSync(join(tmpdir(), 'coverage-report-'))
  const lcov = join(dir, 'coverage.lcov')
  writeFileSync(lcov, TRACEFILE)
  if (metadata) {
    writeFileSync(join(dir, 'coverage-metadata.json'), JSON.stringify(metadata))
  }
  try {
    return spawnSync(TSX, [SCRIPT, lcov], { encoding: 'utf8' }).stdout
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('coverage-report shard banner', () => {
  it('says nothing extra for a whole merge', () => {
    const output = render({
      shardsFound: 16,
      shardsExpected: 16,
      complete: true
    })

    expect(output).not.toContain('[!WARNING]')
    expect(output).not.toContain('[!NOTE]')
    expect(output).toContain('| Lines | 3 | 6 | 50.0%')
  })

  // A short shard count is provably non-comparable, so it warns outright.
  it('warns when shards are missing', () => {
    const output = render({
      shardsFound: 14,
      shardsExpected: 16,
      complete: false,
      reason: 'only 14 of 16 shards reported coverage'
    })

    expect(output).toContain('[!WARNING]')
    expect(output).toContain('only 14 of 16 shards reported coverage')
    expect(output).toContain('not comparable with a whole merge')
  })

  // Every shard reported, so the totals may well be fine - the run just
  // cannot prove it. That earns a note, not a warning.
  it('only notes an unverified merge when every shard reported', () => {
    const output = render({
      shardsFound: 16,
      shardsExpected: 16,
      complete: false,
      reason: 'the matrix did not pass'
    })

    expect(output).toContain('[!NOTE]')
    expect(output).not.toContain('[!WARNING]')
    expect(output).toContain('cannot be confirmed comparable')
  })

  it('notes that completeness is unknown when metadata is absent', () => {
    const output = render(null)

    expect(output).toContain('[!NOTE]')
    expect(output).toContain('could not be verified')
  })

  it('still reports the totals whatever the banner says', () => {
    for (const metadata of [
      null,
      { shardsFound: 1, shardsExpected: 16, complete: false }
    ]) {
      expect(render(metadata)).toContain('| Lines | 3 | 6 | 50.0%')
    }
  })
})
