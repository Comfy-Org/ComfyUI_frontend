import type * as fs from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { openPr } from './openPr'

vi.mock('./gh', () => ({
  checkGhAvailable: vi.fn(),
  createPr: vi.fn(),
  switchBranch: vi.fn()
}))
vi.mock('./clipboard', () => ({ copyToClipboard: vi.fn() }))
vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof fs>()),
  readFileSync: vi.fn(() => 'contents')
}))
vi.mock('@clack/prompts', () => ({
  confirm: vi.fn(),
  isCancel: vi.fn(() => false)
}))

import { confirm } from '@clack/prompts'
import { checkGhAvailable, createPr, switchBranch } from './gh'

function setTTY(value: boolean | undefined) {
  Object.defineProperty(process.stdin, 'isTTY', {
    value,
    configurable: true
  })
}

describe('openPr', () => {
  const originalIsTTY = process.stdin.isTTY

  beforeEach(() => {
    vi.mocked(checkGhAvailable).mockResolvedValue({
      available: true,
      authenticated: true
    })
    vi.mocked(switchBranch).mockReturnValue({ success: true })
  })

  afterEach(() => {
    setTTY(originalIsTTY)
  })

  it('stays on the new branch and returns without prompting when stdin is not a TTY', async () => {
    setTTY(false)
    vi.mocked(createPr).mockResolvedValue({
      success: true,
      url: 'https://github.com/org/repo/pull/1',
      currentBranch: 'test/foo',
      originalBranch: 'feature/wip'
    })

    await openPr({
      testFilePath: 'browser_tests/tests/foo.spec.ts',
      testName: 'foo',
      description: 'desc',
      projectRoot: '/repo'
    })

    expect(switchBranch).not.toHaveBeenCalled()
  })

  it('does nothing branch-related when createPr did not return branch info', async () => {
    setTTY(false)
    vi.mocked(createPr).mockResolvedValue({
      success: true,
      url: 'https://github.com/org/repo/pull/1'
    })

    await openPr({
      testFilePath: 'browser_tests/tests/foo.spec.ts',
      testName: 'foo',
      description: 'desc',
      projectRoot: '/repo'
    })

    expect(switchBranch).not.toHaveBeenCalled()
  })

  describe('interactive switch-back (TTY)', () => {
    beforeEach(() => {
      setTTY(true)
      vi.mocked(createPr).mockResolvedValue({
        success: true,
        url: 'https://github.com/org/repo/pull/1',
        currentBranch: 'test/foo',
        originalBranch: 'feature/wip'
      })
    })

    it('switches back when the user confirms', async () => {
      vi.mocked(confirm).mockResolvedValue(true)

      await openPr({
        testFilePath: 'browser_tests/tests/foo.spec.ts',
        testName: 'foo',
        description: 'desc',
        projectRoot: '/repo'
      })

      expect(switchBranch).toHaveBeenCalledWith('feature/wip', {
        cwd: '/repo'
      })
    })

    it('does not check out when the user declines', async () => {
      vi.mocked(confirm).mockResolvedValue(false)

      await openPr({
        testFilePath: 'browser_tests/tests/foo.spec.ts',
        testName: 'foo',
        description: 'desc',
        projectRoot: '/repo'
      })

      expect(switchBranch).not.toHaveBeenCalled()
    })

    it('shows the manual recovery command when switchBranch fails', async () => {
      vi.mocked(confirm).mockResolvedValue(true)
      vi.mocked(switchBranch).mockReturnValue({
        success: false,
        error: 'not a branch'
      })
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await openPr({
        testFilePath: 'browser_tests/tests/foo.spec.ts',
        testName: 'foo',
        description: 'desc',
        projectRoot: '/repo'
      })

      const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n')
      expect(output).toContain('git checkout feature/wip')
    })
  })
})
