import { execSync, spawnSync } from 'node:child_process'
import { pass, fail } from '../ui/logger'

interface PrOptions {
  testFilePath: string
  testName: string
  description: string
  branchName?: string
}

interface PrResult {
  success: boolean
  url?: string
  error?: string
}

export async function checkGhAvailable(): Promise<{
  available: boolean
  authenticated: boolean
}> {
  try {
    execSync('gh --version', { stdio: 'pipe' })
  } catch {
    return { available: false, authenticated: false }
  }

  try {
    execSync('gh auth status', {
      stdio: 'pipe',
      encoding: 'utf-8'
    })
    return { available: true, authenticated: true }
  } catch {
    return { available: true, authenticated: false }
  }
}

export async function createPr(options: PrOptions): Promise<PrResult> {
  const branchName = options.branchName ?? `test/${options.testName}`
  const commitMsg = `test: add ${options.testName} e2e test\n\n${options.description}`
  const prTitle = `test: add ${options.testName} e2e test`
  const prBody =
    `${options.description}\n\n---\n\n` + 'Recorded with `comfy-test record`'

  const checkout = spawnSync('git', ['checkout', '-b', branchName], {
    encoding: 'utf-8',
    stdio: 'pipe'
  })
  if (checkout.status !== 0) {
    fail('Branch creation failed', checkout.stderr.trim())
    return {
      success: false,
      error: checkout.stderr.trim()
    }
  }
  pass('Created branch', branchName)

  const add = spawnSync('git', ['add', options.testFilePath], {
    encoding: 'utf-8',
    stdio: 'pipe'
  })
  if (add.status !== 0) {
    fail('Git add failed', add.stderr.trim())
    return { success: false, error: add.stderr.trim() }
  }

  const commit = spawnSync('git', ['commit', '-m', commitMsg], {
    encoding: 'utf-8',
    stdio: 'pipe'
  })
  if (commit.status !== 0) {
    fail('Git commit failed', commit.stderr.trim())
    return { success: false, error: commit.stderr.trim() }
  }
  pass('Committed test file')

  const push = spawnSync(
    'git',
    ['push', '-u', 'origin', branchName],
    { encoding: 'utf-8', stdio: 'pipe' }
  )
  if (push.status !== 0) {
    fail('Git push failed', push.stderr.trim())
    return { success: false, error: push.stderr.trim() }
  }
  pass('Pushed branch', branchName)

  const pr = spawnSync(
    'gh',
    ['pr', 'create', '--title', prTitle, '--body', prBody, '--fill'],
    { encoding: 'utf-8', stdio: 'pipe' }
  )
  if (pr.status !== 0) {
    fail('PR creation failed', pr.stderr.trim())
    return { success: false, error: pr.stderr.trim() }
  }

  const url = pr.stdout.trim()
  pass('Pull request created', url)
  return { success: true, url }
}
