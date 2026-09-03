import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as VueModule from 'vue'

const hoisted = vi.hoisted(() => {
  const customerIoTrack = vi.fn(
    (_event: string, _properties?: Record<string, unknown>) => Promise.resolve()
  )
  const customerIoRegistration: { rejection: Error | null } = {
    rejection: null
  }
  const userEmail: { value: string | null } = { value: null }
  const resolvedUserInfo: { value: { id: string } | null } = { value: null }

  return {
    onUserResolved: vi.fn(),
    onUserLogout: vi.fn(),
    userEmail,
    resolvedUserInfo,
    reportError: vi.fn(),
    posthogInit: vi.fn(),
    mixpanelInit: vi.fn(
      (_token: string, _options: { loaded: () => void }) => {}
    ),
    customerIoTrack,
    customerIoRegistration,
    customerIoLoad: vi.fn(() => ({
      identify: vi.fn(() => Promise.resolve()),
      page: vi.fn(),
      track: customerIoTrack,
      reset: vi.fn(),
      register: vi.fn(() =>
        customerIoRegistration.rejection
          ? Promise.reject(customerIoRegistration.rejection)
          : Promise.resolve()
      )
    }))
  }
})

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: hoisted.reportError
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    userEmail: hoisted.userEmail,
    resolvedUserInfo: hoisted.resolvedUserInfo,
    onUserResolved: hoisted.onUserResolved,
    onUserLogout: hoisted.onUserLogout
  })
}))

vi.mock('posthog-js', () => ({
  default: {
    init: hoisted.posthogInit,
    capture: vi.fn(),
    identify: vi.fn(),
    register: vi.fn(),
    people: { set: vi.fn(), set_once: vi.fn() },
    reset: vi.fn()
  }
}))

vi.mock('mixpanel-browser', () => ({
  default: {
    init: hoisted.mixpanelInit,
    track: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    people: { set: vi.fn() }
  }
}))

vi.mock('@customerio/cdp-analytics-browser', () => ({
  AnalyticsBrowser: { load: hoisted.customerIoLoad },
  InAppPlugin: vi.fn(() => ({ name: 'Customer.io In-App Plugin' }))
}))

vi.mock('@/platform/remoteConfig/remoteConfig', async () => {
  const { ref } = await vi.importActual<typeof VueModule>('vue')
  return { remoteConfig: ref(null) }
})

vi.mock('@/composables/billing/useBillingContext', async () => {
  const { ref } = await vi.importActual<typeof VueModule>('vue')
  return { useBillingContext: () => ({ tier: ref(null) }) }
})

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
    setActivePinia(undefined)
    markStoresPending()
  })

  afterEach(() => {
    markStoresReady()
    hoisted.customerIoRegistration.rejection = null
    hoisted.reportError.mockClear()
    delete (window as { __CONFIG__?: unknown }).__CONFIG__
  })

  function configureCustomerIo(): void {
    window.__CONFIG__ = {
      customer_io: { write_key: 'cdp_test_write_key', site_id: 'site_test' }
    } as typeof window.__CONFIG__
  }

  it('gates PostHog user identification', async () => {
    window.__CONFIG__ = {
      posthog_project_token: 'phc_test_token'
    } as typeof window.__CONFIG__

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
    } as typeof window.__CONFIG__

    new MixpanelTelemetryProvider()
    await vi.waitFor(() => expect(hoisted.mixpanelInit).toHaveBeenCalled())
    const [, options] = hoisted.mixpanelInit.mock.calls[0]
    options.loaded()
    await flushMicrotasks()
    expect(hoisted.onUserResolved).not.toHaveBeenCalled()

    markStoresReady()
    await vi.waitFor(() => expect(hoisted.onUserResolved).toHaveBeenCalled())
  })

  it('gates Customer.io user identification', async () => {
    configureCustomerIo()

    new CustomerIoTelemetryProvider()
    await vi.waitFor(() => expect(hoisted.customerIoLoad).toHaveBeenCalled())
    await flushMicrotasks()
    expect(hoisted.onUserResolved).not.toHaveBeenCalled()

    markStoresReady()
    await vi.waitFor(() => expect(hoisted.onUserResolved).toHaveBeenCalled())
  })

  it('handles a Customer.io in-app registration failure raised while the gate is still closed', async () => {
    const registrationError = new Error('in-app registration failed')
    hoisted.customerIoRegistration.rejection = registrationError
    configureCustomerIo()

    new CustomerIoTelemetryProvider()
    await vi.waitFor(() => expect(hoisted.customerIoLoad).toHaveBeenCalled())
    await flushMicrotasks()

    expect(hoisted.onUserResolved).not.toHaveBeenCalled()
    expect(hoisted.reportError).toHaveBeenCalledWith(registrationError, {
      errorType: 'customerio_in_app_plugin_registration_failure'
    })
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
