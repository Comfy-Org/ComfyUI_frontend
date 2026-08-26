import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useHasSavedPaymentMethod } from './useHasSavedPaymentMethod'

const mockListSavedPaymentMethods = vi.hoisted(() =>
  vi.fn<() => Promise<{ id: string }[]>>()
)

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: {
    listSavedPaymentMethods: mockListSavedPaymentMethods
  }
}))

async function flushLookup() {
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
    mockListSavedPaymentMethods.mockResolvedValue([{ id: 'pm-1' }])

    const { hasSavedPaymentMethod } = useHasSavedPaymentMethod()
    await flushLookup()

    expect(hasSavedPaymentMethod.value).toBe(true)
  })

  it('resolves false when no payment methods are saved', async () => {
    mockListSavedPaymentMethods.mockResolvedValue([])

    const { hasSavedPaymentMethod } = useHasSavedPaymentMethod()
    await flushLookup()

    expect(hasSavedPaymentMethod.value).toBe(false)
  })

  it('stays unknown when the lookup fails', async () => {
    mockListSavedPaymentMethods.mockRejectedValue(new Error('network'))

    const { hasSavedPaymentMethod } = useHasSavedPaymentMethod()
    await flushLookup()

    expect(hasSavedPaymentMethod.value).toBeNull()
  })
})
