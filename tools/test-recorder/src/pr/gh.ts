import { execSync, spawnSync } from 'node:child_process'
import { pass, fail, warn, info } from '../ui/logger'

const DEFAULT_BASE_BRANCH = 'main'
const DEFAULT_BASE_REF = `origin/${DEFAULT_BASE_BRANCH}`

interface PrOptions {
  testFilePath: string
  testName: string
  description: string
  branchName?: string
  cwd?: string
}

interface PrResult {
  success: boolean
  url?: string
  error?: string
  /** Set when the failure is one the manual PR instructions can still solve. */
  needsManualSteps?: boolean
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
  const run = (command: string, args: string[]) => {
    const result = spawnSync(command, args, {
      cwd: options.cwd,
      encoding: 'utf-8',
      stdio: 'pipe'
    })
    return {
      status: result.error ? null : result.status,
      stdout: result.stdout ?? '',
      stderr: result.error?.message ?? result.stderr ?? ''
    }
  }

  // The branch is cut from HEAD, so anything already there rides along.
  const ahead = run('git', ['rev-list', '--count', `${DEFAULT_BASE_REF}..HEAD`])
  const aheadCount = Number(ahead.stdout.trim())
  if (ahead.status === 0 && Number.isFinite(aheadCount) && aheadCount > 0) {
    warn(
      'Unrelated commits',
      `HEAD is ${aheadCount} commit(s) ahead of ${DEFAULT_BASE_REF}`
    )
    info([
      `The pull request will contain those ${aheadCount} commit(s) as well as`,
      'the recorded test, because the branch is cut from where you are now.',
      '',
      'To open a PR with only the test, switch to an up-to-date base first:',
      '',
      `  git checkout ${DEFAULT_BASE_BRANCH} && git pull`
    ])
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
    return { success: false, error: add.stderr.trim() }
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
    fail('Git commit failed', commit.stderr.trim())
    return { success: false, error: commit.stderr.trim() }
  }
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
  const pr = run('gh', ['pr', 'create', '--title', prTitle, '--body', prBody])
  if (pr.status !== 0) {
    const stderr = pr.stderr.trim()
    fail('PR creation failed', stderr)
    info([
      `The branch ${branchName} is pushed, so nothing is lost.`,
      'Open the pull request from it directly, or retry with:',
      '',
      `  gh pr create --head ${branchName}`
    ])
    return { success: false, error: stderr, needsManualSteps: true }
  }

  const url = pr.stdout.trim()
  pass('Pull request created', url)
  return { success: true, url }
}
