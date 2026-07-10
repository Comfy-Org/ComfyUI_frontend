import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it, onTestFinished } from 'vitest'

import { writeCriticalCoverageReport } from './criticalCoverageReport'
import type {
  CriticalBranchCoverage,
  CriticalCoverageReport
} from './criticalCoverageReport'

const require = createRequire(import.meta.url)
const TSX_CLI = require.resolve('tsx/cli')
const SCRIPT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  'compareCriticalCoverage.ts'
)

describe('compareCriticalCoverage CLI', () => {
  it('passes a non-negative delta and writes the job summary', () => {
    const directory = createTempDirectory()
    const summaryPath = join(directory, 'summary.md')
    const shared = createBranch('src/stores/a.ts', true)
    const paths = writeReports(
      directory,
      createReport('base-sha', [shared]),
      createReport('head-sha', [shared])
    )

    const result = runComparison(paths, { GITHUB_STEP_SUMMARY: summaryPath })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Critical Unit Coverage Gate: PASS')
    expect(result.stdout).toContain('| Covered branch delta | 0 |')
    expect(readFileSync(summaryPath, 'utf-8')).toBe(result.stdout)
  })

  it('fails a negative delta and lists the regressed branch', () => {
    const directory = createTempDirectory()
    const covered = createBranch('src/stores/a.ts', true)
    const paths = writeReports(
      directory,
      createReport('base-sha', [covered]),
      createReport('head-sha', [{ ...covered, taken: 0, covered: false }])
    )

    const result = runComparison(paths)

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('Critical Unit Coverage Gate: FAIL')
    expect(result.stdout).toContain('| Covered branch delta | -1 |')
    expect(result.stdout).toContain('| `src/stores/a.ts` | 1 | 0:0 | 1 | 0 |')
    expect(result.stderr).toContain('dropped by 1 covered branches')
  })

  it('fails when the reports have no comparable branches', () => {
    const directory = createTempDirectory()
    const paths = writeReports(
      directory,
      createReport('base-sha', [createBranch('src/stores/base.ts', true)]),
      createReport('head-sha', [createBranch('src/stores/head.ts', true)])
    )

    const result = runComparison(paths)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      'No comparable critical unit branches found'
    )
  })

  it('fails with usage guidance when report paths are missing', () => {
    const result = spawnSync(process.execPath, [TSX_CLI, SCRIPT_PATH], {
      encoding: 'utf-8'
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      'Usage: compareCriticalCoverage --base <json> --head <json>'
    )
  })
})

function runComparison(
  paths: { basePath: string; headPath: string },
  env: NodeJS.ProcessEnv = {}
): ReturnType<typeof spawnSync> {
  return spawnSync(
    process.execPath,
    [TSX_CLI, SCRIPT_PATH, '--base', paths.basePath, '--head', paths.headPath],
    {
      encoding: 'utf-8',
      env: { ...process.env, ...env }
    }
  )
}

function writeReports(
  directory: string,
  base: CriticalCoverageReport,
  head: CriticalCoverageReport
): { basePath: string; headPath: string } {
  const basePath = join(directory, 'base.json')
  const headPath = join(directory, 'head.json')
  writeCriticalCoverageReport(base, basePath)
  writeCriticalCoverageReport(head, headPath)
  return { basePath, headPath }
}

function createReport(
  sha: string,
  branches: CriticalBranchCoverage[]
): CriticalCoverageReport {
  return {
    schemaVersion: 1,
    source: 'lcov',
    sha,
    generatedAt: '2026-07-10T00:00:00.000Z',
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

function createTempDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'critical-coverage-cli-'))
  onTestFinished(() => rmSync(directory, { recursive: true, force: true }))
  return directory
}
