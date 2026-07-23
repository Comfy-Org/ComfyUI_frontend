import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CRITICAL_COVERAGE_DIRS,
  isCriticalCoveragePath
} from './criticalCoverageDirs'

export interface CriticalBranchCoverage {
  key: string
  file: string
  line: number
  block: string
  branch: string
  taken: number | null
  covered: boolean
}

export interface CriticalCoverageReport {
  schemaVersion: 1
  source: 'lcov'
  sha: string
  generatedAt: string
  inputPath: string
  criticalDirs: readonly string[]
  totals: {
    files: number
    branches: number
    coveredBranches: number
  }
  branches: CriticalBranchCoverage[]
}

export interface CriticalCoverageRegression extends CriticalBranchCoverage {
  baseTaken: number | null
  headTaken: number | null
}

export interface CriticalCoverageComparison {
  baseSha: string
  headSha: string
  commonBranches: number
  baseOnlyBranches: number
  headOnlyBranches: number
  commonCoveredBranchesInBase: number
  commonCoveredBranchesInHead: number
  coveredBranchDelta: number
  regressions: CriticalCoverageRegression[]
}

interface CreateReportOptions {
  inputPath: string
  sha: string
  generatedAt?: string
  cwd?: string
}

export function createCriticalCoverageReport({
  inputPath,
  sha,
  generatedAt = new Date().toISOString(),
  cwd = process.cwd()
}: CreateReportOptions): CriticalCoverageReport {
  const lcov = readFileSync(inputPath, 'utf-8')
  const branches = parseCriticalBranches(lcov, cwd)
  const files = new Set(branches.map((branch) => branch.file))
  const coveredBranches = branches.filter((branch) => branch.covered).length

  return {
    schemaVersion: 1,
    source: 'lcov',
    sha,
    generatedAt,
    inputPath,
    criticalDirs: CRITICAL_COVERAGE_DIRS,
    totals: {
      files: files.size,
      branches: branches.length,
      coveredBranches
    },
    branches
  }
}

export function writeCriticalCoverageReport(
  report: CriticalCoverageReport,
  outputPath: string
): void {
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
}

export function readCriticalCoverageReport(
  inputPath: string
): CriticalCoverageReport {
  const parsed: unknown = JSON.parse(readFileSync(inputPath, 'utf-8'))

  if (!isCriticalCoverageReport(parsed)) {
    throw new Error(`Invalid critical coverage report: ${inputPath}`)
  }

  return parsed
}

export function compareCriticalCoverageReports(
  base: CriticalCoverageReport,
  head: CriticalCoverageReport
): CriticalCoverageComparison {
  const baseBranches = new Map(
    base.branches.map((branch) => [branch.key, branch])
  )
  const headBranches = new Map(
    head.branches.map((branch) => [branch.key, branch])
  )
  const regressions: CriticalCoverageRegression[] = []
  let commonBranches = 0
  let commonCoveredBranchesInBase = 0
  let commonCoveredBranchesInHead = 0
  let baseOnlyBranches = 0

  for (const [key, baseBranch] of baseBranches) {
    const headBranch = headBranches.get(key)

    if (!headBranch) {
      baseOnlyBranches++
      continue
    }

    commonBranches++

    if (baseBranch.covered) {
      commonCoveredBranchesInBase++
    }

    if (headBranch.covered) {
      commonCoveredBranchesInHead++
    }

    if (baseBranch.covered && !headBranch.covered) {
      regressions.push({
        ...baseBranch,
        baseTaken: baseBranch.taken,
        headTaken: headBranch.taken
      })
    }
  }

  return {
    baseSha: base.sha,
    headSha: head.sha,
    commonBranches,
    baseOnlyBranches,
    headOnlyBranches: [...headBranches.keys()].filter(
      (key) => !baseBranches.has(key)
    ).length,
    commonCoveredBranchesInBase,
    commonCoveredBranchesInHead,
    coveredBranchDelta:
      commonCoveredBranchesInHead - commonCoveredBranchesInBase,
    regressions: regressions.sort(compareBranches)
  }
}

function parseCriticalBranches(
  lcov: string,
  cwd: string
): CriticalBranchCoverage[] {
  let currentFile = ''
  const branches = new Map<string, CriticalBranchCoverage>()

  for (const line of lcov.split('\n')) {
    if (line.startsWith('SF:')) {
      currentFile = normalizeCoveragePath(line.slice(3), cwd)
      continue
    }

    if (!line.startsWith('BRDA:') || !isCriticalCoveragePath(currentFile)) {
      continue
    }

    const branch = parseBranchData(currentFile, line.slice(5))
    if (!branch) {
      continue
    }

    const existing = branches.get(branch.key)
    if (!existing) {
      branches.set(branch.key, branch)
      continue
    }

    branches.set(branch.key, mergeBranchCoverage(existing, branch))
  }

  return [...branches.values()].sort(compareBranches)
}

function parseBranchData(
  file: string,
  data: string
): CriticalBranchCoverage | null {
  const [lineValue, block, branch, takenValue] = data.split(',')
  const line = Number(lineValue)

  if (
    !Number.isInteger(line) ||
    !block ||
    !branch ||
    takenValue === undefined
  ) {
    return null
  }

  const taken = takenValue === '-' ? null : Number(takenValue)
  const covered = taken !== null && Number.isFinite(taken) && taken > 0
  const key = `${file}:${line}:${block}:${branch}`

  return {
    key,
    file,
    line,
    block,
    branch,
    taken: Number.isFinite(taken) ? taken : null,
    covered
  }
}

function mergeBranchCoverage(
  left: CriticalBranchCoverage,
  right: CriticalBranchCoverage
): CriticalBranchCoverage {
  const taken =
    left.taken === null || right.taken === null
      ? null
      : left.taken + right.taken

  return {
    ...left,
    taken,
    covered: left.covered || right.covered
  }
}

function compareBranches(
  left: CriticalBranchCoverage,
  right: CriticalBranchCoverage
): number {
  return (
    left.file.localeCompare(right.file) ||
    left.line - right.line ||
    left.block.localeCompare(right.block) ||
    left.branch.localeCompare(right.branch)
  )
}

function normalizeCoveragePath(filePath: string, cwd: string): string {
  const decodedPath = filePath.startsWith('file://')
    ? fileURLToPath(filePath)
    : filePath

  const relativePath = isAbsolute(decodedPath)
    ? relative(cwd, decodedPath)
    : decodedPath

  const normalizedPath = relativePath.replace(/\\/g, '/').replace(/^\.\//, '')

  if (!normalizedPath.startsWith('../')) {
    return normalizedPath
  }

  const srcIndex = normalizedPath.indexOf('/src/')
  return srcIndex === -1 ? normalizedPath : normalizedPath.slice(srcIndex + 1)
}

function isCriticalCoverageReport(
  value: unknown
): value is CriticalCoverageReport {
  if (!isRecord(value)) {
    return false
  }

  const totals = value.totals

  return (
    value.schemaVersion === 1 &&
    value.source === 'lcov' &&
    typeof value.sha === 'string' &&
    typeof value.generatedAt === 'string' &&
    typeof value.inputPath === 'string' &&
    Array.isArray(value.criticalDirs) &&
    isRecord(totals) &&
    typeof totals.files === 'number' &&
    typeof totals.branches === 'number' &&
    typeof totals.coveredBranches === 'number' &&
    Array.isArray(value.branches) &&
    value.branches.every(isCriticalBranchCoverage)
  )
}

function isCriticalBranchCoverage(
  value: unknown
): value is CriticalBranchCoverage {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.key === 'string' &&
    typeof value.file === 'string' &&
    typeof value.line === 'number' &&
    typeof value.block === 'string' &&
    typeof value.branch === 'string' &&
    (typeof value.taken === 'number' || value.taken === null) &&
    typeof value.covered === 'boolean'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
