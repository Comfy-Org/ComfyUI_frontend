import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it, onTestFinished } from 'vitest'

import { CRITICAL_COVERAGE_DIRS } from './criticalCoverageDirs'
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
const BASE_SHA = 'a'.repeat(40)
const HEAD_SHA = 'b'.repeat(40)
const require = createRequire(import.meta.url)
const TSX_CLI = require.resolve('tsx/cli')
const EXTRACT_SCRIPT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  'extractCriticalCoverage.ts'
)

interface InvalidReportCase {
  name: string
  corrupt(report: CriticalCoverageReport): unknown
}

const INVALID_REPORT_CASES: InvalidReportCase[] = [
  {
    name: 'invalid commit SHA',
    corrupt(report) {
      return { ...report, sha: '--output=/tmp/coverage' }
    }
  },
  {
    name: 'a branch outside the recorded critical directories',
    corrupt(report) {
      return { ...report, criticalDirs: ['src/components'] }
    }
  },
  {
    name: 'fractional totals',
    corrupt(report) {
      return {
        ...report,
        totals: { ...report.totals, files: 0.5 }
      }
    }
  },
  {
    name: 'inconsistent totals',
    corrupt(report) {
      return {
        ...report,
        totals: { ...report.totals, branches: report.totals.branches + 1 }
      }
    }
  },
  {
    name: 'arbitrary branch keys',
    corrupt(report) {
      return {
        ...report,
        branches: report.branches.map((branch) => ({
          ...branch,
          key: 'arbitrary'
        }))
      }
    }
  },
  {
    name: 'duplicate branch keys',
    corrupt(report) {
      return {
        ...report,
        totals: {
          ...report.totals,
          branches: report.totals.branches * 2,
          coveredBranches: report.totals.coveredBranches * 2
        },
        branches: [...report.branches, ...report.branches]
      }
    }
  },
  {
    name: 'inconsistent branch coverage',
    corrupt(report) {
      return {
        ...report,
        totals: { ...report.totals, coveredBranches: 0 },
        branches: report.branches.map((branch) => ({
          ...branch,
          covered: false
        }))
      }
    }
  }
]

describe('createCriticalCoverageReport', () => {
  it('extracts critical branches and calculates coverage totals', () => {
    const fixture = createLcovFixture(`
SF:src/stores/queueStore.ts
BRDA:10,0,0,3
BRDA:10,0,1,0
BRDA:11,0,0,-
BRDA:0,0,2,1
BRDA:12,invalid,0,1
BRDA:13,0,0,1.5
end_of_record
SF:src/components/QueuePanel.vue
BRDA:20,0,0,4
end_of_record
`)

    const report = createCriticalCoverageReport({
      inputPath: fixture.inputPath,
      sha: HEAD_SHA,
      generatedAt: GENERATED_AT,
      cwd: fixture.directory
    })

    expect(report.totals).toEqual({
      files: 1,
      branches: 3,
      coveredBranches: 1
    })
    expect(
      report.branches.map(({ key, taken, covered }) => ({
        key,
        taken,
        covered
      }))
    ).toEqual([
      {
        key: 'src/stores/queueStore.ts:10:0:0',
        taken: 3,
        covered: true
      },
      {
        key: 'src/stores/queueStore.ts:10:0:1',
        taken: 0,
        covered: false
      },
      {
        key: 'src/stores/queueStore.ts:11:0:0',
        taken: null,
        covered: false
      }
    ])
  })

  it('merges duplicate branch records into a consistent coverage state', () => {
    const fixture = createLcovFixture(`
SF:src/stores/queueStore.ts
BRDA:10,0,0,-
BRDA:10,0,0,2
end_of_record
`)

    const report = createCriticalCoverageReport({
      inputPath: fixture.inputPath,
      sha: HEAD_SHA,
      generatedAt: GENERATED_AT,
      cwd: fixture.directory
    })

    expect(report.branches).toEqual([
      expect.objectContaining({ taken: 2, covered: true })
    ])
  })

  it('rejects an empty LCOV taken value', () => {
    const fixture = createLcovFixture(`
SF:src/stores/queueStore.ts
BRDA:10,0,0,
end_of_record
`)

    const report = createCriticalCoverageReport({
      inputPath: fixture.inputPath,
      sha: HEAD_SHA,
      generatedAt: GENERATED_AT,
      cwd: fixture.directory
    })

    expect(report.branches).toEqual([])
  })

  it('reports extraction errors without a stack trace', () => {
    const directory = createTempDirectory()
    const summaryPath = join(directory, 'summary.md')
    const missingPath = join(directory, 'missing.info')
    const result = spawnSync(
      process.execPath,
      [TSX_CLI, EXTRACT_SCRIPT_PATH, '--input', missingPath, '--sha', HEAD_SHA],
      {
        encoding: 'utf-8',
        env: { ...process.env, GITHUB_STEP_SUMMARY: summaryPath }
      }
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`ENOENT: no such file or directory`)
    expect(result.stderr).not.toContain('    at ')
    expect(readFileSync(summaryPath, 'utf-8')).toContain(
      'Critical Unit Coverage Extraction: ERROR'
    )
  })

  it.for([
    {
      name: 'an unknown option',
      args: ['--unknown'],
      expected: '--unknown'
    },
    {
      name: 'an incomplete option',
      args: ['--input', `--sha=${HEAD_SHA}`],
      expected: '--input'
    }
  ])('rejects $name', ({ args, expected }) => {
    const result = spawnSync(
      process.execPath,
      [TSX_CLI, EXTRACT_SCRIPT_PATH, ...args],
      { encoding: 'utf-8' }
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(expected)
    expect(result.stderr).not.toContain('    at ')
  })
})

describe('readCriticalCoverageReport', () => {
  it('accepts a report with its own valid critical-directory scope', () => {
    const directory = createTempDirectory()
    const inputPath = join(directory, 'coverage.json')
    const report = {
      ...createReport(HEAD_SHA, [
        createBranch('src/stores/queueStore.ts', true)
      ]),
      criticalDirs: ['src/stores']
    }
    writeFileSync(inputPath, JSON.stringify(report))

    expect(readCriticalCoverageReport(inputPath)).toEqual(report)
  })

  it('round-trips negative LCOV branch counts', () => {
    const fixture = createLcovFixture(`
SF:src/utils/linkFixer.ts
BRDA:449,72,1,-2
end_of_record
`)
    const outputPath = join(fixture.directory, 'coverage.json')
    const report = createCriticalCoverageReport({
      inputPath: fixture.inputPath,
      sha: HEAD_SHA,
      generatedAt: GENERATED_AT,
      cwd: fixture.directory
    })

    writeCriticalCoverageReport(report, outputPath)

    expect(readCriticalCoverageReport(outputPath)).toEqual(report)
  })

  it('round-trips branch ordinals reused on different lines', () => {
    const fixture = createLcovFixture(`
SF:src/stores/queueStore.ts
BRDA:10,0,0,1
BRDA:11,0,0,1
end_of_record
`)
    const outputPath = join(fixture.directory, 'coverage.json')
    const report = createCriticalCoverageReport({
      inputPath: fixture.inputPath,
      sha: HEAD_SHA,
      generatedAt: GENERATED_AT,
      cwd: fixture.directory
    })

    writeCriticalCoverageReport(report, outputPath)

    expect(readCriticalCoverageReport(outputPath)).toEqual(report)
  })

  it('rejects malformed artifacts', () => {
    const directory = createTempDirectory()
    const inputPath = join(directory, 'coverage.json')
    writeFileSync(
      inputPath,
      JSON.stringify({
        ...createReport(HEAD_SHA, []),
        branches: [{ key: 'invalid' }]
      })
    )

    expect(() => readCriticalCoverageReport(inputPath)).toThrow(
      `Invalid critical coverage report: ${inputPath}`
    )
  })

  it.for(INVALID_REPORT_CASES)('rejects $name', ({ corrupt }) => {
    const directory = createTempDirectory()
    const inputPath = join(directory, 'coverage.json')
    const report = createReport(HEAD_SHA, [
      createBranch('src/stores/queueStore.ts', true)
    ])
    writeFileSync(inputPath, JSON.stringify(corrupt(report)))

    expect(() => readCriticalCoverageReport(inputPath)).toThrow(
      `Invalid critical coverage report: ${inputPath}`
    )
  })
})

describe('compareCriticalCoverageReports', () => {
  it('reports covered base-only branches as regressions', () => {
    const shared = createBranch('src/stores/shared.ts', true)
    const base = createReport(BASE_SHA, [
      shared,
      createBranch('src/stores/base-only.ts', true)
    ])
    const head = createReport(HEAD_SHA, [
      shared,
      createBranch('src/stores/head-only.ts', false)
    ])

    expect(compareCriticalCoverageReports(base, head)).toMatchObject({
      commonBranches: 1,
      baseOnlyBranches: 1,
      headOnlyBranches: 1,
      commonCoveredBranchesInBase: 1,
      commonCoveredBranchesInHead: 1,
      coveredBranchDelta: 0,
      regressions: [
        expect.objectContaining({
          file: 'src/stores/base-only.ts',
          baseTaken: 1,
          headTaken: null
        })
      ]
    })
  })
})

function createLcovFixture(lcov: string): {
  directory: string
  inputPath: string
} {
  const directory = createTempDirectory()
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
    criticalDirs: CRITICAL_COVERAGE_DIRS,
    totals: {
      files: new Set(branches.map(({ file }) => file)).size,
      branches: branches.length,
      coveredBranches: branches.filter(({ covered }) => covered).length
    },
    branches
  }
}

function createBranch(file: string, covered: boolean): CriticalBranchCoverage {
  return {
    key: `${file}:1:0:0`,
    file,
    line: 1,
    block: '0',
    branch: '0',
    taken: covered ? 1 : 0,
    covered
  }
}
