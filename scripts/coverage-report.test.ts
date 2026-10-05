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

/** A string is written verbatim, so cases can supply unparseable metadata. */
function render(metadata: Record<string, unknown> | string | null): string {
  const dir = mkdtempSync(join(tmpdir(), 'coverage-report-'))
  const lcov = join(dir, 'coverage.lcov')
  writeFileSync(lcov, TRACEFILE)
  if (metadata !== null) {
    writeFileSync(
      join(dir, 'coverage-metadata.json'),
      typeof metadata === 'string' ? metadata : JSON.stringify(metadata)
    )
  }
  try {
    const result = spawnSync(TSX, [SCRIPT, lcov], { encoding: 'utf8' })
    // unified-report.ts runs this through execFileSync, which throws on a
    // nonzero exit and degrades the PR comment to a render failure. Returning
    // stdout regardless would let a case pass on output the report never got.
    if (result.status !== 0) {
      throw new Error(
        `coverage-report.ts exited ${result.status}: ${result.stderr}`
      )
    }
    return result.stdout
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('coverage-report shard banner', () => {
  it('says nothing extra for a whole merge', () => {
    const output = render({ complete: true })

    expect(output).not.toContain('[!WARNING]')
    expect(output).not.toContain('[!NOTE]')
    expect(output).toContain('| Lines | 3 | 6 | 50.0%')
  })

  // The totals may well be fine - a red matrix just cannot prove it. That
  // earns a note, not a warning.
  it('notes an unverified merge when the matrix did not pass', () => {
    const output = render({ complete: false })

    expect(output).toContain('[!NOTE]')
    expect(output).not.toContain('[!WARNING]')
    expect(output).toContain('cannot be confirmed comparable')
  })

  it('notes that completeness is unknown when metadata is absent', () => {
    const output = render(null)

    expect(output).toContain('[!NOTE]')
    expect(output).toContain('could not be verified')
  })

  // A sidecar that exists but cannot be parsed proves nothing, so it has to
  // read as unknown rather than throwing and taking the PR comment with it.
  it('notes that completeness is unknown when metadata is malformed', () => {
    const output = render('{ truncated')

    expect(output).toContain('[!NOTE]')
    expect(output).toContain('could not be verified')
  })

  it.for([
    ['absent metadata', null],
    ['malformed metadata', '{ truncated'],
    ['an unverified merge', { complete: false }]
  ] as const)('still reports the totals with %s', ([, metadata]) => {
    expect(render(metadata)).toContain('| Lines | 3 | 6 | 50.0%')
  })
})
