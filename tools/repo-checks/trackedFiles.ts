import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)

/** Paths tracked by git that match the pathspecs, relative to the repository root. */
export function trackedFiles(...pathspecs: string[]): string[] {
  return execFileSync('git', ['ls-files', '-z', '--', ...pathspecs], {
    cwd: repoRoot,
    encoding: 'utf8'
  })
    .split('\0')
    .filter(Boolean)
}

/** Reads a tracked file by its repository-relative path. */
export function readTracked(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8')
}
