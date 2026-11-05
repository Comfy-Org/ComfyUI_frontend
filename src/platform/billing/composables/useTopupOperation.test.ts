import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { billingApi } from '@/platform/billing/api/billingApi'
import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'
import {
  fakeBillingSdk,
  pendingTopup,
  serverCode
} from '@/platform/billing/sdk/billingSdkTestUtils'
import type { BillingSdk } from '@comfyorg/billing-core/sdk'
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

vi.mock(import('@comfyorg/telemetry'))

const mockCreateBillingSdk = vi.hoisted(() => vi.fn<() => BillingSdk>())
vi.mock(import('@comfyorg/billing-core/sdk'), () => ({
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
  it('reads the poller while the SDK flag is off', () => {
    flagState.billingSdkTopupEnabled = false
    const store = useBillingOperationStore()
    Object.assign(store, {
      topupActionOperation: billingOperation({
        type: 'topup',
        opId: 'op-poller'
      })
    })

    const view = useTopupOperation()

    expect(view.topupOperation.value?.opId).toBe('op-poller')
    expect(mockCreateBillingSdk).not.toHaveBeenCalled()
  })

  it('reads the SDK while the flag is on', async () => {
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

    expect(view.topupOperation.value?.opId).toBe('op-1')
  })

  it('stays on the poller while unified auth is off, whatever the SDK flag says', () => {
    flagState.billingSdkTopupEnabled = true
    flagState.unifiedCloudAuthEnabled = false

    useTopupOperation()

    expect(mockCreateBillingSdk).not.toHaveBeenCalled()
  })

  it('quotes on the legacy rail and reads a failure as no quote', async () => {
    flagState.billingSdkTopupEnabled = false
    const signal = new AbortController().signal
    vi.spyOn(billingApi, 'quoteTopup')
      .mockResolvedValueOnce({
        amount_cents: 5000,
        credits: 10550,
        expires_at: '2027-11-02'
      })
      .mockRejectedValueOnce(new WorkspaceApiError('down', 503))
    const view = useTopupOperation()

    await expect(view.quoteTopup(5000, signal)).resolves.toBe(10550)
    await expect(view.quoteTopup(5000, signal)).resolves.toBeNull()
  })

  it('quotes on the SDK rail and reads a failure as no quote', async () => {
    flagState.billingSdkTopupEnabled = true
    const signal = new AbortController().signal
    vi.mocked(harness.sdk.topup.quoteTopup)
      .mockResolvedValueOnce({
        status: 'ok',
        value: { amountCents: 5000, credits: 10550, expiresAt: '2027-11-02' }
      })
      .mockResolvedValueOnce({ status: 'error', code: 'REQUEST_FAILED' })
    const view = useTopupOperation()

    await expect(view.quoteTopup(5000, signal)).resolves.toBe(10550)
    await expect(view.quoteTopup(5000, signal)).resolves.toBeNull()
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
          const mint = vi.spyOn(billingApi, 'createTopupCheckout')
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
