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
})
