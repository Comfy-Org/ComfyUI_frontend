import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as VueModule from 'vue'

import type * as ThirdPartyLoadFailureModule from '@/platform/telemetry/thirdPartyLoadFailure'

const hoisted = vi.hoisted(() => ({
  reportThirdPartyLoadFailure: vi.fn()
}))

/**
 * Every SDK this file touches fails to load, the way a blocked request does.
 * The providers import them dynamically, so the rejection lands in the
 * load-failure branch rather than at module evaluation.
 */
vi.mock('posthog-js', () => Promise.reject(new TypeError('blocked')))
vi.mock('mixpanel-browser', () => Promise.reject(new TypeError('blocked')))
vi.mock('@customerio/cdp-analytics-browser', () =>
  Promise.reject(new TypeError('blocked'))
)

vi.mock(
  '@/platform/telemetry/thirdPartyLoadFailure',
  async (importOriginal) => ({
    ...(await importOriginal<typeof ThirdPartyLoadFailureModule>()),
    reportThirdPartyLoadFailure: hoisted.reportThirdPartyLoadFailure
  })
)

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    userEmail: { value: null },
    resolvedUserInfo: { value: null },
    onUserResolved: vi.fn(),
    onUserLogout: vi.fn()
  })
}))

vi.mock('@/platform/remoteConfig/remoteConfig', async () => {
  const { ref } = await vi.importActual<typeof VueModule>('vue')
  return { remoteConfig: ref(null) }
})

vi.mock('@/composables/billing/useBillingContext', async () => {
  const { ref } = await vi.importActual<typeof VueModule>('vue')
  return { useBillingContext: () => ({ tier: ref(null) }) }
})

import { CustomerIoTelemetryProvider } from './CustomerIoTelemetryProvider'
import { MixpanelTelemetryProvider } from './MixpanelTelemetryProvider'
import { PostHogTelemetryProvider } from './PostHogTelemetryProvider'

/**
 * An SDK that never loads is a request the client refused to make, not a defect
 * we shipped, so each provider routes it to `reportThirdPartyLoadFailure` —
 * which downgrades a client-side block to a warning — instead of the
 * unconditional `console.error` that used to make every blocker look like a
 * product error.
 */
describe('telemetry providers report a failed SDK load as a load failure', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete (window as { __CONFIG__?: unknown }).__CONFIG__
  })

  it('routes a blocked PostHog SDK away from the error path', async () => {
    window.__CONFIG__ = {
      posthog_project_token: 'phc_test_token'
    } as typeof window.__CONFIG__

    new PostHogTelemetryProvider()

    await vi.waitFor(() =>
      expect(hoisted.reportThirdPartyLoadFailure).toHaveBeenCalledWith(
        'PostHog',
        expect.any(Error)
      )
    )
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('routes a blocked Mixpanel SDK away from the error path', async () => {
    window.__CONFIG__ = {
      mixpanel_token: 'mp_test_token'
    } as typeof window.__CONFIG__

    new MixpanelTelemetryProvider()

    await vi.waitFor(() =>
      expect(hoisted.reportThirdPartyLoadFailure).toHaveBeenCalledWith(
        'Mixpanel',
        expect.any(Error)
      )
    )
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('routes a blocked Customer.io SDK away from the error path', async () => {
    window.__CONFIG__ = {
      customer_io: { write_key: 'cdp_test_write_key', site_id: 'site_test' }
    } as typeof window.__CONFIG__

    new CustomerIoTelemetryProvider()

    await vi.waitFor(() =>
      expect(hoisted.reportThirdPartyLoadFailure).toHaveBeenCalledWith(
        'Customer.io',
        expect.any(Error)
      )
    )
    expect(consoleError).not.toHaveBeenCalled()
  })
})
