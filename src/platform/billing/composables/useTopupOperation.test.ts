import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import type { CreateTopupResponse } from '@/platform/workspace/api/workspaceApi'
import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import {
  fakeBillingSdk,
  pendingTopup,
  serverCode,
  settledTopup
} from '@/platform/billing/sdk/billingSdkTestUtils'
import type { BillingSdk } from '@/platform/billing/sdk/createBillingSdk'
import { billingOperation } from '@/platform/billing/composables/billingOperationTestUtils'
import { useTopupOperation } from '@/platform/billing/composables/useTopupOperation'
import { useBillingOperationStore } from '@/platform/billing/stores/billingOperationStore'
import { stubAccountIdentityPort } from '@/utils/__tests__/stubAccountIdentityPort'

vi.mock(import('firebase/auth'))

const flagState = vi.hoisted(() => ({
  billingSdkTopupEnabled: false,
  unifiedCloudAuthEnabled: true
}))
vi.mock<unknown>(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () => ({
    flags: {
      get billingSdkTopupEnabled() {
        return flagState.billingSdkTopupEnabled
      },
      get billingSdkTopupRailEnabled() {
        return (
          flagState.billingSdkTopupEnabled && flagState.unifiedCloudAuthEnabled
        )
      }
    }
  })
}))

vi.mock(import('@/platform/billing/composables/useBillingContext'))

vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))

vi.mock(import('@/platform/telemetry'))

const mockCreateBillingSdk = vi.hoisted(() => vi.fn<() => BillingSdk>())
vi.mock(import('@/platform/billing/sdk/createBillingSdk'), () => ({
  createBillingSdk: mockCreateBillingSdk
}))

let harness: ReturnType<typeof fakeBillingSdk>

beforeEach(() => {
  stubAccountIdentityPort()
  const billingContext = useBillingContext()
  vi.mocked(useBillingContext).mockReturnValue(billingContext)
  harness = fakeBillingSdk()
  mockCreateBillingSdk.mockReturnValue(harness.sdk)
  flagState.unifiedCloudAuthEnabled = true
})

describe('useTopupOperation', () => {
  it('reads and drives the poller while the SDK flag is off', () => {
    flagState.billingSdkTopupEnabled = false
    const store = useBillingOperationStore()
    Object.assign(store, {
      isAddingCredits: true,
      topupActionOperation: billingOperation({
        type: 'topup',
        opId: 'op-poller'
      })
    })

    const view = useTopupOperation()
    view.dismissOperation('op-poller')

    expect(view.isAddingCredits.value).toBe(true)
    expect(view.topupOperation.value?.opId).toBe('op-poller')
    expect(store.dismissOperation).toHaveBeenCalledWith('op-poller')
    expect(mockCreateBillingSdk).not.toHaveBeenCalled()
  })

  it('reads and drives the SDK while the flag is on', async () => {
    flagState.billingSdkTopupEnabled = true
    const store = useBillingOperationStore()
    Object.assign(store, {
      topupActionOperation: billingOperation({
        type: 'topup',
        opId: 'op-poller'
      })
    })

    const view = useTopupOperation()
    harness.publish(pendingTopup({ actionUrl: 'https://verify.example/op-1' }))

    expect(view.isAddingCredits.value).toBe(true)
    expect(view.topupOperation.value?.opId).toBe('op-1')

    view.dismissOperation('op-1')
    expect(view.topupOperation.value).toBeUndefined()
    expect(store.dismissOperation).not.toHaveBeenCalled()
  })

  it('stays on the poller while unified auth is off, whatever the SDK flag says', () => {
    flagState.billingSdkTopupEnabled = true
    flagState.unifiedCloudAuthEnabled = false

    useTopupOperation()

    expect(mockCreateBillingSdk).not.toHaveBeenCalled()
  })

  it('issues through the billing context while the SDK rail is off', async () => {
    flagState.billingSdkTopupEnabled = false
    const response: CreateTopupResponse = {
      billing_op_id: 'op-1',
      topup_id: 'topup-1',
      status: 'completed',
      amount_cents: 1000
    }
    vi.mocked(useBillingContext().topup).mockResolvedValue(response)

    await expect(useTopupOperation().topup(1000)).resolves.toBe(response)

    expect(mockCreateBillingSdk).not.toHaveBeenCalled()
  })

  it('issues through the SDK and keeps that rail after the flag flips', async () => {
    flagState.billingSdkTopupEnabled = true
    vi.mocked(harness.sdk.topup.createTopupCheckout).mockResolvedValue({
      status: 'ok',
      operation: settledTopup('succeeded'),
      creditsReconciled: true
    })
    const view = useTopupOperation()
    flagState.billingSdkTopupEnabled = false

    await expect(view.topup(1000)).resolves.toEqual({
      billing_op_id: 'op-1',
      topup_id: '',
      status: 'completed',
      amount_cents: 1000
    })
    expect(harness.sdk.topup.createTopupCheckout).toHaveBeenCalledWith({
      amountCents: 1000
    })
    expect(useBillingContext().topup).not.toHaveBeenCalled()
  })

  it.for([
    { rail: 'legacy', flagOn: false, registers: true },
    { rail: 'SDK', flagOn: true, registers: false }
  ])(
    'registers exactly one poller per pending top-up on the $rail rail',
    ({ flagOn, registers }) => {
      flagState.billingSdkTopupEnabled = flagOn
      const store = useBillingOperationStore()

      // Not awaited: the legacy registration settles only when the operation
      // does, which is the reason the dialog holds it as a promise.
      void useTopupOperation()
        .adoptPendingOperation('op-pending', { attemptStartedAt: 1000 })
        .catch(() => {})

      expect(store.startOperation).toHaveBeenCalledTimes(registers ? 1 : 0)
      if (registers) {
        expect(store.startOperation).toHaveBeenCalledWith(
          'op-pending',
          'topup',
          { attemptStartedAt: 1000 }
        )
      }
    }
  )

  it('surfaces an SDK refusal as a workspace error', async () => {
    flagState.billingSdkTopupEnabled = true
    vi.mocked(harness.sdk.topup.createTopupCheckout).mockResolvedValue({
      status: 'error',
      code: 'REQUEST_FAILED',
      httpStatus: 503
    })

    const refusal = await useTopupOperation()
      .topup(1000)
      .catch((error: unknown) => error)

    expect(refusal).toBeInstanceOf(WorkspaceApiError)
    expect(refusal).toMatchObject({ status: 503, code: 'REQUEST_FAILED' })
  })

  describe('createHostedCheckout', () => {
    type Refusal = { status: number; code: string }
    const busy: Refusal = { status: 409, code: 'TOPUP_CHECKOUT_BUSY' }
    const notPayable: Refusal = {
      status: 409,
      code: 'TOPUP_CHECKOUT_NOT_PAYABLE'
    }
    const unavailable: Refusal = {
      status: 503,
      code: 'TOPUP_CHECKOUT_UNAVAILABLE'
    }
    const returnUrl = 'https://cloud.comfy.org/topup-return'

    const rails = [
      {
        rail: 'legacy',
        flagOn: false,
        mint: (outcomes: Array<string | Refusal>) => {
          const mint = vi.spyOn(workspaceApi, 'createTopupCheckout')
          for (const outcome of outcomes) {
            if (typeof outcome === 'string') {
              mint.mockResolvedValueOnce({ checkout_url: outcome })
            } else {
              mint.mockRejectedValueOnce(
                new WorkspaceApiError('refused', outcome.status, outcome.code)
              )
            }
          }
          return mint
        }
      },
      {
        rail: 'SDK',
        flagOn: true,
        mint: (outcomes: Array<string | Refusal>) => {
          const mint = vi.mocked(harness.sdk.topup.createHostedTopupCheckout)
          for (const outcome of outcomes) {
            mint.mockResolvedValueOnce(
              typeof outcome === 'string'
                ? { status: 'ok', url: outcome }
                : {
                    status: 'error',
                    code: 'REQUEST_FAILED',
                    httpStatus: outcome.status,
                    serverCode: serverCode(outcome.code)
                  }
            )
          }
          return mint
        }
      }
    ]

    beforeEach(() => {
      vi.useFakeTimers()
    })

    async function settle(promise: Promise<string>) {
      const outcome = promise.then(
        (url) => ({ url }),
        (error: unknown) => ({ error })
      )
      await vi.runAllTimersAsync()
      return outcome
    }

    it.for(
      rails.flatMap((rail) => [
        {
          ...rail,
          name: 'a busy then not-payable checkout',
          outcomes: [busy, notPayable, 'https://stripe/new']
        },
        {
          ...rail,
          name: 'an unavailable checkout',
          outcomes: [unavailable, 'https://stripe/new']
        }
      ])
    )(
      'mints a fresh checkout after $name on the $rail rail',
      async ({ flagOn, mint, outcomes }) => {
        flagState.billingSdkTopupEnabled = flagOn
        const mintCheckout = mint(outcomes)

        const outcome = await settle(
          useTopupOperation().createHostedCheckout(1000, returnUrl)
        )

        expect(outcome).toEqual({ url: 'https://stripe/new' })
        expect(mintCheckout).toHaveBeenCalledTimes(outcomes.length)
      }
    )

    it.for(
      rails.flatMap((rail) => [
        {
          ...rail,
          name: 'a 503 without the unavailable code',
          outcomes: [{ status: 503, code: 'UPSTREAM_UNAVAILABLE' }],
          attempts: 1
        },
        {
          ...rail,
          name: 'the last retryable refusal',
          outcomes: [busy, busy, busy],
          attempts: 3
        }
      ])
    )(
      'surfaces $name on the $rail rail',
      async ({ flagOn, mint, outcomes, attempts }) => {
        flagState.billingSdkTopupEnabled = flagOn
        const mintCheckout = mint(outcomes)

        const outcome = await settle(
          useTopupOperation().createHostedCheckout(1000, returnUrl)
        )

        expect(outcome).toEqual({ error: expect.any(WorkspaceApiError) })
        expect(mintCheckout).toHaveBeenCalledTimes(attempts)
      }
    )

    it.for(rails)(
      'sends no retry once the scope aborts during the backoff on the $rail rail',
      async ({ flagOn, mint }) => {
        flagState.billingSdkTopupEnabled = flagOn
        const mintCheckout = mint([busy, 'https://stripe/other-scope'])
        const scope = new AbortController()

        const checkout = useTopupOperation()
          .createHostedCheckout(1000, returnUrl, scope.signal)
          .then(
            (url) => ({ url }),
            (error: unknown) => ({ error })
          )
        await vi.advanceTimersByTimeAsync(500)
        scope.abort()
        await vi.runAllTimersAsync()

        expect(await checkout).toEqual({ error: expect.anything() })
        expect(mintCheckout).toHaveBeenCalledTimes(1)
      }
    )

    it.for(rails)(
      'hands the dialog scope to the $rail checkout request',
      async ({ flagOn, mint }) => {
        flagState.billingSdkTopupEnabled = flagOn
        const mintCheckout = mint(['https://stripe/new'])
        const scope = new AbortController()

        await useTopupOperation().createHostedCheckout(
          1000,
          returnUrl,
          scope.signal
        )

        expect(mintCheckout.mock.lastCall).toContainEqual(
          flagOn
            ? { amountCents: 1000, returnUrl, signal: scope.signal }
            : scope.signal
        )
      }
    )
  })
})
