import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { CoverageMetadata } from './coverage-metadata'
import { buildPayload, parseLcovContent } from './coverage-slack-notify'

const ROOT = join(import.meta.dirname, '..')
const TSX = join(ROOT, 'node_modules/.bin/tsx')
const SCRIPT = join(import.meta.dirname, 'coverage-slack-notify.ts')

const E2E = 'temp/e2e-coverage'
const E2E_BASELINE = 'temp/e2e-coverage-baseline'
const UNIT_TRACEFILE = 'coverage/lcov.info'
const UNIT_BASELINE_TRACEFILE = 'temp/coverage-baseline/lcov.info'

const CONTEXT = {
  prUrl: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/7',
  prNumber: '7',
  author: 'someone'
}

function lcov(entries: [file: string, lf: number, lh: number][]): string {
  return entries
    .map(([file, lf, lh]) => `SF:${file}\nLF:${lf}\nLH:${lh}\nend_of_record`)
    .join('\n')
}

function sourceEntries(
  count: number,
  lf: number,
  lh: number
): [string, number, number][] {
  return Array.from({ length: count }, (_, i) => [
    `src/components/Component${i}.vue`,
    lf,
    lh
  ])
}

/** A tracefile whose overall line coverage is exactly `percentage`. */
function tracefile(percentage: number): string {
  return lcov(sourceEntries(120, 100, percentage))
}

function coverage(percentage: number) {
  return {
    percentage,
    totalLines: 1000,
    coveredLines: Math.round(percentage * 10)
  }
}

const NO_DATA = { current: null, baseline: null }

function notifyFixture() {
  const root = mkdtempSync(join(tmpdir(), 'coverage-notify-'))

  function write(relativePath: string, contents: string) {
    const target = join(root, relativePath)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, contents)
  }

  return {
    root,
    write,
    writeCoverage(
      directory: string,
      percentage: number,
      metadata?: CoverageMetadata
    ) {
      write(`${directory}/coverage.lcov`, tracefile(percentage))
      if (metadata) {
        write(`${directory}/coverage-metadata.json`, JSON.stringify(metadata))
      }
    },
    run(unitSpan: { from?: string; to?: string } = {}) {
      const result = spawnSync(
        TSX,
        [
          SCRIPT,
          `--pr-url=${CONTEXT.prUrl}`,
          `--pr-number=${CONTEXT.prNumber}`,
          `--author=${CONTEXT.author}`,
          `--unit-span-from=${unitSpan.from ?? ''}`,
          `--unit-span-to=${unitSpan.to ?? ''}`
        ],
        { cwd: root, encoding: 'utf8' }
      )
      return {
        status: result.status,
        stdout: result.stdout.trim(),
        stderr: result.stderr
      }
    },
    [Symbol.dispose]() {
      rmSync(root, { recursive: true, force: true })
    }
  }
}

describe('parseLcovContent', () => {
  it('reports the ratio of covered to total lines', () => {
    const result = parseLcovContent(lcov(sourceEntries(120, 10, 7)))

    expect(result).toEqual({
      percentage: 70,
      totalLines: 1200,
      coveredLines: 840
    })
  })

  it('ignores files outside src/ and packages/', () => {
    const result = parseLcovContent(
      lcov([
        ...sourceEntries(120, 10, 5),
        ['localhost-8188/assets/index-a1b2c3.js', 1000, 1000],
        ['js.stripe.com/dahlia/stripe.js', 500, 500]
      ])
    )

    expect(result?.totalLines).toBe(1200)
    expect(result?.percentage).toBe(50)
  })

  // E2E coverage that fails to map back to source leaves only third-party
  // scripts behind, which are fully covered and would report as 100%.
  it('returns null when too few project files are present', () => {
    expect(
      parseLcovContent(lcov([['js.stripe.com/dahlia/stripe.js', 500, 500]]))
    ).toBeNull()

    expect(parseLcovContent(lcov(sourceEntries(99, 10, 10)))).toBeNull()
    expect(parseLcovContent(lcov(sourceEntries(100, 10, 10)))).not.toBeNull()
  })

  it('returns null for an empty tracefile', () => {
    expect(parseLcovContent('')).toBeNull()
  })
})

describe('buildPayload', () => {
  it('announces a decrease rather than staying silent', () => {
    const payload = buildPayload(
      NO_DATA,
      { current: coverage(63.5), baseline: coverage(67.2) },
      CONTEXT
    )

    expect(payload?.text).toBe('Coverage decreased')
    expect(payload?.blocks[0]?.text.text).toContain(
      '*E2E:*  67.2% → 63.5%  (-3.7%)'
    )
  })

  it('announces an increase', () => {
    const payload = buildPayload(
      NO_DATA,
      { current: coverage(67.2), baseline: coverage(63.5) },
      CONTEXT
    )

    expect(payload?.text).toBe('Coverage improved!')
    expect(payload?.blocks[0]?.text.text).toContain(
      '*E2E:*  63.5% → 67.2%  (+3.7%)'
    )
  })

  it('reports both directions when one metric rises and the other falls', () => {
    const payload = buildPayload(
      { current: coverage(71), baseline: coverage(70) },
      { current: coverage(63), baseline: coverage(67) },
      CONTEXT
    )

    expect(payload?.text).toBe('Coverage changed')
    expect(payload?.blocks[0]?.text.text).toContain('*Unit:*  70.0% → 71.0%')
    expect(payload?.blocks[0]?.text.text).toContain('*E2E:*  67.0% → 63.0%')
  })

  it('returns null when no metric moved past the threshold', () => {
    expect(
      buildPayload(
        { current: coverage(70.01), baseline: coverage(70) },
        NO_DATA,
        CONTEXT
      )
    ).toBeNull()
  })

  it('returns null when a metric has no baseline to compare against', () => {
    expect(
      buildPayload(NO_DATA, { current: coverage(67), baseline: null }, CONTEXT)
    ).toBeNull()
  })

  it('does not celebrate a milestone on the way down', () => {
    const payload = buildPayload(
      NO_DATA,
      { current: coverage(64), baseline: coverage(67) },
      CONTEXT
    )

    expect(payload?.blocks).toHaveLength(1)
  })

  it('celebrates a milestone crossed on the way up', () => {
    const payload = buildPayload(
      NO_DATA,
      { current: coverage(67), baseline: coverage(64) },
      CONTEXT
    )

    expect(payload?.blocks[1]?.text.text).toContain(
      'MILESTONE: E2E test coverage hit 65%!'
    )
  })
})

describe('unverified shard merges', () => {
  it('reports E2E movement when the merge is verified whole', () => {
    using fixture = notifyFixture()
    fixture.writeCoverage(E2E_BASELINE, 64, { complete: true })
    fixture.writeCoverage(E2E, 67, { complete: true })

    const result = fixture.run()

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('64.0% → 67.0%')
  })

  // The movement an unverified run appears to make can be an artifact of a
  // shard that stopped early, not coverage the team gained or lost.
  it('says nothing when the merge is not verified whole', () => {
    using fixture = notifyFixture()
    fixture.writeCoverage(E2E_BASELINE, 64)
    fixture.writeCoverage(E2E, 67, { complete: false })

    const result = fixture.run()

    expect(result.status).toBe(0)
    expect(result.stdout).toBe('')
  })

  // Absence must not read as "whole": otherwise narrowing the uploaded
  // artifact back to coverage.lcov alone would quietly restore the old
  // behaviour of publishing non-comparable numbers.
  it('withholds E2E when the artifact carries no shard metadata', () => {
    using fixture = notifyFixture()
    fixture.writeCoverage(E2E_BASELINE, 64)
    fixture.writeCoverage(E2E, 67)

    const result = fixture.run()

    expect(result.status).toBe(0)
    expect(result.stdout).toBe('')
  })

  it('withholds E2E when the shard metadata is unreadable', () => {
    using fixture = notifyFixture()
    fixture.writeCoverage(E2E_BASELINE, 64)
    fixture.writeCoverage(E2E, 67)
    fixture.write(`${E2E}/coverage-metadata.json`, '{ truncated')

    const result = fixture.run()

    expect(result.status).toBe(0)
    expect(result.stdout).toBe('')
  })

  it('still reports unit coverage while E2E is withheld', () => {
    using fixture = notifyFixture()
    fixture.write(UNIT_BASELINE_TRACEFILE, tracefile(70))
    fixture.write(UNIT_TRACEFILE, tracefile(72))
    fixture.writeCoverage(E2E_BASELINE, 64)
    fixture.writeCoverage(E2E, 67)

    const result = fixture.run()

    expect(result.stdout).toContain('*Unit:*  70.0% → 72.0%')
    expect(result.stdout).not.toContain('E2E')
  })
})

// The baseline only advances on whole merges, so a delta can span several of
// them. The report has to say so instead of pinning it on one PR.
describe('comparison span', () => {
  it('names the commit the baseline measured', () => {
    using fixture = notifyFixture()
    fixture.writeCoverage(E2E_BASELINE, 64, {
      complete: true,
      sourceSha: 'abc1234def5678'
    })
    fixture.writeCoverage(E2E, 67, {
      complete: true,
      sourceSha: '9876543fedcba0'
    })

    const result = fixture.run()

    expect(result.stdout).toContain(
      'E2E coverage compared against `abc1234` (last whole merge) through `9876543`'
    )
    expect(result.stdout).toContain('may cover several merges')
  })

  // Baselines stored before this gate existed are bare coverage.lcov files
  // saved from any merge, whole or not. search_artifacts walks back to them,
  // so the first run after this ships must withhold rather than publish an
  // unvetted delta — with no span note and no milestone to dress it up.
  it('withholds a baseline that cannot prove it was whole', () => {
    using fixture = notifyFixture()
    fixture.writeCoverage(E2E_BASELINE, 64)
    fixture.writeCoverage(E2E, 67, {
      complete: true,
      sourceSha: '9876543fedcba0'
    })

    const result = fixture.run()

    expect(result.status).toBe(0)
    expect(result.stdout).toBe('')
  })

  it('withholds a baseline whose own metadata says it was unverified', () => {
    using fixture = notifyFixture()
    fixture.writeCoverage(E2E_BASELINE, 64, {
      complete: false,
      sourceSha: 'abc1234def5678'
    })
    fixture.writeCoverage(E2E, 67, {
      complete: true,
      sourceSha: '9876543fedcba0'
    })

    const result = fixture.run()

    expect(result.status).toBe(0)
    expect(result.stdout).toBe('')
  })

  it('reports once both sides prove they were whole', () => {
    using fixture = notifyFixture()
    fixture.writeCoverage(E2E_BASELINE, 64, { complete: true })
    fixture.writeCoverage(E2E, 67, {
      complete: true,
      sourceSha: '9876543fedcba0'
    })

    const result = fixture.run()

    expect(result.stdout).toContain('64.0% → 67.0%')
    expect(result.stdout).not.toContain('last whole merge')
  })

  // The unit baseline is the nearest measured ancestor, which is not always
  // the direct parent, so its delta can cover merges the named PR did not
  // make. The workflow passes the span only in that case.
  it('names the commits a unit delta spans', () => {
    using fixture = notifyFixture()
    fixture.write(UNIT_BASELINE_TRACEFILE, tracefile(70))
    fixture.write(UNIT_TRACEFILE, tracefile(72))

    const result = fixture.run({ from: 'aaaaaaabbbbbb', to: 'cccccccdddddd' })

    expect(result.stdout).toContain(
      'Unit coverage compared against `aaaaaaa` (last measured merge) through `ccccccc`'
    )
    expect(result.stdout).toContain('may cover several merges')
  })

  // The common case: the ancestor is the direct parent and the delta is
  // exactly this PR, so the workflow passes the head sha and no origin.
  // Hedging every report would make the note meaningless on those that need it.
  it('stays silent about the span when the delta is one merge', () => {
    using fixture = notifyFixture()
    fixture.write(UNIT_BASELINE_TRACEFILE, tracefile(70))
    fixture.write(UNIT_TRACEFILE, tracefile(72))

    const result = fixture.run({ to: 'cccccccdddddd' })

    expect(result.stdout).toContain('*Unit:*  70.0% → 72.0%')
    expect(result.stdout).not.toContain('compared against')
  })
})
