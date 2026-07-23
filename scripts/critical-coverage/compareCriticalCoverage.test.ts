import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it, onTestFinished } from 'vitest'

import { CRITICAL_COVERAGE_DIRS } from './criticalCoverageDirs'
import {
  readCriticalCoverageReport,
  writeCriticalCoverageReport
} from './criticalCoverageReport'
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

interface SourceChange {
  base: string
  head: string
  headPath?: string
}

const BASE_SHA = 'a'.repeat(40)
const HEAD_SHA = 'b'.repeat(40)

describe('compareCriticalCoverage CLI', () => {
  it('passes a non-negative delta and writes the job summary', () => {
    const directory = createTempDirectory()
    const summaryPath = join(directory, 'summary.md')
    const shared = createBranch('src/stores/a.ts', true)
    const paths = writeReports(
      directory,
      createReport(BASE_SHA, [shared]),
      createReport(HEAD_SHA, [shared])
    )

    const result = runComparison(paths, { GITHUB_STEP_SUMMARY: summaryPath })

    expect(result.status).toBe(0)
    const summary = readFileSync(summaryPath, 'utf-8')
    expect(summary).toContain('Critical Unit Coverage Gate: PASS')
    expect(summary).toContain('| Covered branch delta | 0 |')
  })

  it('fails a negative delta and lists the regressed branch', () => {
    const directory = createTempDirectory()
    const covered = createBranch('src/stores/a.ts', true)
    const paths = writeReports(
      directory,
      createReport(BASE_SHA, [covered]),
      createReport(HEAD_SHA, [{ ...covered, taken: 0, covered: false }])
    )

    const result = runComparison(paths)

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('Critical Unit Coverage Gate: FAIL')
    expect(result.stdout).toContain('| Covered branch delta | -1 |')
    expect(result.stdout).toContain('| `src/stores/a.ts` | 1 | 0:0 | 1 | 0 |')
    expect(result.stderr).toContain('regressed on 1 previously covered branch')
  })

  it('renders an unknown taken count as unavailable', () => {
    const directory = createTempDirectory()
    const covered = createBranch('src/stores/a.ts', true)
    const paths = writeReports(
      directory,
      createReport(BASE_SHA, [covered]),
      createReport(HEAD_SHA, [{ ...covered, taken: null, covered: false }])
    )

    const result = runComparison(paths)

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('| `src/stores/a.ts` | 1 | 0:0 | 1 | - |')
  })

  it('fails when newly covered branches offset a regression', () => {
    const directory = createTempDirectory()
    const regressed = createBranch('src/stores/regressed.ts', true)
    const improved = createBranch('src/stores/improved.ts', false)
    const paths = writeReports(
      directory,
      createReport(BASE_SHA, [regressed, improved]),
      createReport(HEAD_SHA, [
        { ...regressed, taken: 0, covered: false },
        { ...improved, taken: 1, covered: true }
      ])
    )

    const result = runComparison(paths)

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('| Covered branch delta | 0 |')
    expect(result.stderr).toContain('regressed on 1 previously covered branch')
  })

  it('fails when a covered branch disappears from unchanged source', () => {
    const directory = createTempDirectory()
    const shared = createBranch('src/stores/shared.ts', true)
    const missing = createBranch('src/stores/missing.ts', true)
    const paths = writeReports(
      directory,
      createReport(BASE_SHA, [shared, missing]),
      createReport(HEAD_SHA, [shared])
    )

    const result = runComparison(paths)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('regressed on 1 previously covered branch')
    expect(result.stdout).toContain(
      '| `src/stores/missing.ts` | 1 | 0:0 | 1 | - |'
    )
  })

  it('ignores a covered branch on a changed source line', () => {
    const directory = createTempDirectory()
    const file = 'src/stores/changed.ts'
    const shared = createBranch('src/stores/shared.ts', true)
    const paths = writeReports(
      directory,
      createReport(BASE_SHA, [shared, createBranch(file, true)]),
      createReport(HEAD_SHA, [shared])
    )

    const result = runComparison(
      paths,
      {},
      {
        [file]: {
          base: 'export const changed = value ? 1 : 0\n',
          head: 'export const changed = value ?? 0\n'
        }
      }
    )

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('| Base-only branches | 1 |')
  })

  it('fails when a covered branch moves and becomes uncovered', () => {
    const directory = createTempDirectory()
    const shared = createBranch('src/stores/shared.ts', true)
    const moved = createBranch('src/stores/moved.ts', true)
    const paths = writeReports(
      directory,
      createReport(BASE_SHA, [shared, moved]),
      createReport(HEAD_SHA, [
        shared,
        {
          ...moved,
          key: 'src/stores/moved.ts:2:0:0',
          line: 2,
          taken: 0,
          covered: false
        }
      ])
    )

    const result = runComparison(
      paths,
      {},
      {
        'src/stores/moved.ts': {
          base: 'export const moved = value ? 1 : 0\n',
          head: '\nexport const moved = value ? 1 : 0\n'
        }
      }
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('regressed on 1 previously covered branch')
  })

  it('fails when an inserted branch renumbers later LCOV blocks', () => {
    const directory = createTempDirectory()
    const file = 'src/stores/renumbered.ts'
    const target = createBranch(file, true)
    const inserted = createBranch(file, true)
    const paths = writeReports(
      directory,
      createReport(BASE_SHA, [target]),
      createReport(HEAD_SHA, [
        inserted,
        {
          ...target,
          key: `${file}:2:1:0`,
          line: 2,
          block: '1',
          taken: 0,
          covered: false
        }
      ])
    )

    const result = runComparison(
      paths,
      {},
      {
        [file]: {
          base: 'export const target = value ? 1 : 0\n',
          head: 'export const inserted = other ? 1 : 0\nexport const target = value ? 1 : 0\n'
        }
      }
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('regressed on 1 previously covered branch')
  })

  it('fails when same-line branch ordinals cross a digit boundary', () => {
    const directory = createTempDirectory()
    const file = 'src/stores/doubleDigit.ts'
    const baseCovered = createBranch(file, true, '9')
    const baseUncovered = createBranch(file, false, '10')
    const headUncovered = createBranch(file, false, '10')
    const headCovered = createBranch(file, true, '11')
    const paths = writeReports(
      directory,
      createReport(BASE_SHA, [baseCovered, baseUncovered]),
      createReport(HEAD_SHA, [headUncovered, headCovered])
    )

    const result = runComparison(paths)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('regressed on 1 previously covered branch')
  })

  it('fails when a renamed critical file loses branch coverage', () => {
    const directory = createTempDirectory()
    const baseFile = 'src/stores/renamedBase.ts'
    const headFile = 'src/stores/renamedHead.ts'
    const shared = createBranch('src/stores/shared.ts', true)
    const baseBranch = createBranch(baseFile, true)
    const headBranch = createBranch(headFile, false)
    const paths = writeReports(
      directory,
      createReport(BASE_SHA, [shared, baseBranch]),
      createReport(HEAD_SHA, [shared, headBranch])
    )
    const source = 'export const renamed = value ? 1 : 0\n'

    const result = runComparison(
      paths,
      {},
      {
        [baseFile]: { base: source, head: source, headPath: headFile }
      }
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('regressed on 1 previously covered branch')
  })

  it('fails when the reports have no comparable branches', () => {
    const directory = createTempDirectory()
    const summaryPath = join(directory, 'summary.md')
    const paths = writeReports(
      directory,
      createReport(BASE_SHA, [createBranch('src/stores/base.ts', true)]),
      createReport(HEAD_SHA, [createBranch('src/stores/head.ts', true)])
    )

    const result = runComparison(paths, { GITHUB_STEP_SUMMARY: summaryPath })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      'No comparable critical unit branches found (base: 1, head: 1)'
    )
    expect(readFileSync(summaryPath, 'utf-8')).toContain(
      'Critical Unit Coverage Gate: FAIL'
    )
  })

  it('fails when the head removes a critical directory', () => {
    const directory = createTempDirectory()
    const shared = createBranch('src/stores/shared.ts', true)
    const paths = writeReports(
      directory,
      createReport(BASE_SHA, [shared], ['src/stores', 'src/utils']),
      createReport(HEAD_SHA, [shared], ['src/stores'])
    )

    const result = runComparison(paths)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      'Critical coverage scope removed: src/utils'
    )
  })

  it('allows the head to add a critical directory', () => {
    const directory = createTempDirectory()
    const shared = createBranch('src/stores/shared.ts', true)
    const paths = writeReports(
      directory,
      createReport(BASE_SHA, [shared], ['src/stores']),
      createReport(HEAD_SHA, [shared], ['src/stores', 'src/utils'])
    )

    expect(runComparison(paths).status).toBe(0)
  })

  it('reports input errors without a stack trace', () => {
    const directory = createTempDirectory()
    const summaryPath = join(directory, 'summary.md')
    const missingPath = join(directory, 'missing.json')
    const result = spawnSync(
      process.execPath,
      [TSX_CLI, SCRIPT_PATH, '--base', missingPath, '--head', missingPath],
      {
        cwd: directory,
        encoding: 'utf-8',
        env: { ...process.env, GITHUB_STEP_SUMMARY: summaryPath }
      }
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`ENOENT: no such file or directory`)
    expect(result.stderr).not.toContain('    at ')
    expect(readFileSync(summaryPath, 'utf-8')).toContain(
      'Critical Unit Coverage Gate: ERROR'
    )
  })

  it('rejects unknown options', () => {
    const result = spawnSync(
      process.execPath,
      [TSX_CLI, SCRIPT_PATH, '--unknown'],
      { encoding: 'utf-8' }
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('--unknown')
    expect(result.stderr).not.toContain('    at ')
  })
})

function runComparison(
  paths: { basePath: string; headPath: string },
  env: NodeJS.ProcessEnv = {},
  sourceChanges?: Record<string, SourceChange>
): ReturnType<typeof spawnSync> {
  const cwd = dirname(paths.basePath)
  const { baseSha, headSha } = createGitHistory(cwd, sourceChanges ?? {})
  updateReportSha(paths.basePath, baseSha)
  updateReportSha(paths.headPath, headSha)

  return spawnSync(
    process.execPath,
    [TSX_CLI, SCRIPT_PATH, '--base', paths.basePath, '--head', paths.headPath],
    {
      cwd,
      encoding: 'utf-8',
      env: { ...process.env, ...env }
    }
  )
}

function createGitHistory(
  directory: string,
  sourceChanges: Record<string, SourceChange>
): { baseSha: string; headSha: string } {
  execFileSync('git', ['init', '-q'], { cwd: directory })
  execFileSync('git', ['config', 'user.email', 'test@example.com'], {
    cwd: directory
  })
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: directory })

  writeFileSync(join(directory, 'fixture.txt'), 'base\n')

  for (const [path, change] of Object.entries(sourceChanges)) {
    const absolutePath = join(directory, path)
    mkdirSync(dirname(absolutePath), { recursive: true })
    writeFileSync(absolutePath, change.base)
  }

  execFileSync('git', ['add', 'fixture.txt', ...Object.keys(sourceChanges)], {
    cwd: directory
  })
  execFileSync('git', ['commit', '-q', '-m', 'base'], { cwd: directory })
  const baseSha = gitSha(directory)

  for (const [path, change] of Object.entries(sourceChanges)) {
    const headPath = change.headPath ?? path

    if (headPath !== path) {
      mkdirSync(dirname(join(directory, headPath)), { recursive: true })
      execFileSync('git', ['mv', path, headPath], { cwd: directory })
    }

    writeFileSync(join(directory, headPath), change.head)
  }

  if (Object.keys(sourceChanges).length > 0) {
    const changedPaths = Object.entries(sourceChanges).map(
      ([path, change]) => change.headPath ?? path
    )
    execFileSync('git', ['add', '-A', '--', ...changedPaths], {
      cwd: directory
    })
  }

  execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'head'], {
    cwd: directory
  })

  return { baseSha, headSha: gitSha(directory) }
}

function updateReportSha(path: string, sha: string): void {
  const report = readCriticalCoverageReport(path)
  writeCriticalCoverageReport({ ...report, sha }, path)
}

function gitSha(directory: string): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: directory,
    encoding: 'utf-8'
  }).trim()
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
  branches: CriticalBranchCoverage[],
  criticalDirs: readonly string[] = CRITICAL_COVERAGE_DIRS
): CriticalCoverageReport {
  return {
    schemaVersion: 1,
    source: 'lcov',
    sha,
    generatedAt: '2026-07-10T00:00:00.000Z',
    inputPath: 'lcov.info',
    criticalDirs,
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
  covered: boolean,
  block = '0'
): CriticalBranchCoverage {
  return {
    key: `${file}:1:${block}:0`,
    file,
    line: 1,
    block,
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
