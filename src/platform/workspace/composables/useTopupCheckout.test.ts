import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import { fakeBillingSdk } from '@/platform/workspace/billing/sdk/billingSdkTestUtils'
import type { BillingSdk } from '@/platform/workspace/billing/sdk/createBillingSdk'
import { useTopupCheckout } from '@/platform/workspace/composables/useTopupCheckout'
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

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

vi.mock(import('@/platform/telemetry'))

const mockCreateBillingSdk = vi.hoisted(() => vi.fn<() => BillingSdk>())
vi.mock(import('@/platform/workspace/billing/sdk/createBillingSdk'), () => ({
  createBillingSdk: mockCreateBillingSdk
}))

const checkoutUrl = 'https://checkout.stripe.com/c/pay/cs_test'
const returnUrl = 'https://cloud.comfy.org/'

let harness: ReturnType<typeof fakeBillingSdk>

beforeEach(() => {
  stubAccountIdentityPort()
  harness = fakeBillingSdk()
  mockCreateBillingSdk.mockReturnValue(harness.sdk)
  flagState.billingSdkTopupEnabled = false
  flagState.unifiedCloudAuthEnabled = true
})

describe('useTopupCheckout', () => {
  it.for([
    { name: 'the SDK flag is off', sdkFlag: false, unifiedAuth: true },
    { name: 'unified auth is off', sdkFlag: true, unifiedAuth: false }
  ])(
    'creates the checkout through the workspace API while $name',
    async ({ sdkFlag, unifiedAuth }) => {
      flagState.billingSdkTopupEnabled = sdkFlag
      flagState.unifiedCloudAuthEnabled = unifiedAuth
      const create = vi
        .spyOn(workspaceApi, 'createTopupCheckout')
        .mockResolvedValue({ checkout_url: checkoutUrl })

      await expect(
        useTopupCheckout().createHostedCheckout(5000, returnUrl)
      ).resolves.toEqual({ status: 'created', checkoutUrl })

      expect(create).toHaveBeenCalledWith(5000, returnUrl)
      expect(mockCreateBillingSdk).not.toHaveBeenCalled()
    }
  )

  it('creates the checkout through the SDK and keeps that rail after the flag flips', async () => {
    flagState.billingSdkTopupEnabled = true
    vi.mocked(harness.sdk.topup.createHostedTopupCheckout).mockResolvedValue({
      status: 'ok',
      url: checkoutUrl
    })
    const create = vi.spyOn(workspaceApi, 'createTopupCheckout')
    const checkout = useTopupCheckout()
    flagState.billingSdkTopupEnabled = false

    await expect(
      checkout.createHostedCheckout(5000, returnUrl)
    ).resolves.toEqual({ status: 'created', checkoutUrl })

    expect(harness.sdk.topup.createHostedTopupCheckout).toHaveBeenCalledWith({
      amountCents: 5000,
      returnUrl
    })
    expect(create).not.toHaveBeenCalled()
  })

  it.for([
    {
      rail: 'workspace API',
      sdkFlag: false,
      refuse: () =>
        vi
          .spyOn(workspaceApi, 'createTopupCheckout')
          .mockRejectedValue(
            new WorkspaceApiError('Bad return url', 400, 'INVALID_RETURN_URL')
          )
    },
    {
      rail: 'SDK',
      sdkFlag: true,
      refuse: () =>
        vi
          .mocked(harness.sdk.topup.createHostedTopupCheckout)
          .mockResolvedValue({
            status: 'error',
            code: 'REQUEST_FAILED',
            httpStatus: 503
          })
    }
  ])(
    'returns a refusal on the $rail rail as a failed outcome',
    async ({ sdkFlag, refuse }) => {
      flagState.billingSdkTopupEnabled = sdkFlag
      refuse()

      const outcome = await useTopupCheckout().createHostedCheckout(
        5000,
        returnUrl
      )

      expect(outcome.status).toBe('failed')
      expect(outcome.status === 'failed' && outcome.error).toBeInstanceOf(
        WorkspaceApiError
      )
    }
  )
})
