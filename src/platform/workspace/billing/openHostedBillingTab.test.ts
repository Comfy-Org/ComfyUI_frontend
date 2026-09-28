import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockHostedBillingRoute = vi.hoisted(() => vi.fn())
vi.mock<unknown>(
  import('@/platform/workspace/billing/hostedBillingRoutes'),
  () => ({ hostedBillingRoute: mockHostedBillingRoute })
)

const flagState = vi.hoisted(() => ({
  hostedBillingDestination: 'billing_web' as const
}))
vi.mock<unknown>(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () => ({
    flags: { hostedBillingDestination: flagState.hostedBillingDestination }
  })
}))

const mockFetchStatus = vi.hoisted(() => vi.fn(async () => {}))
const mockFetchBalance = vi.hoisted(() => vi.fn(async () => {}))
const mockReconcile = vi.hoisted(() => vi.fn(async () => {}))
vi.mock<unknown>(import('@/composables/billing/useBillingContext'), () => ({
  useBillingContext: () => ({
    fetchStatus: mockFetchStatus,
    fetchBalance: mockFetchBalance,
    reconcileSubscriptionSuccess: mockReconcile
  })
}))

const mockCapabilitiesRefresh = vi.hoisted(() => vi.fn(async () => {}))
vi.mock<unknown>(
  import('@/platform/workspace/composables/useBillingCapabilities'),
  () => ({
    useBillingCapabilities: () => ({ refresh: mockCapabilitiesRefresh })
  })
)

const mockStop = vi.hoisted(() => vi.fn())
const mockRegisterRefreshOnReturn = vi.hoisted(() =>
  vi.fn((_refresh: () => Promise<unknown>) => mockStop)
)
vi.mock<unknown>(
  import('@/platform/workspace/billing/refreshOnReturn'),
  () => ({ registerRefreshOnReturn: mockRegisterRefreshOnReturn })
)

import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import {
  disarmHostedBillingReturnRefresh,
  openHostedBillingTab
} from './openHostedBillingTab'

const BILLING_WEB_ROUTE = {
  kind: 'billing_web' as const,
  url: new URL('https://billing.example/v1/pricing')
}

function fakeTab(): Window {
  return { opener: undefined, location: { href: '' } } as unknown as Window
}

describe('openHostedBillingTab', () => {
  beforeEach(() => {
    mockHostedBillingRoute.mockReset().mockReturnValue(BILLING_WEB_ROUTE)
    mockFetchStatus.mockClear()
    mockFetchBalance.mockClear()
    mockCapabilitiesRefresh.mockClear()
    mockStop.mockClear()
    mockRegisterRefreshOnReturn.mockClear().mockReturnValue(mockStop)
    flagState.hostedBillingDestination = 'billing_web'
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'ws-123' })
  })

  it('resolves the route with the active workspace id', () => {
    mockHostedBillingRoute.mockReturnValue({ kind: 'provider' })

    const opened = openHostedBillingTab('pricing')

    expect(opened).toBe(false)
    expect(mockHostedBillingRoute).toHaveBeenCalledWith(
      'billing_web',
      'pricing',
      { plan: undefined, teamCreditStopId: undefined, workspaceId: 'ws-123' }
    )
  })

  it('passes an optional plan through to the route', () => {
    mockHostedBillingRoute.mockReturnValue({ kind: 'provider' })

    openHostedBillingTab('checkout', { plan: 'pro-monthly' })

    expect(mockHostedBillingRoute).toHaveBeenCalledWith(
      'billing_web',
      'checkout',
      {
        plan: 'pro-monthly',
        teamCreditStopId: undefined,
        workspaceId: 'ws-123'
      }
    )
  })

  it('passes an optional team credit stop through to the route', () => {
    mockHostedBillingRoute.mockReturnValue({ kind: 'provider' })

    openHostedBillingTab('checkout', {
      plan: 'team_per_credit_annual',
      teamCreditStopId: 'stop_700'
    })

    expect(mockHostedBillingRoute).toHaveBeenCalledWith(
      'billing_web',
      'checkout',
      {
        plan: 'team_per_credit_annual',
        teamCreditStopId: 'stop_700',
        workspaceId: 'ws-123'
      }
    )
  })

  it('returns false and opens nothing when the route stays on the provider', () => {
    mockHostedBillingRoute.mockReturnValue({ kind: 'provider' })
    const openSpy = vi.spyOn(window, 'open')

    expect(openHostedBillingTab('pricing')).toBe(false)
    expect(openSpy).not.toHaveBeenCalled()
    expect(mockRegisterRefreshOnReturn).not.toHaveBeenCalled()
  })

  it('returns false without arming a refresh when the tab is blocked', () => {
    vi.spyOn(window, 'open').mockReturnValue(null)

    expect(openHostedBillingTab('pricing')).toBe(false)
    expect(mockRegisterRefreshOnReturn).not.toHaveBeenCalled()
  })

  it('opens a disowned tab at the resolved url and arms one return refresh', () => {
    const tab = fakeTab()
    vi.spyOn(window, 'open').mockReturnValue(tab)

    expect(openHostedBillingTab('pricing')).toBe(true)
    expect(tab.opener).toBeNull()
    expect(tab.location.href).toBe(BILLING_WEB_ROUTE.url.href)
    expect(mockRegisterRefreshOnReturn).toHaveBeenCalledTimes(1)
  })

  it('refreshes status, balance, and capabilities when the armed refresh runs', async () => {
    vi.spyOn(window, 'open').mockReturnValue(fakeTab())

    openHostedBillingTab('pricing')
    const [refresh] = mockRegisterRefreshOnReturn.mock.calls[0]
    await refresh()

    expect(mockFetchStatus).toHaveBeenCalledTimes(1)
    expect(mockFetchBalance).toHaveBeenCalledTimes(1)
    expect(mockCapabilitiesRefresh).toHaveBeenCalledTimes(1)
  })

  it('stops the previous refresh before arming a new one on repeated opens', () => {
    vi.spyOn(window, 'open').mockReturnValue(fakeTab())

    // A prior test may already have armed a refresh whose stop callback is
    // this same mock, so the assertion is a delta rather than an absolute.
    openHostedBillingTab('pricing')
    const stopCallsAfterFirstOpen = mockStop.mock.calls.length

    openHostedBillingTab('pricing')

    expect(mockStop.mock.calls.length).toBe(stopCallsAfterFirstOpen + 1)
    expect(mockRegisterRefreshOnReturn).toHaveBeenCalledTimes(2)
  })

  describe('while a hosted payment tab is open', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.spyOn(window, 'open').mockReturnValue(fakeTab())
    })

    afterEach(() => {
      disarmHostedBillingReturnRefresh()
    })

    it.for(['checkout', 'subscription'] as const)(
      're-reads the checkout status so the app picks up the payment %s starts',
      async (intent) => {
        openHostedBillingTab(intent)
        mockReconcile.mockClear()

        await vi.advanceTimersByTimeAsync(4_000)
        expect(mockReconcile).toHaveBeenCalledTimes(1)
        await vi.advanceTimersByTimeAsync(4_000)
        expect(mockReconcile).toHaveBeenCalledTimes(2)
      }
    )

    it('does not watch for an intent that starts no payment', () => {
      openHostedBillingTab('payment-methods')
      mockReconcile.mockClear()

      vi.advanceTimersByTime(60_000)

      expect(mockReconcile).not.toHaveBeenCalled()
    })

    it('stops watching after fifteen minutes', () => {
      openHostedBillingTab('checkout')
      vi.advanceTimersByTime(15 * 60_000)
      mockReconcile.mockClear()

      vi.advanceTimersByTime(60_000)

      expect(mockReconcile).not.toHaveBeenCalled()
    })

    it('stops watching when disarmed', () => {
      openHostedBillingTab('checkout')
      disarmHostedBillingReturnRefresh()
      mockReconcile.mockClear()

      vi.advanceTimersByTime(60_000)

      expect(mockReconcile).not.toHaveBeenCalled()
    })

    it('skips a tick while the previous read is still in flight', async () => {
      let settle: () => void = () => {}
      mockReconcile.mockImplementationOnce(
        () => new Promise<void>((resolve) => (settle = resolve))
      )
      openHostedBillingTab('checkout')

      vi.advanceTimersByTime(8_000)
      expect(mockReconcile).toHaveBeenCalledOnce()

      settle()
      await vi.advanceTimersByTimeAsync(4_000)
      expect(mockReconcile).toHaveBeenCalledTimes(2)
    })

    it('keeps watching after a read fails', async () => {
      mockReconcile.mockRejectedValueOnce(new Error('status read failed'))
      openHostedBillingTab('checkout')

      await vi.advanceTimersByTimeAsync(8_000)

      expect(mockReconcile).toHaveBeenCalledTimes(2)
    })

    it('stops watching when a tab that starts no payment opens next', () => {
      openHostedBillingTab('checkout')
      openHostedBillingTab('payment-methods')
      mockReconcile.mockClear()

      vi.advanceTimersByTime(60_000)

      expect(mockReconcile).not.toHaveBeenCalled()
    })
  })
})
