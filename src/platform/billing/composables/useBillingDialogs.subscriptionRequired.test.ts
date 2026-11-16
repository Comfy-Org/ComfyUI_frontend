import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSubscriptionDialog } from '@/platform/billing/subscription/composables/useSubscriptionDialog'
import { remoteConfigState } from '@/platform/remoteConfig/remoteConfig'

const mockIsCloud = vi.hoisted(() => ({ value: true }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock(import('@/platform/remoteConfig/remoteConfig'))

const refreshRemoteConfig = vi.hoisted(() => vi.fn())
vi.mock(import('@/platform/remoteConfig/refreshRemoteConfig'), () => ({
  refreshRemoteConfig
}))

const reportError = vi.hoisted(() => vi.fn())
vi.mock(import('@comfyorg/telemetry/reportError'), () => ({
  reportError
}))

vi.mock(
  import('@/platform/billing/subscription/composables/useSubscriptionDialog')
)

import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'

describe('showSubscriptionRequiredDialog', () => {
  const originalConfig = window.__CONFIG__

  beforeEach(() => {
    mockIsCloud.value = true
    remoteConfigState.value = 'unloaded'
    window.__CONFIG__ = {}
  })

  afterEach(() => {
    window.__CONFIG__ = originalConfig
  })

  it('does nothing on a non-cloud distribution', async () => {
    mockIsCloud.value = false
    window.__CONFIG__ = { subscription_required: true }

    const opened = await useBillingDialogs().showSubscriptionRequiredDialog()

    expect(opened).toBe(false)
    expect(useSubscriptionDialog().show).not.toHaveBeenCalled()
    expect(refreshRemoteConfig).not.toHaveBeenCalled()
  })

  it('opens the pricing table immediately when config is already loaded', async () => {
    remoteConfigState.value = 'authenticated'
    window.__CONFIG__ = { subscription_required: true }

    const opened = await useBillingDialogs().showSubscriptionRequiredDialog({
      reason: 'subscribe_now_button'
    })

    expect(opened).toBe(true)
    expect(refreshRemoteConfig).not.toHaveBeenCalled()
    expect(useSubscriptionDialog().show).toHaveBeenCalledWith({
      reason: 'subscribe_now_button'
    })
  })

  it('retries the /features fetch instead of trusting an unloaded config snapshot', async () => {
    remoteConfigState.value = 'unloaded'
    window.__CONFIG__ = {}
    refreshRemoteConfig.mockImplementation(() => {
      window.__CONFIG__ = { subscription_required: true }
      return Promise.resolve()
    })

    const opened = await useBillingDialogs().showSubscriptionRequiredDialog()

    expect(opened).toBe(true)
    expect(refreshRemoteConfig).toHaveBeenCalledOnce()
    expect(useSubscriptionDialog().show).toHaveBeenCalledWith(undefined)
    expect(reportError).not.toHaveBeenCalled()
  })

  it('resolves false instead of rejecting when the config refresh fails', async () => {
    remoteConfigState.value = 'unloaded'
    window.__CONFIG__ = {}
    refreshRemoteConfig.mockRejectedValueOnce(new Error('offline'))

    const opened = await useBillingDialogs().showSubscriptionRequiredDialog()

    expect(opened).toBe(false)
    expect(useSubscriptionDialog().show).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledOnce()
    const [cause, options] = reportError.mock.calls[0]
    expect(cause).toMatchObject({ message: 'offline' })
    expect(options).toMatchObject({
      surface: 'billing',
      errorType: 'error_opening_subscription_dialog'
    })
  })

  it('reports a closed gate instead of returning silently', async () => {
    remoteConfigState.value = 'authenticated'
    window.__CONFIG__ = { subscription_required: false }

    const opened = await useBillingDialogs().showSubscriptionRequiredDialog()

    expect(opened).toBe(false)
    expect(useSubscriptionDialog().show).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledOnce()
    const [, options] = reportError.mock.calls[0]
    expect(options).toMatchObject({
      surface: 'billing',
      errorType: 'error_opening_subscription_dialog_gate_closed'
    })
  })
})
