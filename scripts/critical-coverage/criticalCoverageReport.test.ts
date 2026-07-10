import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { describe, expect, it, onTestFinished } from 'vitest'

import {
  compareCriticalCoverageReports,
  createCriticalCoverageReport,
  readCriticalCoverageReport,
  writeCriticalCoverageReport
} from './criticalCoverageReport'
import type {
  CriticalBranchCoverage,
  CriticalCoverageReport
} from './criticalCoverageReport'

const GENERATED_AT = '2026-07-10T00:00:00.000Z'

describe('createCriticalCoverageReport', () => {
  it('keeps only critical branch records and calculates totals', () => {
    const fixture = createLcovFixture(`
SF:src/stores/queueStore.ts
BRDA:10,0,0,3
BRDA:10,0,1,0
BRDA:11,0,0,-
end_of_record
SF:src/components/QueuePanel.vue
BRDA:20,0,0,4
end_of_record
`)

    const report = createCriticalCoverageReport({
      inputPath: fixture.inputPath,
      sha: 'head-sha',
      generatedAt: GENERATED_AT,
      cwd: fixture.directory
    })

    expect(report.totals).toEqual({
      files: 1,
      branches: 3,
      coveredBranches: 1
    })
    expect(report.branches).toEqual([
      {
        key: 'src/stores/queueStore.ts:10:0:0',
        file: 'src/stores/queueStore.ts',
        line: 10,
        block: '0',
        branch: '0',
        taken: 3,
        covered: true
      },
      {
        key: 'src/stores/queueStore.ts:10:0:1',
        file: 'src/stores/queueStore.ts',
        line: 10,
        block: '0',
        branch: '1',
        taken: 0,
        covered: false
      },
      {
        key: 'src/stores/queueStore.ts:11:0:0',
        file: 'src/stores/queueStore.ts',
        line: 11,
        block: '0',
        branch: '0',
        taken: null,
        covered: false
      }
    ])
  })

  it('normalizes absolute, file URL, external, and Windows-style paths', () => {
    const directory = createTempDirectory()
    const outsideSource = join(
      dirname(directory),
      'base',
      'src',
      'utils',
      'b.ts'
    )
    const fixture = createLcovFixture(
      `
SF:${join(directory, 'src', 'stores', 'a.ts')}
BRDA:1,0,0,1
SF:${pathToFileURL(join(directory, 'src', 'services', 'c.ts')).href}
BRDA:3,0,0,1
SF:${outsideSource}
BRDA:2,0,0,1
SF:src\\schemas\\d.ts
BRDA:4,0,0,1
`,
      directory
    )

    const report = createCriticalCoverageReport({
      inputPath: fixture.inputPath,
      sha: 'head-sha',
      generatedAt: GENERATED_AT,
      cwd: directory
    })

    expect(report.branches.map(({ file }) => file)).toEqual([
      'src/schemas/d.ts',
      'src/services/c.ts',
      'src/stores/a.ts',
      'src/utils/b.ts'
    ])
  })

  it('merges duplicate records and sorts branches deterministically', () => {
    const fixture = createLcovFixture(`
SF:src/utils/z.ts
BRDA:8,1,1,2
BRDA:7,0,0,1
end_of_record
SF:src/utils/z.ts
BRDA:8,1,1,3
end_of_record
SF:src/stores/a.ts
BRDA:2,0,0,1
end_of_record
`)

    const report = createCriticalCoverageReport({
      inputPath: fixture.inputPath,
      sha: 'head-sha',
      generatedAt: GENERATED_AT,
      cwd: fixture.directory
    })

    expect(report.branches.map(({ key, taken }) => [key, taken])).toEqual([
      ['src/stores/a.ts:2:0:0', 1],
      ['src/utils/z.ts:7:0:0', 1],
      ['src/utils/z.ts:8:1:1', 5]
    ])
  })

  it('ignores malformed branch records', () => {
    const fixture = createLcovFixture(`
SF:src/stores/queueStore.ts
BRDA:not-a-line,0,0,1
BRDA:10,,0,1
BRDA:11,0,,1
BRDA:12,0,0
BRDA:13,0,0,not-a-number
`)

    const report = createCriticalCoverageReport({
      inputPath: fixture.inputPath,
      sha: 'head-sha',
      generatedAt: GENERATED_AT,
      cwd: fixture.directory
    })

    expect(report.branches).toEqual([
      {
        key: 'src/stores/queueStore.ts:13:0:0',
        file: 'src/stores/queueStore.ts',
        line: 13,
        block: '0',
        branch: '0',
        taken: null,
        covered: false
      }
    ])
  })
})

describe('writeCriticalCoverageReport', () => {
  it('creates parent directories and writes newline-terminated JSON', () => {
    const fixture = createLcovFixture(`
SF:src/stores/queueStore.ts
BRDA:10,0,0,1
`)
    const report = createCriticalCoverageReport({
      inputPath: fixture.inputPath,
      sha: 'head-sha',
      generatedAt: GENERATED_AT,
      cwd: fixture.directory
    })
    const outputPath = join(fixture.directory, 'nested', 'coverage.json')

    writeCriticalCoverageReport(report, outputPath)

    const output = readFileSync(outputPath, 'utf-8')
    expect(output.endsWith('\n')).toBe(true)
    expect(JSON.parse(output)).toEqual(report)
    expect(readCriticalCoverageReport(outputPath)).toEqual(report)
  })
})

describe('readCriticalCoverageReport', () => {
  it.for([
    { name: 'missing report metadata', value: {} },
    {
      name: 'unsupported schema',
      value: { ...createReport('sha', []), schemaVersion: 2 }
    },
    {
      name: 'malformed totals',
      value: { ...createReport('sha', []), totals: { files: '1' } }
    },
    {
      name: 'malformed branch',
      value: { ...createReport('sha', []), branches: [{ key: 'invalid' }] }
    }
  ])('rejects $name', ({ value }) => {
    const directory = createTempDirectory()
    const inputPath = join(directory, 'coverage.json')
    writeFileSync(inputPath, JSON.stringify(value))

    expect(() => readCriticalCoverageReport(inputPath)).toThrow(
      `Invalid critical coverage report: ${inputPath}`
    )
  })
})

describe('compareCriticalCoverageReports', () => {
  it('reports positive coverage changes on the shared branch set', () => {
    const sharedCovered = createBranch('src/stores/a.ts', 1, true)
    const newlyCovered = createBranch('src/stores/a.ts', 2, false)
    const base = createReport('base-sha', [sharedCovered, newlyCovered])
    const head = createReport('head-sha', [
      sharedCovered,
      { ...newlyCovered, taken: 1, covered: true }
    ])

    expect(compareCriticalCoverageReports(base, head)).toMatchObject({
      baseSha: 'base-sha',
      headSha: 'head-sha',
      commonBranches: 2,
      commonCoveredBranchesInBase: 1,
      commonCoveredBranchesInHead: 2,
      coveredBranchDelta: 1,
      regressions: []
    })
  })

  it('reports regressions in deterministic order', () => {
    const base = createReport('base-sha', [
      createBranch('src/utils/z.ts', 9, true),
      createBranch('src/stores/a.ts', 3, true)
    ])
    const head = createReport(
      'head-sha',
      base.branches.map((branch) => ({
        ...branch,
        taken: 0,
        covered: false
      }))
    )

    const comparison = compareCriticalCoverageReports(base, head)

    expect(comparison.coveredBranchDelta).toBe(-2)
    expect(comparison.regressions).toEqual([
      {
        ...base.branches[1],
        baseTaken: 1,
        headTaken: 0
      },
      {
        ...base.branches[0],
        baseTaken: 1,
        headTaken: 0
      }
    ])
  })

  it('separates branch-universe drift from comparable coverage', () => {
    const shared = createBranch('src/stores/shared.ts', 1, true)
    const base = createReport('base-sha', [
      shared,
      createBranch('src/stores/base-only.ts', 2, true)
    ])
    const head = createReport('head-sha', [
      shared,
      createBranch('src/stores/head-only.ts', 3, false)
    ])

    expect(compareCriticalCoverageReports(base, head)).toMatchObject({
      commonBranches: 1,
      baseOnlyBranches: 1,
      headOnlyBranches: 1,
      commonCoveredBranchesInBase: 1,
      commonCoveredBranchesInHead: 1,
      coveredBranchDelta: 0
    })
  })
})

function createLcovFixture(
  lcov: string,
  directory = createTempDirectory()
): { directory: string; inputPath: string } {
  const inputPath = join(directory, 'lcov.info')
  writeFileSync(inputPath, lcov.trimStart())
  return { directory, inputPath }
}

function createTempDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'critical-coverage-'))
  onTestFinished(() => rmSync(directory, { recursive: true, force: true }))
  return directory
}

function createReport(
  sha: string,
  branches: CriticalBranchCoverage[]
): CriticalCoverageReport {
  return {
    schemaVersion: 1,
    source: 'lcov',
    sha,
    generatedAt: GENERATED_AT,
    inputPath: 'lcov.info',
    criticalDirs: ['src/stores'],
    totals: {
      files: new Set(branches.map(({ file }) => file)).size,
      branches: branches.length,
      coveredBranches: branches.filter(({ covered }) => covered).length
    },
    branches
  }
}

function createBranch(
  file: string,
  line: number,
  covered: boolean
): CriticalBranchCoverage {
  return {
    key: `${file}:${line}:0:0`,
    file,
    line,
    block: '0',
    branch: '0',
    taken: covered ? 1 : 0,
    covered
  }
}
