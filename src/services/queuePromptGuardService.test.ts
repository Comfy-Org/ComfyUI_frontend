import { afterEach, describe, expect, it, vi } from 'vitest'

import type { LGraph } from '@/lib/litegraph/src/litegraph'

import {
  registerQueuePromptGuard,
  runQueuePromptGuards
} from './queuePromptGuardService'

const addToast = vi.hoisted(() => vi.fn())

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: addToast })
}))

describe('queuePromptGuardService', () => {
  const unregisterGuards: Array<() => void> = []

  afterEach(() => {
    unregisterGuards.splice(0).forEach((unregister) => unregister())
    vi.restoreAllMocks()
  })

  it('fails closed while continuing after guards throw or reject', async () => {
    const error = new Error('Invalid graph')
    const successfulGuard = vi.fn(() => true)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    unregisterGuards.push(
      registerQueuePromptGuard('test.throw', () => {
        throw error
      }),
      registerQueuePromptGuard('test.reject', async () => {
        await Promise.resolve()
        throw error
      }),
      registerQueuePromptGuard('test.success', successfulGuard)
    )

    await expect(
      runQueuePromptGuards({ rootGraph: {} as LGraph })
    ).resolves.toBe(false)

    expect(successfulGuard).toHaveBeenCalledOnce()
    expect(consoleError).toHaveBeenCalledTimes(2)
    expect(addToast).toHaveBeenCalledOnce()
    expect(addToast).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'Failed to queue'
    })
  })
})
