import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

// A merge commit is the one case where the pre-commit hook cannot hand git's
// staged diff to lint-staged: the merge stages every upstream path the stale
// first parent lacks. These tests drive the real hook and the real lint-staged
// over a real merge conflict in a throwaway repository, because the hazards are
// all in what the hook leaves behind - the merge index, the worktree, and
// MERGE_HEAD - and none of that is observable from the hook's command text.

const HOOK_PATH = path.resolve('.husky/pre-commit')
const LINT_STAGED_BIN = path.resolve(
  'node_modules/lint-staged/bin/lint-staged.js'
)

const FORMAT_MARKER = '// formatted'
const UNSTAGED_WORK = 'work in progress the developer did not stage'

/** Files the formatter stub appends to, one absolute path per line. */
const RECEIVED_LOG = 'received-files.log'
/** Files the linter stub was handed, one absolute path per line. */
const LINTED_LOG = 'linted-files.log'

const FORMATTER = `import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'

const files = process.argv.slice(2)
appendFileSync(process.env.RECEIVED_FILES_LOG, files.join('\\n') + '\\n')

if (process.env.FORMATTER_EXIT_CODE) {
  process.exit(Number(process.env.FORMATTER_EXIT_CODE))
}

for (const file of files) {
  const text = readFileSync(file, 'utf8').trimEnd()
  writeFileSync(file, text + '\\n${FORMAT_MARKER}\\n')
}
`

// The real config puts rewriting tasks (oxfmt --write, oxlint/eslint --fix)
// ahead of the typecheck that can fail, so the stubs mirror that order: a
// formatter that rewrites its targets, then a linter that can reject them.
const LINTER = `import { appendFileSync } from 'node:fs'

appendFileSync(
  process.env.LINTED_FILES_LOG,
  process.argv.slice(2).join('\\n') + '\\n'
)

if (process.env.LINTER_EXIT_CODE) {
  process.exit(Number(process.env.LINTER_EXIT_CODE))
}
`

const LINT_STAGED_CONFIG = `import path from 'node:path'

const formatter = path.join(import.meta.dirname, 'formatter.mjs')
const linter = path.join(import.meta.dirname, 'linter.mjs')

export default {
  '*.ts': [
    \`"\${process.execPath}" "\${formatter}"\`,
    \`"\${process.execPath}" "\${linter}"\`
  ]
}
`

// `pnpm exec lint-staged` reaches the real lint-staged; the hook's other two
// commands are repo-specific checks that do not exist in a throwaway repo.
const PNPM_STUB = `#!/usr/bin/env bash
if [ "$1" = "exec" ] && [ "$2" = "lint-staged" ]; then
  shift 2
  exec "$NODE_BIN" "$LINT_STAGED_BIN" "$@"
fi
exit 0
`

const loggedBasenames = (logPath: string) =>
  [
    ...new Set(
      readFileSync(logPath, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => path.basename(line))
    )
  ].sort()

const hermeticGitEnv = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_AUTHOR_NAME: 'Merge Hook Test',
  GIT_AUTHOR_EMAIL: 'merge-hook@example.invalid',
  GIT_COMMITTER_NAME: 'Merge Hook Test',
  GIT_COMMITTER_EMAIL: 'merge-hook@example.invalid'
}

interface MergeRepoOptions {
  /** Leave an unstaged edit in the worktree copy of `branchOnly.ts`. */
  unstagedEdit?: boolean
  /** Fail in the formatter, before anything has been rewritten. */
  formatterExitCode?: number
  /** Fail in the linter, after the formatter has rewritten its targets. */
  linterExitCode?: number
}

function createMergeInProgress({
  unstagedEdit = false,
  formatterExitCode,
  linterExitCode
}: MergeRepoOptions = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'merge-pre-commit-'))
  const binDir = path.join(dir, 'stub-bin')
  const receivedLog = path.join(dir, RECEIVED_LOG)
  const lintedLog = path.join(dir, LINTED_LOG)

  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, ...hermeticGitEnv }
    }).trim()

  const write = (file: string, text: string) =>
    writeFileSync(path.join(dir, file), text)

  mkdirSync(binDir)
  writeFileSync(path.join(binDir, 'pnpm'), PNPM_STUB)
  chmodSync(path.join(binDir, 'pnpm'), 0o755)
  write(RECEIVED_LOG, '')
  write(LINTED_LOG, '')

  git('init', '-q', '-b', 'main')
  write('formatter.mjs', FORMATTER)
  write('linter.mjs', LINTER)
  write('.lintstagedrc.mjs', LINT_STAGED_CONFIG)
  write('shared.ts', 'export const shared = "base"\n')
  write('branchOnly.ts', 'export const branchOnly = "base"\n')
  write('resolvedUpstream.ts', 'export const resolvedUpstream = "base"\n')
  write('upstreamOnly.ts', 'export const upstreamOnly = "base"\n')
  git('add', '-A')
  git('commit', '-qm', 'base')
  git('branch', 'feature')

  write('shared.ts', 'export const shared = "main"\n')
  write('resolvedUpstream.ts', 'export const resolvedUpstream = "main"\n')
  write('upstreamOnly.ts', 'export const upstreamOnly = "main"\n')
  git('commit', '-qam', 'upstream work')

  git('checkout', '-q', 'feature')
  write('shared.ts', 'export const shared = "feature"\n')
  write('branchOnly.ts', 'export const branchOnly = "feature"\n')
  git('commit', '-qam', 'branch work')

  const merge = spawnSync('git', ['merge', 'main'], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, ...hermeticGitEnv }
  })
  if (merge.status === 0) {
    throw new Error('expected merging main into feature to conflict')
  }

  // Resolve the conflict, and - this is the case the branch diff misses - also
  // touch a file the local branch never changed while resolving.
  write('shared.ts', 'export const shared = "resolved"\n')
  write(
    'resolvedUpstream.ts',
    'export const resolvedUpstream = "main, adjusted while resolving"\n'
  )
  git('add', 'shared.ts', 'resolvedUpstream.ts')

  if (unstagedEdit) {
    write(
      'branchOnly.ts',
      `export const branchOnly = "feature"\n// ${UNSTAGED_WORK}\n`
    )
  }

  const hookPath = path.join(dir, 'pre-commit')
  writeFileSync(hookPath, readFileSync(HOOK_PATH, 'utf8'))

  return {
    dir,
    mergeHead: () => git('rev-parse', 'MERGE_HEAD'),
    indexTree: () => git('write-tree'),
    staged: (file: string) => git('show', `:${file}`),
    worktree: (file: string) =>
      readFileSync(path.join(dir, file), 'utf8').trim(),
    /** Basenames the rewriting task actually received, sorted. */
    received: () => loggedBasenames(receivedLog),
    /** Basenames the task downstream of the rewrite received, sorted. */
    linted: () => loggedBasenames(lintedLog),
    runHook: () =>
      spawnSync('bash', [hookPath], {
        cwd: dir,
        encoding: 'utf8',
        env: {
          ...process.env,
          ...hermeticGitEnv,
          PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
          NODE_BIN: process.execPath,
          LINT_STAGED_BIN,
          RECEIVED_FILES_LOG: receivedLog,
          LINTED_FILES_LOG: lintedLog,
          ...(formatterExitCode === undefined
            ? {}
            : { FORMATTER_EXIT_CODE: String(formatterExitCode) }),
          ...(linterExitCode === undefined
            ? {}
            : { LINTER_EXIT_CODE: String(linterExitCode) })
        }
      })
  }
}

const repos: string[] = []

const openMergeInProgress = (options?: MergeRepoOptions) => {
  const repo = createMergeInProgress(options)
  repos.push(repo.dir)
  return repo
}

afterEach(() => {
  while (repos.length) {
    rmSync(repos.pop()!, { recursive: true, force: true })
  }
})

describe.skipIf(process.platform === 'win32')(
  'pre-commit hook during a merge',
  () => {
    it('checks a conflict resolution the branch diff leaves out', () => {
      const repo = openMergeInProgress()
      const mergeHead = repo.mergeHead()

      const result = repo.runHook()

      expect(result.status).toBe(0)
      // resolvedUpstream.ts is staged by the resolution but absent from
      // merge-base..HEAD; upstreamOnly.ts is staged by the merge yet identical
      // to upstream, so checking it would drag in the whole upstream diff.
      expect(repo.received()).toEqual([
        'branchOnly.ts',
        'resolvedUpstream.ts',
        'shared.ts'
      ])
      expect(repo.staged('resolvedUpstream.ts')).toContain(FORMAT_MARKER)
      expect(repo.mergeHead()).toBe(mergeHead)
    })

    it('refuses the commit rather than stage an unstaged edit', () => {
      const repo = openMergeInProgress({ unstagedEdit: true })
      const mergeHead = repo.mergeHead()
      const indexTree = repo.indexTree()

      const result = repo.runHook()

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('branchOnly.ts')
      expect(repo.staged('branchOnly.ts')).not.toContain(UNSTAGED_WORK)
      expect(repo.worktree('branchOnly.ts')).toContain(UNSTAGED_WORK)
      expect(repo.indexTree()).toBe(indexTree)
      expect(repo.mergeHead()).toBe(mergeHead)
    })

    it('undoes a rewrite when a later task rejects the commit', () => {
      const repo = openMergeInProgress({ linterExitCode: 1 })
      const mergeHead = repo.mergeHead()
      const indexTree = repo.indexTree()
      const resolved = repo.worktree('shared.ts')

      const result = repo.runHook()

      expect(result.status).not.toBe(0)
      // Not vacuous: the formatter received every lint target and the linter
      // only runs after it, so each target really was rewritten on disk before
      // the failure. lint-staged has no stash in --diff mode and stages its
      // tasks' output regardless, so the rewrite reaches the index unless the
      // hook puts it back.
      const targets = ['branchOnly.ts', 'resolvedUpstream.ts', 'shared.ts']
      expect(repo.received()).toEqual(targets)
      expect(repo.linted()).toEqual(targets)
      expect(repo.indexTree()).toBe(indexTree)
      expect(repo.staged('shared.ts')).not.toContain(FORMAT_MARKER)
      expect(repo.worktree('shared.ts')).toBe(resolved)
      expect(repo.mergeHead()).toBe(mergeHead)
    })

    it('leaves the merge index and worktree alone when a task fails', () => {
      const repo = openMergeInProgress({ formatterExitCode: 1 })
      const mergeHead = repo.mergeHead()
      const indexTree = repo.indexTree()

      const result = repo.runHook()

      expect(result.status).not.toBe(0)
      // Survival is only meaningful if the tasks really ran; which files they
      // got is the preceding test's claim, not this one's.
      expect(repo.received()).not.toEqual([])
      expect(repo.indexTree()).toBe(indexTree)
      expect(repo.worktree('shared.ts')).toBe(
        'export const shared = "resolved"'
      )
      expect(repo.mergeHead()).toBe(mergeHead)
    })
  }
)
