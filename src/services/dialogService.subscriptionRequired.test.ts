/**
 * showSubscriptionRequiredDialog is the seam every "Subscribe" CTA routes
 * through (topbar, paywall banners, and the in-app agent's paywall card via
 * useAccountPreconditionDialog). It must never resolve to a dead click: when
 * window.__CONFIG__ hasn't been populated yet it should retry a fetch before
 * giving up, and a gate that stays closed must be observable rather than a
 * silent no-op.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
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
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError
}))

vi.mock(
  import('@/platform/cloud/subscription/composables/useSubscriptionDialog')
)

import { useDialogService } from '@/services/dialogService'

const showSubscriptionDialog = vi.mocked(useSubscriptionDialog().show)

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

    await useDialogService().showSubscriptionRequiredDialog()

    expect(showSubscriptionDialog).not.toHaveBeenCalled()
    expect(refreshRemoteConfig).not.toHaveBeenCalled()
  })

  it('opens the pricing table immediately when config is already loaded', async () => {
    remoteConfigState.value = 'authenticated'
    window.__CONFIG__ = { subscription_required: true }

    await useDialogService().showSubscriptionRequiredDialog({
      reason: 'subscribe_now_button'
    })

    expect(refreshRemoteConfig).not.toHaveBeenCalled()
    expect(showSubscriptionDialog).toHaveBeenCalledWith({
      reason: 'subscribe_now_button'
    })
  })

  it('retries the /features fetch instead of trusting an unloaded config snapshot', async () => {
    // A caller (e.g. the agent panel's paywall card) can fire before the
    // bootstrap fetch resolves, so window.__CONFIG__ is still empty.
    remoteConfigState.value = 'unloaded'
    window.__CONFIG__ = {}
    refreshRemoteConfig.mockImplementation(() => {
      window.__CONFIG__ = { subscription_required: true }
      return Promise.resolve()
    })

    await useDialogService().showSubscriptionRequiredDialog()

    expect(refreshRemoteConfig).toHaveBeenCalledOnce()
    expect(showSubscriptionDialog).toHaveBeenCalledWith(undefined)
    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports a closed gate instead of returning silently', async () => {
    remoteConfigState.value = 'authenticated'
    window.__CONFIG__ = { subscription_required: false }

    await useDialogService().showSubscriptionRequiredDialog()

    expect(showSubscriptionDialog).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledOnce()
    const [, options] = reportError.mock.calls[0]
    expect(options).toMatchObject({
      errorType: 'error_opening_subscription_dialog_gate_closed'
    })
  })
})
