import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { reportError } from '@/platform/telemetry/reportError'
import type { SavedPaymentMethod } from '@/platform/workspace/api/workspaceApi'

import { useHasSavedPaymentMethod } from './useHasSavedPaymentMethod'

const mockListSavedPaymentMethods = vi.hoisted(() =>
  vi.fn<() => Promise<SavedPaymentMethod[]>>()
)
const mockReportError = vi.hoisted(() => vi.fn<typeof reportError>())

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: {
    listSavedPaymentMethods: mockListSavedPaymentMethods
  }
}))

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: mockReportError
}))

async function flushLookup() {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

describe('useHasSavedPaymentMethod', () => {
  it('starts unknown before the lookup resolves', () => {
    mockListSavedPaymentMethods.mockResolvedValue([])

    const { hasSavedPaymentMethod } = useHasSavedPaymentMethod()

    expect(hasSavedPaymentMethod.value).toBeNull()
  })

  it('resolves true when a payment method is on file', async () => {
    mockListSavedPaymentMethods.mockResolvedValue([
      { id: 'pm-1', type: 'card', is_default: true }
    ])

    const { hasSavedPaymentMethod } = useHasSavedPaymentMethod()
    await flushLookup()

    expect(hasSavedPaymentMethod.value).toBe(true)
  })

  it('resolves false when only non-default methods are saved', async () => {
    mockListSavedPaymentMethods.mockResolvedValue([
      { id: 'pm-1', type: 'card', is_default: false }
    ])

    const { hasSavedPaymentMethod } = useHasSavedPaymentMethod()
    await flushLookup()

    expect(hasSavedPaymentMethod.value).toBe(false)
  })

  it('resolves false when no payment methods are saved', async () => {
    mockListSavedPaymentMethods.mockResolvedValue([])

    const { hasSavedPaymentMethod } = useHasSavedPaymentMethod()
    await flushLookup()

    expect(hasSavedPaymentMethod.value).toBe(false)
  })

  it('stays unknown and reports when the lookup fails', async () => {
    const failure = new Error('network')
    mockListSavedPaymentMethods.mockRejectedValue(failure)

    const { hasSavedPaymentMethod } = useHasSavedPaymentMethod()
    await flushLookup()

    expect(hasSavedPaymentMethod.value).toBeNull()
    expect(mockReportError).toHaveBeenCalledWith(failure, {
      errorType: 'saved_payment_methods_read_failure'
    })
  })
})
