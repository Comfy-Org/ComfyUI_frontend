import { execSync, spawnSync } from 'node:child_process'
import { isAbsolute, relative } from 'node:path'
import { pass, fail, warn, info } from '../ui/logger'

const DEFAULT_BASE_BRANCH = 'main'
const DEFAULT_BASE_REF = `origin/${DEFAULT_BASE_BRANCH}`

interface CommandResult {
  status: number | null
  stdout: string
  stderr: string
}
type CommandRunner = (command: string, args: string[]) => CommandResult

interface PrOptions {
  testFilePath: string
  testName: string
  description: string
  branchName?: string
  cwd?: string
  /** Injectable for tests; defaults to a real spawnSync-backed runner. */
  run?: CommandRunner
}

function spawnSyncRunner(cwd: string | undefined): CommandRunner {
  return (command, args) => {
    const result = spawnSync(command, args, {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe'
    })
    return {
      status: result.error ? null : result.status,
      stdout: result.stdout ?? '',
      stderr: result.error?.message ?? result.stderr ?? ''
    }
  }
}

interface PrResult {
  success: boolean
  url?: string
  error?: string
  /** Set when the failure is one the manual PR instructions can still solve. */
  needsManualSteps?: boolean
  /** The branch checked out when createPr returns, e.g. for a caller-side "switch back?" prompt. */
  currentBranch?: string
  /** The branch the user was on before createPr ran — where "switch back" would go. */
  originalBranch?: string
}

/**
 * lint-staged prints a human-readable failure summary between these
 * markers; everything else in stderr is husky/lint-staged process noise.
 */
function extractLintStagedSummary(stderr: string): string | undefined {
  const start = stderr.indexOf('✖')
  if (start === -1) return undefined
  const end = stderr.indexOf('husky - pre-commit script failed')
  return stderr.slice(start, end === -1 ? undefined : end).trim()
}

function explainCommitFailure(stderr: string, testFilePath: string): string {
  const lintSummary = extractLintStagedSummary(stderr)
  if (!lintSummary) return stderr

  if (/expect-expect/.test(lintSummary)) {
    return [
      'The pre-commit checks caught a test with no assertions.',
      '',
      "Playwright can't tell your test passed unless it checks something",
      'concrete on the page — text, a value, whether something is visible.',
      '',
      'Add at least one `await expect(...)` call to the test before',
      'committing. For example:',
      '',
      "  await expect(comfyPage.page.getByText('Queue')).toBeVisible()",
      '',
      lintSummary
    ].join('\n')
  }

  // vue-tsc type-checks the whole browser_tests/ project, not just the
  // staged file, so a TS error can point at a completely different file —
  // most often a leftover from an earlier recording session.
  const tsErrorMatch = lintSummary.match(
    /(browser_tests\/[^\s(]+)\((\d+),\d+\): error TS\d+: (.+)/
  )
  if (tsErrorMatch) {
    const [, brokenFile, line, message] = tsErrorMatch
    const isOtherFile = !testFilePath.endsWith(brokenFile.split('/').pop()!)
    const heading = isOtherFile
      ? [
          'A DIFFERENT file has a type error and is blocking this commit —',
          'not the test you just recorded:'
        ]
      : ['Your recorded test has a type error:']
    const fix = isOtherFile
      ? [
          'This looks like a leftover file from an earlier recording',
          "session. If it's not something you meant to keep:",
          '',
          `  rm ${brokenFile}`,
          '',
          'Then re-run `comfy-test pr` to try again.'
        ]
      : ['Fix the error above, then re-run `comfy-test pr`.']

    return [
      ...heading,
      '',
      `  ${brokenFile}:${line}`,
      `  ${message}`,
      '',
      ...fix,
      '',
      lintSummary
    ].join('\n')
  }

  return [
    'The pre-commit checks (lint) failed on the generated test:',
    '',
    lintSummary
  ].join('\n')
}

export async function checkGhAvailable(): Promise<{
  available: boolean
  authenticated: boolean
  version?: string
}> {
  let version: string
  try {
    version = execSync('gh --version', { stdio: 'pipe', encoding: 'utf-8' })
      .split('\n')[0]
      .replace('gh version ', '')
      .trim()
  } catch {
    return { available: false, authenticated: false }
  }

  try {
    execSync('gh auth status', {
      stdio: 'pipe',
      encoding: 'utf-8'
    })
    return { available: true, authenticated: true, version }
  } catch {
    return { available: true, authenticated: false, version }
  }
}

export async function createPr(options: PrOptions): Promise<PrResult> {
  const branchName = options.branchName ?? `test/${options.testName}`
  const commitMsg = `test: add ${options.testName} e2e test\n\n${options.description}`
  const prTitle = `test: add ${options.testName} e2e test`
  const prBody =
    `${options.description}\n\n---\n\n` + 'Recorded with `comfy-test record`'

  // Pinned to the repo, not to wherever the shell is sitting.
  const run = options.run ?? spawnSyncRunner(options.cwd)

  // Pathspec negation only matches reliably against a repo-relative path —
  // an absolute path sails past ':!<path>' and gets swept in regardless.
  const relativeTestFilePath =
    isAbsolute(options.testFilePath) && options.cwd
      ? relative(options.cwd, options.testFilePath).split('\\').join('/')
      : options.testFilePath

  const originalBranch = run('git', [
    'rev-parse',
    '--abbrev-ref',
    'HEAD'
  ]).stdout.trim()

  // The PR must stack on wherever the user actually started — targeting
  // main regardless would sweep every commit already on their branch into
  // the diff. gh needs the base to exist on the remote, so fall back to
  // main (still warning) rather than fail outright if it was never pushed.
  // Skipped entirely when already on main: nothing to stack, and it's
  // always on the remote, so the check would be a wasted round trip.
  const onFeatureBranch =
    originalBranch && originalBranch !== DEFAULT_BASE_BRANCH
  const baseOnOrigin =
    onFeatureBranch &&
    run('git', [
      'ls-remote',
      '--exit-code',
      '--heads',
      'origin',
      originalBranch
    ]).status === 0
  const baseBranch =
    onFeatureBranch && baseOnOrigin ? originalBranch : DEFAULT_BASE_BRANCH

  if (onFeatureBranch) {
    if (baseOnOrigin) {
      info([
        `Stacking this PR on ${originalBranch} (where you started), not`,
        `${DEFAULT_BASE_BRANCH}. It will only show the commit(s) you're`,
        `adding now — merge or land ${originalBranch} first for those to`,
        'reach main.'
      ])
    } else {
      warn(
        `${originalBranch} is not pushed to origin`,
        `falling back to ${DEFAULT_BASE_BRANCH} as the PR base`
      )
      const ahead = run('git', [
        'rev-list',
        '--count',
        `${DEFAULT_BASE_REF}..HEAD`
      ])
      const aheadCount = Number(ahead.stdout.trim())
      if (ahead.status === 0 && Number.isFinite(aheadCount) && aheadCount > 0) {
        info([
          `The pull request will contain those ${aheadCount} commit(s) as`,
          'well as the recorded test, because the branch is cut from where',
          'you are now. To open a PR with only the test, push',
          `${originalBranch} first, or switch to an up-to-date`,
          `${DEFAULT_BASE_BRANCH}:`,
          '',
          `  git checkout ${DEFAULT_BASE_BRANCH} && git pull`
        ])
      }
    }
  }

  // Leaves the user back where they started, with the new branch gone,
  // instead of stranded on a half-created branch with nothing committed.
  const abandonBranch = () => {
    if (!originalBranch) return
    run('git', ['checkout', originalBranch])
    run('git', ['branch', '-D', branchName])
  }

  const checkout = run('git', ['checkout', '-b', branchName])
  if (checkout.status !== 0) {
    const stderr = checkout.stderr.trim()
    fail(
      'Branch creation failed',
      stderr.includes('already exists')
        ? `${branchName} already exists — pass a different test name, or delete that branch`
        : stderr
    )
    return { success: false, error: stderr }
  }
  pass('Created branch', branchName)

  const add = run('git', ['add', options.testFilePath])
  if (add.status !== 0) {
    fail('Git add failed', add.stderr.trim())
    abandonBranch()
    return { success: false, error: add.stderr.trim() }
  }

  // vue-tsc's pre-commit typecheck covers the whole browser_tests/ project,
  // not just what's staged — a stray broken file left over from an earlier
  // recording session fails everyone's commit, not just theirs. Stashing
  // every other change out of the way means the typecheck only ever sees
  // the file actually being committed.
  const stash = run('git', [
    'stash',
    'push',
    '--include-untracked',
    '--',
    '.',
    `:!${relativeTestFilePath}`
  ])
  const stashed = stash.status === 0 && !/No local changes/.test(stash.stdout)
  const restoreStashed = () => {
    if (!stashed) return
    const pop = run('git', ['stash', 'pop'])
    if (pop.status !== 0) {
      fail(
        'Could not restore your other unstaged changes automatically',
        'Run `git stash pop` manually to get them back.'
      )
    }
  }

  // Pathspec-scoped so already-staged changes are not swept in.
  const commit = run('git', [
    'commit',
    '-m',
    commitMsg,
    '--',
    options.testFilePath
  ])
  if (commit.status !== 0) {
    const stderr = commit.stderr.trim()
    fail(
      'Git commit failed',
      explainCommitFailure(stderr, options.testFilePath)
    )
    restoreStashed()
    abandonBranch()
    info([
      `You're back on ${originalBranch || 'your original branch'}; the`,
      `empty ${branchName} branch was removed. Fix the issue above and`,
      're-run `comfy-test pr` to try again — your test file is untouched.'
    ])
    return { success: false, error: stderr }
  }
  restoreStashed()
  pass('Committed test file')

  const push = run('git', ['push', '-u', 'origin', branchName])
  if (push.status !== 0) {
    const stderr = push.stderr.trim()
    fail(
      'Git push failed',
      /permission|denied|403/i.test(stderr)
        ? 'no write access to this repository — fork it and push there instead'
        : stderr
    )
    return { success: false, error: stderr, needsManualSteps: true }
  }
  pass('Pushed branch', branchName)

  // No --fill: newer gh rejects it alongside --title/--body.
  const pr = run('gh', [
    'pr',
    'create',
    '--base',
    baseBranch,
    '--title',
    prTitle,
    '--body',
    prBody
  ])
  if (pr.status !== 0) {
    const stderr = pr.stderr.trim()
    fail('PR creation failed', stderr)
    info([
      `The branch ${branchName} is pushed, so nothing is lost.`,
      'Open the pull request from it directly, or retry with:',
      '',
      `  gh pr create --base ${baseBranch} --head ${branchName}`
    ])
    return { success: false, error: stderr, needsManualSteps: true }
  }

  const url = pr.stdout.trim()
  pass('Pull request created', url)
  return {
    success: true,
    url,
    currentBranch: branchName,
    originalBranch: originalBranch || undefined
  }
}

/** Checks out `branch`, for a caller-side "switch back?" prompt after createPr. */
export function switchBranch(
  branch: string,
  options: { cwd?: string; run?: CommandRunner } = {}
): { success: boolean; error?: string } {
  const run = options.run ?? spawnSyncRunner(options.cwd)
  const result = run('git', ['checkout', branch])
  if (result.status !== 0) {
    return { success: false, error: result.stderr.trim() }
  }
  return { success: true }
}
