import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createPr } from './gh'

const runMock = vi.fn()

const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' })
const failure = (stderr: string, status = 1) => ({ status, stdout: '', stderr })

const LINT_STAGED_MISSING_ASSERTION = [
  '✖ pnpm exec oxlint --type-aware --fix "browser_tests/tests/foo.spec.ts":',
  '',
  '  x playwright(expect-expect): Test has no assertions',
  '   ,-[browser_tests/tests/foo.spec.ts:11:3]',
  '',
  'Found 0 warnings and 1 error.',
  'husky - pre-commit script failed (code 1)'
].join('\n')

describe('createPr', () => {
  beforeEach(() => {
    runMock.mockReset()
  })

  it('checks out the original branch and deletes the new one when commit fails', async () => {
    runMock.mockImplementation((_cmd: string, args: string[]) => {
      const [sub] = args
      if (sub === 'rev-list') return ok('0')
      if (sub === 'rev-parse') return ok('main')
      if (sub === 'checkout' && args[1] === '-b') return ok()
      if (sub === 'add') return ok()
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
    expect(result.error).toContain('expect-expect')
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
})
