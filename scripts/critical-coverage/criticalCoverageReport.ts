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
  baseBranches: number
  headBranches: number
  commonBranches: number
  baseOnlyBranches: number
  headOnlyBranches: number
  commonCoveredBranchesInBase: number
  commonCoveredBranchesInHead: number
  coveredBranchDelta: number
  regressions: CriticalCoverageRegression[]
}

export interface CriticalCoverageLocation {
  file: string
  line: number
}

export type CriticalCoverageLocationMapper = (
  file: string,
  line: number
) => CriticalCoverageLocation | null

interface CreateReportOptions {
  inputPath: string
  sha: string
  generatedAt?: string
  cwd?: string
}

interface IndexedBranch {
  branch: CriticalBranchCoverage
  mappedLocation: CriticalCoverageLocation | null
}

export function createCriticalCoverageReport({
  inputPath,
  sha,
  generatedAt = new Date().toISOString(),
  cwd = process.cwd()
}: CreateReportOptions): CriticalCoverageReport {
  if (!isGitCommitSha(sha)) {
    throw new Error(`Invalid Git commit SHA: ${sha}`)
  }

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
  head: CriticalCoverageReport,
  mapBaseLocation: CriticalCoverageLocationMapper = identityLocationMapper
): CriticalCoverageComparison {
  assertCriticalCoverageScopePreserved(base.criticalDirs, head.criticalDirs)

  const baseBranches = indexBranches(base.branches, mapBaseLocation, 'base')
  const headBranches = indexBranches(
    head.branches,
    identityLocationMapper,
    'head'
  )
  const regressions: CriticalCoverageRegression[] = []
  let commonBranches = 0
  let commonCoveredBranchesInBase = 0
  let commonCoveredBranchesInHead = 0
  let baseOnlyBranches = 0

  for (const [key, indexedBaseBranch] of baseBranches) {
    const indexedHeadBranch = headBranches.get(key)
    const baseBranch = indexedBaseBranch.branch

    if (!indexedHeadBranch) {
      baseOnlyBranches++

      if (baseBranch.covered && indexedBaseBranch.mappedLocation) {
        regressions.push({
          ...baseBranch,
          file: indexedBaseBranch.mappedLocation.file,
          line: indexedBaseBranch.mappedLocation.line,
          taken: null,
          covered: false,
          baseTaken: baseBranch.taken,
          headTaken: null
        })
      }

      continue
    }

    const headBranch = indexedHeadBranch.branch

    commonBranches++

    if (baseBranch.covered) {
      commonCoveredBranchesInBase++
    }

    if (headBranch.covered) {
      commonCoveredBranchesInHead++
    }

    if (baseBranch.covered && !headBranch.covered) {
      regressions.push({
        ...headBranch,
        baseTaken: baseBranch.taken,
        headTaken: headBranch.taken
      })
    }
  }

  return {
    baseSha: base.sha,
    headSha: head.sha,
    baseBranches: base.branches.length,
    headBranches: head.branches.length,
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
  const taken = takenValue === '-' ? null : Number(takenValue)

  if (
    !Number.isInteger(line) ||
    line <= 0 ||
    !isCoverageOrdinal(block) ||
    !isCoverageOrdinal(branch) ||
    takenValue === undefined ||
    takenValue.trim().length === 0 ||
    (taken !== null && !Number.isInteger(taken))
  ) {
    return null
  }

  const covered = taken !== null && taken > 0
  const key = `${file}:${line}:${block}:${branch}`

  return {
    key,
    file,
    line,
    block,
    branch,
    taken,
    covered
  }
}

function mergeBranchCoverage(
  left: CriticalBranchCoverage,
  right: CriticalBranchCoverage
): CriticalBranchCoverage {
  const taken =
    left.taken === null && right.taken === null
      ? null
      : (left.taken ?? 0) + (right.taken ?? 0)

  return {
    ...left,
    taken,
    covered: taken !== null && taken > 0
  }
}

function compareBranches(
  left: CriticalBranchCoverage,
  right: CriticalBranchCoverage
): number {
  return (
    left.file.localeCompare(right.file) ||
    left.line - right.line ||
    Number(left.block) - Number(right.block) ||
    Number(left.branch) - Number(right.branch)
  )
}

function indexBranches(
  branches: CriticalBranchCoverage[],
  mapLocation: CriticalCoverageLocationMapper,
  unmappedPrefix: string
): Map<string, IndexedBranch> {
  const indexed = new Map<string, IndexedBranch>()
  const occurrences = new Map<string, number>()

  for (const branch of [...branches].sort(compareBranches)) {
    const sourceLine = `${branch.file}:${branch.line}`
    const occurrence = occurrences.get(sourceLine) ?? 0
    const mappedLocation = mapLocation(branch.file, branch.line)
    const identity =
      mappedLocation === null
        ? `${unmappedPrefix}:${branch.key}`
        : `${mappedLocation.file}:${mappedLocation.line}:${occurrence}`

    occurrences.set(sourceLine, occurrence + 1)
    indexed.set(identity, { branch, mappedLocation })
  }

  return indexed
}

function assertCriticalCoverageScopePreserved(
  baseDirs: readonly string[],
  headDirs: readonly string[]
): void {
  const headScope = new Set(headDirs)
  const removedDirs = baseDirs.filter((dir) => !headScope.has(dir))

  if (removedDirs.length > 0) {
    throw new Error(
      `Critical coverage scope removed: ${removedDirs.join(', ')}`
    )
  }
}

function identityLocationMapper(
  file: string,
  line: number
): CriticalCoverageLocation {
  return { file, line }
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
  const branches = value.branches
  const criticalDirs = value.criticalDirs

  if (
    value.schemaVersion !== 1 ||
    value.source !== 'lcov' ||
    !isGitCommitSha(value.sha) ||
    typeof value.generatedAt !== 'string' ||
    typeof value.inputPath !== 'string' ||
    !isCriticalCoverageDirs(criticalDirs) ||
    !isRecord(totals) ||
    !isNonNegativeInteger(totals.files) ||
    !isNonNegativeInteger(totals.branches) ||
    !isNonNegativeInteger(totals.coveredBranches) ||
    !Array.isArray(branches) ||
    !branches.every((branch) => isCriticalBranchCoverage(branch, criticalDirs))
  ) {
    return false
  }

  const keys = new Set(branches.map(({ key }) => key))
  const files = new Set(branches.map(({ file }) => file))
  const coveredBranches = branches.filter(({ covered }) => covered).length

  return (
    keys.size === branches.length &&
    totals.files === files.size &&
    totals.branches === branches.length &&
    totals.coveredBranches === coveredBranches
  )
}

function isCriticalBranchCoverage(
  value: unknown,
  criticalDirs: readonly string[]
): value is CriticalBranchCoverage {
  if (!isRecord(value)) {
    return false
  }

  const taken = value.taken

  if (
    typeof value.key !== 'string' ||
    typeof value.file !== 'string' ||
    !isCoveragePathInDirs(value.file, criticalDirs) ||
    !isNonNegativeInteger(value.line) ||
    value.line === 0 ||
    !isCoverageOrdinal(value.block) ||
    !isCoverageOrdinal(value.branch) ||
    (taken !== null &&
      (typeof taken !== 'number' || !Number.isInteger(taken))) ||
    typeof value.covered !== 'boolean'
  ) {
    return false
  }

  return (
    value.key ===
      `${value.file}:${value.line}:${value.block}:${value.branch}` &&
    value.covered === (typeof taken === 'number' && taken > 0)
  )
}

function isCriticalCoverageDirs(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (dir) =>
        typeof dir === 'string' &&
        dir.length > 0 &&
        dir === dir.trim() &&
        !dir.startsWith('/') &&
        !dir.endsWith('/') &&
        !dir.includes('\\') &&
        !dir.split('/').includes('..')
    ) &&
    new Set(value).size === value.length
  )
}

function isCoveragePathInDirs(
  filePath: string,
  criticalDirs: readonly string[]
): boolean {
  return criticalDirs.some(
    (dir) => filePath === dir || filePath.startsWith(`${dir}/`)
  )
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

export function isGitCommitSha(value: unknown): value is string {
  return (
    typeof value === 'string' && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value)
  )
}

function isCoverageOrdinal(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d+$/.test(value) &&
    Number.isSafeInteger(Number(value))
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
