import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { isEslintFile } from './eslintScope'
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

function git(...args: string[]): string | undefined {
  const result = spawnSync('git', args, { encoding: 'utf8', windowsHide: true })
  return result.status === 0 ? result.stdout.trim() : undefined
}

function baseOf({ localSha, remoteSha }: PushedRange): string | undefined {
  const candidates = [remoteSha, 'origin/main', 'origin/HEAD'].filter(
    (ref) => ref !== undefined
  )
  for (const ref of candidates) {
    const base = git('merge-base', ref, localSha)
    if (base !== undefined) return base
  }
  return undefined
}

function changedFiles(range: PushedRange): string[] {
  const base = baseOf(range)
  if (base === undefined) {
    process.stderr.write(
      `lint-pushed: no base found for ${range.localSha}; CI lint will cover it\n`
    )
    return []
  }
  return execFileSync(
    'git',
    ['diff', '--name-only', '-z', '--diff-filter=ACMR', base, range.localSha],
    { encoding: 'utf8' }
  )
    .split('\0')
    .filter(isEslintFile)
}

function main() {
  const files = [
    ...new Set(pushedRanges(readPrePushInput()).flatMap(changedFiles))
  ].filter((file) => existsSync(file))

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
