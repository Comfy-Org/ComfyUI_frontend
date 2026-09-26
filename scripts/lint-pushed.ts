import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { isMainModule } from './isMainModule'

interface PushedRange {
  localSha: string
  remoteSha: string | undefined
}

const isNullSha = (sha: string) => /^0+$/.test(sha)

// git feeds pre-push one "<local ref> <local sha> <remote ref> <remote sha>"
// line per ref; a null sha marks a deletion (local) or a new branch (remote).
const prePushLine = /^\S+\s+(\S+)\s+\S+\s+(\S+)$/

export function pushedRanges(prePushInput: string): PushedRange[] {
  return prePushInput.split('\n').flatMap((line) => {
    const match = prePushLine.exec(line.trim())
    if (!match || isNullSha(match[1])) return []
    return [
      {
        localSha: match[1],
        remoteSha: isNullSha(match[2]) ? undefined : match[2]
      }
    ]
  })
}

function isLintable(fileName: string): boolean {
  return /\.(?:js|ts|tsx|vue|mts|astro)$/.test(fileName)
}

function git(cwd: string, ...args: string[]): string | undefined {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true
  })
  return result.status === 0 ? result.stdout.trim() : undefined
}

function baseOf(cwd: string, { localSha, remoteSha }: PushedRange) {
  const candidates = [remoteSha, 'origin/main', 'origin/HEAD'].filter(
    (ref) => ref !== undefined
  )
  for (const ref of candidates) {
    const base = git(cwd, 'merge-base', ref, localSha)
    if (base !== undefined) return base
  }
  return undefined
}

function skip(sha: string, reason: string): [] {
  process.stderr.write(
    `lint-pushed: ${reason} for ${sha}; CI lint will cover it\n`
  )
  return []
}

function changedFiles(cwd: string, range: PushedRange): string[] {
  const base = baseOf(cwd, range)
  if (base === undefined) return skip(range.localSha, 'no base found')
  return execFileSync(
    'git',
    ['diff', '--name-only', '-z', '--diff-filter=ACMR', base, range.localSha],
    { cwd, encoding: 'utf8' }
  )
    .split('\0')
    .filter(isLintable)
}

// ESLint reads the working tree, so only the checked-out commit can be linted
// faithfully; pushes of other local branches are left to CI.
export function filesToLint(prePushInput: string, cwd: string): string[] {
  const head = git(cwd, 'rev-parse', 'HEAD')
  const files = pushedRanges(prePushInput).flatMap((range) =>
    range.localSha === head
      ? changedFiles(cwd, range)
      : skip(range.localSha, 'not the checked-out commit')
  )
  return [...new Set(files)].filter((file) => existsSync(path.join(cwd, file)))
}

function main() {
  const files = filesToLint(readPrePushInput(), process.cwd())
  if (files.length === 0) return

  const eslintEntry = path.resolve('node_modules/eslint/bin/eslint.js')
  const result = spawnSync(
    process.execPath,
    [
      eslintEntry,
      '--cache',
      '--cache-strategy',
      'content',
      '--concurrency',
      'auto',
      '--no-warn-ignored',
      '--',
      ...files
    ],
    { stdio: 'inherit', windowsHide: true }
  )
  if (result.error) throw result.error
  process.exit(result.status ?? 1)
}

function readPrePushInput(): string {
  if (process.stdin.isTTY) return ''
  try {
    return readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}

if (isMainModule(import.meta.url)) {
  main()
}
