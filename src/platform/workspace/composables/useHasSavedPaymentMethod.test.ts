import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { reportError } from '@/platform/telemetry/reportError'
import type { SavedPaymentMethod } from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'

import type { BillingResult } from '@comfyorg/account-core/billing'

import type { BillingReadRail } from './useBillingReadRail'
import { useHasSavedPaymentMethod } from './useHasSavedPaymentMethod'

const mockReportError = vi.hoisted(() => vi.fn<typeof reportError>())

vi.mock(import('@/platform/workspace/api/workspaceApi'))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: mockReportError
}))

type PaymentMethodsRail = Pick<BillingReadRail, 'readPaymentMethods'>

/** Null is the legacy client; a rail is what the SDK store would hand back. */
const railState = vi.hoisted(() => ({
  rail: null as PaymentMethodsRail | null
}))
vi.mock<unknown>(
  import('@/platform/workspace/composables/useBillingReadRail'),
  () => ({ useBillingReadRail: () => railState.rail })
)

async function flushLookup() {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

describe('useHasSavedPaymentMethod', () => {
  beforeEach(() => {
    railState.rail = null
  })

  it('starts unknown before the lookup resolves', () => {
    vi.mocked(workspaceApi.listSavedPaymentMethods).mockResolvedValue([])

    const { hasSavedPaymentMethod } = useHasSavedPaymentMethod()

    expect(hasSavedPaymentMethod.value).toBeNull()
  })

  it('resolves true when a payment method is on file', async () => {
    vi.mocked(workspaceApi.listSavedPaymentMethods).mockResolvedValue([
      { id: 'pm-1', type: 'card', is_default: true }
    ])

    const { hasSavedPaymentMethod } = useHasSavedPaymentMethod()
    await flushLookup()

    expect(hasSavedPaymentMethod.value).toBe(true)
  })

  it('resolves false when only non-default methods are saved', async () => {
    vi.mocked(workspaceApi.listSavedPaymentMethods).mockResolvedValue([
      { id: 'pm-1', type: 'card', is_default: false }
    ])

    const { hasSavedPaymentMethod } = useHasSavedPaymentMethod()
    await flushLookup()

    expect(hasSavedPaymentMethod.value).toBe(false)
  })

  it('resolves false when no payment methods are saved', async () => {
    vi.mocked(workspaceApi.listSavedPaymentMethods).mockResolvedValue([])

    const { hasSavedPaymentMethod } = useHasSavedPaymentMethod()
    await flushLookup()

    expect(hasSavedPaymentMethod.value).toBe(false)
  })

  it('stays unknown and reports when the lookup fails', async () => {
    const failure = new Error('network')
    vi.mocked(workspaceApi.listSavedPaymentMethods).mockRejectedValue(failure)

    const { hasSavedPaymentMethod } = useHasSavedPaymentMethod()
    await flushLookup()

    expect(hasSavedPaymentMethod.value).toBeNull()
    expect(mockReportError).toHaveBeenCalledWith(failure, {
      errorType: 'saved_payment_methods_read_failure'
    })
  })
})

describe('useHasSavedPaymentMethod on the SDK rail', () => {
  const readPaymentMethods: Mock<BillingReadRail['readPaymentMethods']> =
    vi.fn()

  beforeEach(() => {
    railState.rail = { readPaymentMethods }
  })

  const railReads: {
    read: string
    result: BillingResult<SavedPaymentMethod[]>
    expected: boolean | null
  }[] = [
    {
      read: 'a default card',
      result: {
        status: 'ok',
        value: [{ id: 'pm-1', type: 'card', is_default: true }]
      },
      expected: true
    },
    {
      read: 'no cards',
      result: { status: 'ok', value: [] },
      expected: false
    },
    {
      read: 'a superseded scope',
      result: { status: 'error', code: 'SUPERSEDED' },
      expected: null
    }
  ]

  it.for(railReads)(
    'answers from $read on the rail without the legacy client',
    async ({ result, expected }) => {
      readPaymentMethods.mockResolvedValue(result)

      const { hasSavedPaymentMethod } = useHasSavedPaymentMethod()
      await flushLookup()

      expect(hasSavedPaymentMethod.value).toBe(expected)
      expect(workspaceApi.listSavedPaymentMethods).not.toHaveBeenCalled()
      expect(mockReportError).not.toHaveBeenCalled()
    }
  )

  it('stays unknown and reports a failed rail read', async () => {
    readPaymentMethods.mockResolvedValue({
      status: 'error',
      code: 'REQUEST_FAILED',
      httpStatus: 503
    })

    const { hasSavedPaymentMethod } = useHasSavedPaymentMethod()
    await flushLookup()

    expect(hasSavedPaymentMethod.value).toBeNull()
    expect(mockReportError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'REQUEST_FAILED', status: 503 }),
      { errorType: 'saved_payment_methods_read_failure' }
    )
  })
})
