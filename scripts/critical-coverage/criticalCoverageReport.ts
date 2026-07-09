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
