import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

const hoisted = vi.hoisted(() => {
  const customerIoTrack = vi.fn(
    (_event: string, _properties?: Record<string, unknown>) => Promise.resolve()
  )
  const userEmail: { value: string | null } = { value: null }
  const resolvedUserInfo: { value: { id: string } | null } = { value: null }

  return {
    onUserResolved: vi.fn(),
    onUserLogout: vi.fn(),
    userEmail,
    resolvedUserInfo,
    posthogInit: vi.fn(),
    mixpanelInit: vi.fn(
      (_token: string, _options: { loaded: () => void }) => {}
    ),
    customerIoTrack,
    customerIoLoad: vi.fn(() => ({
      identify: vi.fn(() => Promise.resolve()),
      page: vi.fn(),
      track: customerIoTrack,
      reset: vi.fn()
    }))
  }
})

vi.mock(import('@/composables/auth/useCurrentUser'))

vi.mock<unknown>(import('posthog-js'), () => ({
  default: {
    init: hoisted.posthogInit,
    capture: vi.fn(),
    identify: vi.fn(),
    register: vi.fn(),
    unregister: vi.fn(),
    get_property: vi.fn(),
    people: { set: vi.fn(), set_once: vi.fn() },
    reset: vi.fn()
  }
}))

vi.mock<unknown>(import('mixpanel-browser'), () => ({
  default: {
    init: hoisted.mixpanelInit,
    track: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    people: { set: vi.fn() }
  }
}))

vi.mock<unknown>(import('@customerio/cdp-analytics-browser'), () => ({
  AnalyticsBrowser: { load: hoisted.customerIoLoad }
}))

vi.mock(import('@/platform/remoteConfig/remoteConfig'))

vi.mock(import('@/composables/billing/useBillingContext'))

import {
  markStoresPending,
  markStoresReady
} from '@/platform/telemetry/storeReadiness'
import { TelemetryEvents } from '@/platform/telemetry/types'

import { CustomerIoTelemetryProvider } from './CustomerIoTelemetryProvider'
import { MixpanelTelemetryProvider } from './MixpanelTelemetryProvider'
import { PostHogTelemetryProvider } from './PostHogTelemetryProvider'

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

/**
 * Each provider finishes its SDK dynamic import inside the window where
 * `main.ts` has not installed Pinia yet, so reaching `useCurrentUser()` there
 * is the crash these gates exist to prevent. Asserting at the provider
 * boundary keeps the gates from being removed while the isolated
 * `storeReadiness` tests stay green.
 */
describe('telemetry providers wait for Pinia before touching stores', () => {
  beforeEach(() => {
    const currentUser = vi.mocked(useCurrentUser())
    currentUser.userEmail = computed(() => hoisted.userEmail.value)
    currentUser.resolvedUserInfo = computed(
      () => hoisted.resolvedUserInfo.value
    )
    currentUser.onUserResolved.mockImplementation(hoisted.onUserResolved)
    currentUser.onUserLogout.mockImplementation(hoisted.onUserLogout)
    const billing = useBillingContext()
    billing.tier = computed(() => null)
    vi.mocked(useBillingContext).mockReturnValue(billing)
    remoteConfig.value = {}
    setActivePinia(undefined)
    markStoresPending()
  })

  afterEach(() => {
    markStoresReady()
    delete (window as { __CONFIG__?: unknown }).__CONFIG__
  })

  function configureCustomerIo(): void {
    window.__CONFIG__ = {
      customer_io: { write_key: 'cdp_test_write_key', site_id: 'site_test' }
    }
  }

  it('gates PostHog user identification', async () => {
    window.__CONFIG__ = {
      posthog_project_token: 'phc_test_token'
    }

    new PostHogTelemetryProvider()
    await vi.waitFor(() => expect(hoisted.posthogInit).toHaveBeenCalled())
    await flushMicrotasks()
    expect(hoisted.onUserResolved).not.toHaveBeenCalled()

    markStoresReady()
    await vi.waitFor(() => expect(hoisted.onUserResolved).toHaveBeenCalled())
  })

  it('gates Mixpanel user identification', async () => {
    window.__CONFIG__ = {
      mixpanel_token: 'mp_test_token'
    }

    new MixpanelTelemetryProvider()
    await vi.waitFor(() => expect(hoisted.mixpanelInit).toHaveBeenCalled())
    const [, options] = hoisted.mixpanelInit.mock.calls[0]
    options.loaded()
    await flushMicrotasks()
    expect(hoisted.onUserResolved).not.toHaveBeenCalled()

    markStoresReady()
    await vi.waitFor(() => expect(hoisted.onUserResolved).toHaveBeenCalled())
  })

  it('disables Customer.io in-app before gating user identification', async () => {
    configureCustomerIo()

    new CustomerIoTelemetryProvider()
    await vi.waitFor(() => expect(hoisted.customerIoLoad).toHaveBeenCalled())
    expect(hoisted.customerIoLoad).toHaveBeenCalledWith(
      { writeKey: 'cdp_test_write_key' },
      {
        integrations: {
          'Customer.io In-App Plugin': { enabled: false }
        }
      }
    )
    await flushMicrotasks()
    expect(hoisted.onUserResolved).not.toHaveBeenCalled()

    markStoresReady()
    await vi.waitFor(() => expect(hoisted.onUserResolved).toHaveBeenCalled())
  })

  it('keeps Customer.io startup events in order across the gate', async () => {
    configureCustomerIo()

    const provider = new CustomerIoTelemetryProvider()
    provider.trackWorkflowExecution()

    await vi.waitFor(() => expect(hoisted.customerIoLoad).toHaveBeenCalled())
    await flushMicrotasks()
    provider.trackAddApiCreditButtonClicked()

    markStoresReady()
    await vi.waitFor(() =>
      expect(hoisted.customerIoTrack).toHaveBeenCalledTimes(2)
    )
    expect(hoisted.customerIoTrack.mock.calls.map(([event]) => event)).toEqual([
      TelemetryEvents.EXECUTION_START,
      TelemetryEvents.ADD_API_CREDIT_BUTTON_CLICKED
    ])
  })
})
