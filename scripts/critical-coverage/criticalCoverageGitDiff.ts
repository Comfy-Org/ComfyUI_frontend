import { execFileSync } from 'node:child_process'

import { CRITICAL_COVERAGE_DIRS } from './criticalCoverageDirs'
import { isGitCommitSha } from './criticalCoverageReport'
import type {
  CriticalCoverageLocation,
  CriticalCoverageLocationMapper
} from './criticalCoverageReport'

interface DiffFile {
  headPath: string | null
  hunks: DiffHunk[]
}

interface DiffHunk {
  baseStart: number
  baseCount: number
  headCount: number
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,(\d+))? @@/
const MAX_GIT_OUTPUT_BYTES = 100 * 1024 * 1024

export function createGitLocationMapper(
  baseSha: string,
  headSha: string,
  cwd = process.cwd()
): CriticalCoverageLocationMapper {
  if (!isGitCommitSha(baseSha) || !isGitCommitSha(headSha)) {
    throw new Error(
      'Critical coverage comparison requires full Git commit SHAs'
    )
  }

  const files = readDiffFiles(baseSha, headSha, cwd)
  const diff = runGitDiff(baseSha, headSha, cwd, [
    '--unified=0',
    '--no-color',
    '--no-ext-diff'
  ])

  addDiffHunks(files, diff)

  return (file, line) => mapBaseLocation(files.get(file), file, line)
}

function readDiffFiles(
  baseSha: string,
  headSha: string,
  cwd: string
): Map<string, DiffFile> {
  const output = runGitDiff(baseSha, headSha, cwd, ['--name-status', '-z'])
  const tokens = output.split('\0')
  const files = new Map<string, DiffFile>()

  for (let index = 0; index < tokens.length; ) {
    const status = tokens[index++]
    if (!status) {
      continue
    }

    const basePath = tokens[index++]
    if (!basePath) {
      break
    }

    if (status.startsWith('R')) {
      const headPath = tokens[index++]
      if (!headPath) {
        break
      }

      files.set(basePath, { headPath, hunks: [] })
      continue
    }

    if (status === 'A') {
      continue
    }

    files.set(basePath, {
      headPath: status === 'D' ? null : basePath,
      hunks: []
    })
  }

  return files
}

function runGitDiff(
  baseSha: string,
  headSha: string,
  cwd: string,
  options: string[]
): string {
  return execFileSync(
    'git',
    [
      '-c',
      'core.quotePath=false',
      'diff',
      '--find-renames',
      ...options,
      baseSha,
      headSha,
      '--',
      ...CRITICAL_COVERAGE_DIRS
    ],
    { cwd, encoding: 'utf-8', maxBuffer: MAX_GIT_OUTPUT_BYTES }
  )
}

function addDiffHunks(files: Map<string, DiffFile>, diff: string): void {
  let basePath: string | null = null

  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      basePath = null
      continue
    }

    if (line.startsWith('--- ')) {
      basePath = parseDiffPath(line.slice(4), 'a/')
      continue
    }

    const match = HUNK_HEADER.exec(line)
    const file = basePath ? files.get(basePath) : undefined
    if (!match || !file) {
      continue
    }

    file.hunks.push({
      baseStart: Number(match[1]),
      baseCount: Number(match[2] ?? 1),
      headCount: Number(match[3] ?? 1)
    })
  }
}

function parseDiffPath(path: string, prefix: string): string | null {
  return path.startsWith(prefix) ? path.slice(prefix.length) : null
}

function mapBaseLocation(
  file: DiffFile | undefined,
  basePath: string,
  line: number
): CriticalCoverageLocation | null {
  if (!file) {
    return { file: basePath, line }
  }

  if (file.headPath === null) {
    return null
  }

  const mappedLine = mapBaseLine(file.hunks, line)
  return mappedLine === null ? null : { file: file.headPath, line: mappedLine }
}

function mapBaseLine(hunks: DiffHunk[], line: number): number | null {
  let offset = 0

  for (const hunk of hunks) {
    if (hunk.baseCount === 0) {
      if (line <= hunk.baseStart) {
        return line + offset
      }

      offset += hunk.headCount
      continue
    }

    if (line < hunk.baseStart) {
      return line + offset
    }

    if (line < hunk.baseStart + hunk.baseCount) {
      return null
    }

    offset += hunk.headCount - hunk.baseCount
  }

  return line + offset
}
