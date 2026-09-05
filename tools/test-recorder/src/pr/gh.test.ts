import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createPr } from './gh'

const runMock = vi.fn()

const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' })
const failure = (stderr: string, status = 1) => ({ status, stdout: '', stderr })
const noStashNeeded = () => ok('No local changes to save')

const LINT_STAGED_MISSING_ASSERTION = [
  '✖ pnpm exec oxlint --type-aware --fix "browser_tests/tests/foo.spec.ts":',
  '',
  '  x playwright(expect-expect): Test has no assertions',
  '   ,-[browser_tests/tests/foo.spec.ts:11:3]',
  '',
  'Found 0 warnings and 1 error.',
  'husky - pre-commit script failed (code 1)'
].join('\n')

const LINT_STAGED_TS_ERROR_OTHER_FILE = [
  '✖ pnpm typecheck:browser:',
  '$ vue-tsc --project browser_tests/tsconfig.json',
  "browser_tests/tests/stray.spec.ts(3,18): error TS6133: 'expect' is declared but its value is never read.",
  '[ELIFECYCLE] Command failed with exit code 2.',
  'husky - pre-commit script failed (code 1)'
].join('\n')

describe('createPr', () => {
  let consoleLines: string[]

  beforeEach(() => {
    runMock.mockReset()
    consoleLines = []
    vi.spyOn(console, 'log').mockImplementation((value?: unknown) => {
      consoleLines.push(String(value ?? ''))
    })
  })

  it('checks out the original branch and deletes the new one when commit fails', async () => {
    runMock.mockImplementation((_cmd: string, args: string[]) => {
      const [sub] = args
      if (sub === 'rev-list') return ok('0')
      if (sub === 'rev-parse') return ok('main')
      if (sub === 'checkout' && args[1] === '-b') return ok()
      if (sub === 'add') return ok()
      if (sub === 'stash') return noStashNeeded()
      if (sub === 'commit') return failure(LINT_STAGED_MISSING_ASSERTION)
      if (sub === 'checkout') return ok() // back to original branch
      if (sub === 'branch') return ok() // -D new branch
      throw new Error(`unexpected git ${args.join(' ')}`)
    })

    const result = await createPr({
      testFilePath: 'browser_tests/tests/foo.spec.ts',
      testName: 'foo',
      description: 'desc',
      run: runMock
    })

    expect(result.success).toBe(false)
    const calls = runMock.mock.calls.map(([, args]) => args.join(' '))
    expect(calls).toContain('checkout main')
    expect(calls).toContain('branch -D test/foo')
  })

  it('explains a missing-assertion pre-commit failure in plain language', async () => {
    runMock.mockImplementation((_cmd: string, args: string[]) => {
      const [sub] = args
      if (sub === 'rev-list') return ok('0')
      if (sub === 'rev-parse') return ok('main')
      if (sub === 'checkout') return ok()
      if (sub === 'add') return ok()
      if (sub === 'stash') return noStashNeeded()
      if (sub === 'commit') return failure(LINT_STAGED_MISSING_ASSERTION)
      if (sub === 'branch') return ok()
      throw new Error(`unexpected git ${args.join(' ')}`)
    })

    const result = await createPr({
      testFilePath: 'browser_tests/tests/foo.spec.ts',
      testName: 'foo',
      description: 'desc',
      run: runMock
    })

    expect(result.success).toBe(false)
    expect(consoleLines.join('\n')).toContain(
      'Add at least one `await expect(...)` call'
    )
  })

  it('names the actual broken file when vue-tsc fails on something else entirely', async () => {
    runMock.mockImplementation((_cmd: string, args: string[]) => {
      const [sub] = args
      if (sub === 'rev-list') return ok('0')
      if (sub === 'rev-parse') return ok('main')
      if (sub === 'checkout') return ok()
      if (sub === 'add') return ok()
      if (sub === 'stash') return noStashNeeded()
      if (sub === 'commit') return failure(LINT_STAGED_TS_ERROR_OTHER_FILE)
      if (sub === 'branch') return ok()
      throw new Error(`unexpected git ${args.join(' ')}`)
    })

    const result = await createPr({
      testFilePath: 'browser_tests/tests/foo.spec.ts',
      testName: 'foo',
      description: 'desc',
      run: runMock
    })

    expect(result.success).toBe(false)
    const explained = consoleLines.join('\n')
    expect(explained).toContain('A DIFFERENT file has a type error')
    expect(explained).toContain('browser_tests/tests/stray.spec.ts')
    expect(explained).toContain('rm browser_tests/tests/stray.spec.ts')
  })

  it('stashes other changes before committing and restores them after', async () => {
    const calls: string[] = []
    runMock.mockImplementation((cmd: string, args: string[]) => {
      calls.push(args.join(' '))
      if (cmd === 'gh') return ok('https://github.com/org/repo/pull/1')
      const [sub] = args
      if (sub === 'rev-list') return ok('0')
      if (sub === 'rev-parse') return ok('main')
      if (sub === 'checkout') return ok()
      if (sub === 'add') return ok()
      if (sub === 'stash' && args[1] === 'push')
        return ok('Saved working directory')
      if (sub === 'stash' && args[1] === 'pop') return ok()
      if (sub === 'commit') return ok()
      if (sub === 'push') return ok()
      throw new Error(`unexpected git ${args.join(' ')}`)
    })

    await createPr({
      testFilePath: 'browser_tests/tests/foo.spec.ts',
      testName: 'foo',
      description: 'desc',
      cwd: '/repo',
      run: runMock
    })

    const stashPushIndex = calls.findIndex((c) => c.startsWith('stash push'))
    const commitIndex = calls.findIndex((c) => c.startsWith('commit'))
    const stashPopIndex = calls.findIndex((c) => c.startsWith('stash pop'))
    expect(stashPushIndex).toBeGreaterThan(-1)
    expect(stashPushIndex).toBeLessThan(commitIndex)
    expect(stashPopIndex).toBeGreaterThan(commitIndex)
  })

  it('does not attempt a stash pop when nothing was stashed', async () => {
    const calls: string[] = []
    runMock.mockImplementation((cmd: string, args: string[]) => {
      calls.push(args.join(' '))
      if (cmd === 'gh') return ok('https://github.com/org/repo/pull/1')
      const [sub] = args
      if (sub === 'rev-list') return ok('0')
      if (sub === 'rev-parse') return ok('main')
      if (sub === 'checkout') return ok()
      if (sub === 'add') return ok()
      if (sub === 'stash') return noStashNeeded()
      if (sub === 'commit') return ok()
      if (sub === 'push') return ok()
      throw new Error(`unexpected git ${args.join(' ')}`)
    })

    await createPr({
      testFilePath: 'browser_tests/tests/foo.spec.ts',
      testName: 'foo',
      description: 'desc',
      run: runMock
    })

    expect(calls.some((c) => c.startsWith('stash pop'))).toBe(false)
  })

  it('excludes only the recorded file from the stash, by relative path', async () => {
    const calls: string[] = []
    runMock.mockImplementation((cmd: string, args: string[]) => {
      calls.push(args.join(' '))
      if (cmd === 'gh') return ok('https://github.com/org/repo/pull/1')
      const [sub] = args
      if (sub === 'rev-list') return ok('0')
      if (sub === 'rev-parse') return ok('main')
      if (sub === 'checkout') return ok()
      if (sub === 'add') return ok()
      if (sub === 'stash') return noStashNeeded()
      if (sub === 'commit') return ok()
      if (sub === 'push') return ok()
      throw new Error(`unexpected git ${args.join(' ')}`)
    })

    await createPr({
      testFilePath: '/repo/browser_tests/tests/foo.spec.ts',
      testName: 'foo',
      description: 'desc',
      cwd: '/repo',
      run: runMock
    })

    const stashPush = calls.find((c) => c.startsWith('stash push'))
    expect(stashPush).toContain(':!browser_tests/tests/foo.spec.ts')
    expect(stashPush).not.toContain('/repo/browser_tests')
  })

  it('does not touch branches when checkout itself fails', async () => {
    runMock.mockImplementation((_cmd: string, args: string[]) => {
      const [sub] = args
      if (sub === 'rev-list') return ok('0')
      if (sub === 'rev-parse') return ok('main')
      if (sub === 'checkout') return failure('fatal: already exists')
      throw new Error(`unexpected git ${args.join(' ')}`)
    })

    const result = await createPr({
      testFilePath: 'browser_tests/tests/foo.spec.ts',
      testName: 'foo',
      description: 'desc',
      run: runMock
    })

    expect(result.success).toBe(false)
    const calls = runMock.mock.calls.map(([, args]) => args.join(' '))
    expect(calls).not.toContain('branch -D test/foo')
  })

  it('succeeds end to end when every step passes', async () => {
    runMock.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'gh') return ok('https://github.com/org/repo/pull/1')
      const [sub] = args
      if (sub === 'rev-list') return ok('0')
      if (sub === 'rev-parse') return ok('main')
      if (sub === 'checkout') return ok()
      if (sub === 'add') return ok()
      if (sub === 'stash') return noStashNeeded()
      if (sub === 'commit') return ok()
      if (sub === 'push') return ok()
      throw new Error(`unexpected git ${args.join(' ')}`)
    })

    const result = await createPr({
      testFilePath: 'browser_tests/tests/foo.spec.ts',
      testName: 'foo',
      description: 'desc',
      run: runMock
    })

    expect(result.success).toBe(true)
    expect(result.url).toBe('https://github.com/org/repo/pull/1')
  })

  it('stacks the PR on the branch it was cut from, not main', async () => {
    const calls: string[] = []
    runMock.mockImplementation((cmd: string, args: string[]) => {
      calls.push(args.join(' '))
      if (cmd === 'gh') return ok('https://github.com/org/repo/pull/1')
      const [sub] = args
      if (sub === 'rev-list') return ok('0')
      if (sub === 'rev-parse') return ok('feature/in-progress')
      if (sub === 'ls-remote') return ok() // branch exists on origin
      if (sub === 'checkout') return ok()
      if (sub === 'add') return ok()
      if (sub === 'stash') return noStashNeeded()
      if (sub === 'commit') return ok()
      if (sub === 'push') return ok()
      throw new Error(`unexpected git ${args.join(' ')}`)
    })

    const result = await createPr({
      testFilePath: 'browser_tests/tests/foo.spec.ts',
      testName: 'foo',
      description: 'desc',
      run: runMock
    })

    expect(result.success).toBe(true)
    const prCall = calls.find((c) => c.startsWith('pr create'))
    expect(prCall).toContain('--base feature/in-progress')
  })

  it('falls back to main when the current branch was never pushed', async () => {
    const calls: string[] = []
    runMock.mockImplementation((cmd: string, args: string[]) => {
      calls.push(args.join(' '))
      if (cmd === 'gh') return ok('https://github.com/org/repo/pull/1')
      const [sub] = args
      if (sub === 'rev-list') return ok('0')
      if (sub === 'rev-parse') return ok('feature/local-only')
      if (sub === 'ls-remote') return failure('', 2) // not on origin
      if (sub === 'checkout') return ok()
      if (sub === 'add') return ok()
      if (sub === 'stash') return noStashNeeded()
      if (sub === 'commit') return ok()
      if (sub === 'push') return ok()
      throw new Error(`unexpected git ${args.join(' ')}`)
    })

    const result = await createPr({
      testFilePath: 'browser_tests/tests/foo.spec.ts',
      testName: 'foo',
      description: 'desc',
      run: runMock
    })

    expect(result.success).toBe(true)
    const prCall = calls.find((c) => c.startsWith('pr create'))
    expect(prCall).toContain('--base main')
  })

  it('never checks the remote when already on main', async () => {
    const calls: string[] = []
    runMock.mockImplementation((cmd: string, args: string[]) => {
      calls.push(args.join(' '))
      if (cmd === 'gh') return ok('https://github.com/org/repo/pull/1')
      const [sub] = args
      if (sub === 'rev-list') return ok('0')
      if (sub === 'rev-parse') return ok('main')
      if (sub === 'checkout') return ok()
      if (sub === 'add') return ok()
      if (sub === 'stash') return noStashNeeded()
      if (sub === 'commit') return ok()
      if (sub === 'push') return ok()
      throw new Error(`unexpected git ${args.join(' ')}`)
    })

    await createPr({
      testFilePath: 'browser_tests/tests/foo.spec.ts',
      testName: 'foo',
      description: 'desc',
      run: runMock
    })

    expect(calls.some((c) => c.startsWith('ls-remote'))).toBe(false)
  })

  it('returns the original and current branch on success, for a caller-side switch-back prompt', async () => {
    runMock.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'gh') return ok('https://github.com/org/repo/pull/1')
      const [sub] = args
      if (sub === 'rev-list') return ok('0')
      if (sub === 'rev-parse') return ok('feature/in-progress')
      if (sub === 'ls-remote') return ok()
      if (sub === 'checkout') return ok()
      if (sub === 'add') return ok()
      if (sub === 'stash') return noStashNeeded()
      if (sub === 'commit') return ok()
      if (sub === 'push') return ok()
      throw new Error(`unexpected git ${args.join(' ')}`)
    })

    const result = await createPr({
      testFilePath: 'browser_tests/tests/foo.spec.ts',
      testName: 'foo',
      description: 'desc',
      run: runMock
    })

    expect(result.originalBranch).toBe('feature/in-progress')
    expect(result.currentBranch).toBe('test/foo')
  })
})
