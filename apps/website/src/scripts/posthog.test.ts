// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as PostHogModule from 'posthog-js'

import {
  AUTH_TELEMETRY_EVENT,
  SESSION_TELEMETRY_EVENT
} from '@comfyorg/account/telemetry'

const hoisted = vi.hoisted(() => ({
  mockInit: vi.fn(),
  mockCapture: vi.fn(),
  mockOnFeatureFlags: vi.fn<typeof PostHogModule.default.onFeatureFlags>(),
  mockIsFeatureEnabled: vi.fn(),
  mockGetFeatureFlag: vi.fn(),
  mockIdentify: vi.fn(),
  mockReset: vi.fn(),
  mockGetProperty: vi.fn(),
  mockReloadFeatureFlags: vi.fn()
}))

type PostHogMock = Pick<
  typeof PostHogModule.default,
  | 'init'
  | 'capture'
  | 'onFeatureFlags'
  | 'isFeatureEnabled'
  | 'getFeatureFlag'
  | 'identify'
  | 'reset'
  | 'get_property'
  | 'reloadFeatureFlags'
>

const postHogMock = {
  init: hoisted.mockInit,
  capture: hoisted.mockCapture,
  onFeatureFlags: hoisted.mockOnFeatureFlags,
  isFeatureEnabled: hoisted.mockIsFeatureEnabled,
  getFeatureFlag: hoisted.mockGetFeatureFlag,
  identify: hoisted.mockIdentify,
  reset: hoisted.mockReset,
  get_property: hoisted.mockGetProperty,
  reloadFeatureFlags: hoisted.mockReloadFeatureFlags
} satisfies PostHogMock

// The real default export carries 130+ members, so only the boundary handoff
// is asserted; the shape itself is checked against PostHogMock above.
vi.mock(import('posthog-js'), () => ({
  default: postHogMock as unknown as typeof PostHogModule.default
}))

/** Fire the callback PostHog registered with onFeatureFlags. */
function emitFeatureFlags(errorsLoading = false) {
  const cb = hoisted.mockOnFeatureFlags.mock.calls.at(-1)?.[0]
  cb?.([], {}, { errorsLoading })
}

describe('Workshop visibility', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('requires an explicit enable and responds to remote disable and load failures', async () => {
    const { initPostHog, useWorkshopEnabled } = await import('./posthog')
    const enabled = useWorkshopEnabled()
    initPostHog()
    expect(enabled.value).toBe(false)

    for (const answer of [undefined, false, 'true', true, false, true]) {
      hoisted.mockIsFeatureEnabled.mockImplementation((key) =>
        key === 'workshop-enabled' ? answer : true
      )
      emitFeatureFlags()
      expect(enabled.value).toBe(answer === true)
    }
    emitFeatureFlags(true)
    expect(enabled.value).toBe(false)
  })

  it('does not let preview auth or production visibility overrides bypass PostHog', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('PUBLIC_WORKSHOP_AUTH_FLAG', '1')
    vi.stubEnv('PUBLIC_WORKSHOP_ENABLED', '1')
    const { initPostHog, useWorkshopEnabled } = await import('./posthog')
    initPostHog()
    emitFeatureFlags()
    expect(useWorkshopEnabled().value).toBe(false)
  })

  it('allows local development to preview the feature without PostHog', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('PUBLIC_WORKSHOP_ENABLED', '1')
    const { useWorkshopEnabled } = await import('./posthog')
    expect(useWorkshopEnabled().value).toBe(true)
  })

  it('identifies staff by UID and hides the feature while reevaluating another user or sign-out', async () => {
    const { initPostHog, identifyWorkshopUser, useWorkshopEnabled } =
      await import('./posthog')
    identifyWorkshopUser('staff-uid')
    initPostHog()
    expect(hoisted.mockIdentify).toHaveBeenCalledWith('staff-uid')
    hoisted.mockIsFeatureEnabled.mockReturnValue(true)
    emitFeatureFlags()
    expect(useWorkshopEnabled().value).toBe(true)

    identifyWorkshopUser('staff-uid')
    expect(hoisted.mockIdentify).toHaveBeenCalledOnce()
    expect(useWorkshopEnabled().value).toBe(true)

    identifyWorkshopUser('another-uid')
    expect(useWorkshopEnabled().value).toBe(false)
    emitFeatureFlags()
    identifyWorkshopUser(null)
    expect(useWorkshopEnabled().value).toBe(false)
    expect(hoisted.mockReset).toHaveBeenCalledOnce()
    expect(hoisted.mockReloadFeatureFlags).toHaveBeenCalledTimes(3)
  })

  it('preserves anonymous identity across page loads and resets a restored signed-out identity', async () => {
    const { initPostHog, identifyWorkshopUser } = await import('./posthog')
    initPostHog()
    identifyWorkshopUser(null)
    expect(hoisted.mockReset).not.toHaveBeenCalled()

    vi.resetModules()
    hoisted.mockGetProperty.mockReturnValue('previous-user')
    const restored = await import('./posthog')
    restored.initPostHog()
    restored.identifyWorkshopUser(null)
    expect(hoisted.mockReset).toHaveBeenCalledOnce()
  })
})

describe('initPostHog', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('passes a before_send hook to posthog.init that strips PII end-to-end', async () => {
    const { initPostHog } = await import('./posthog')
    initPostHog()

    expect(hoisted.mockInit).toHaveBeenCalledOnce()
    const initOptions = hoisted.mockInit.mock.calls[0][1]
    expect(initOptions.person_profiles).toBe('identified_only')
    expect(typeof initOptions.before_send).toBe('function')

    const event = {
      properties: {
        email: 'a@example.com',
        prompt: 'hello',
        user_email: 'b@example.com',
        $email: 'c@example.com',
        method: 'google'
      },
      $set: { email: 'd@example.com', name: 'keep me' },
      $set_once: { $email: 'e@example.com', plan: 'free' }
    }

    const result = initOptions.before_send(event)

    expect(result.properties).not.toHaveProperty('email')
    expect(result.properties).not.toHaveProperty('prompt')
    expect(result.properties).not.toHaveProperty('user_email')
    expect(result.properties).not.toHaveProperty('$email')
    expect(result.properties).toHaveProperty('method', 'google')
    expect(result.$set).not.toHaveProperty('email')
    expect(result.$set).toHaveProperty('name', 'keep me')
    expect(result.$set_once).not.toHaveProperty('$email')
    expect(result.$set_once).toHaveProperty('plan', 'free')
  })
})

describe('capturePageview', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('captures the pageview event with no properties', async () => {
    const { initPostHog, capturePageview } = await import('./posthog')
    initPostHog()
    capturePageview()

    expect(hoisted.mockCapture).toHaveBeenCalledOnce()
    expect(hoisted.mockCapture.mock.calls[0][0]).toBe('$pageview')
  })
})

describe('captureDownloadClick', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('captures the download event with the platform', async () => {
    const { initPostHog, captureDownloadClick } = await import('./posthog')
    initPostHog()
    captureDownloadClick('mac')

    expect(hoisted.mockCapture).toHaveBeenCalledWith(
      'website:download_button_clicked',
      { platform: 'mac' }
    )
  })

  it('does not capture before PostHog is initialized', async () => {
    const { captureDownloadClick } = await import('./posthog')
    captureDownloadClick('windows')

    expect(hoisted.mockCapture).not.toHaveBeenCalled()
  })
})

describe('captureCliConnectionTabClick', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('captures the tab click with the connection id', async () => {
    const { initPostHog, captureCliConnectionTabClick } =
      await import('./posthog')
    initPostHog()
    captureCliConnectionTabClick('cloud')

    expect(hoisted.mockCapture).toHaveBeenCalledWith(
      'website:cli_connection_tab_clicked',
      { connection: 'cloud' }
    )
  })

  it('does not capture before PostHog is initialized', async () => {
    const { captureCliConnectionTabClick } = await import('./posthog')
    captureCliConnectionTabClick('local')

    expect(hoisted.mockCapture).not.toHaveBeenCalled()
  })
})

describe('captureCliClientTabClick', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('captures the tab click with the client id', async () => {
    const { initPostHog, captureCliClientTabClick } = await import('./posthog')
    initPostHog()
    captureCliClientTabClick('claude-code')

    expect(hoisted.mockCapture).toHaveBeenCalledWith(
      'website:cli_client_tab_clicked',
      { client: 'claude-code' }
    )
  })

  it('does not capture before PostHog is initialized', async () => {
    const { captureCliClientTabClick } = await import('./posthog')
    captureCliClientTabClick('cursor')

    expect(hoisted.mockCapture).not.toHaveBeenCalled()
  })
})

describe('captureMcpClientTabClick', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('captures the tab click with the client id', async () => {
    const { initPostHog, captureMcpClientTabClick } = await import('./posthog')
    initPostHog()
    captureMcpClientTabClick('claude-code')

    expect(hoisted.mockCapture).toHaveBeenCalledWith(
      'website:mcp_client_tab_clicked',
      { client: 'claude-code' }
    )
  })

  it('does not capture before PostHog is initialized', async () => {
    const { captureMcpClientTabClick } = await import('./posthog')
    captureMcpClientTabClick('cursor')

    expect(hoisted.mockCapture).not.toHaveBeenCalled()
  })
})

describe('useWorkshopAuthFlag', () => {
  beforeEach(() => {
    vi.resetModules()
    hoisted.mockOnFeatureFlags.mockReset()
    hoisted.mockIsFeatureEnabled.mockReset()
  })

  it('is off until PostHog answers, then tracks the flag in both directions', async () => {
    hoisted.mockIsFeatureEnabled.mockReturnValue(true)
    const { initPostHog, useWorkshopAuthFlag } = await import('./posthog')
    const enabled = useWorkshopAuthFlag()

    expect(enabled.value, 'off until PostHog answers').toBe(false)

    initPostHog()
    emitFeatureFlags()
    expect(enabled.value).toBe(true)

    // The flag being turned off remotely must actually take the surface down.
    hoisted.mockIsFeatureEnabled.mockReturnValue(false)
    emitFeatureFlags()
    expect(enabled.value, 'a remote disable must not be a one-way latch').toBe(
      false
    )
  })

  it('reports settled only once PostHog has answered, whichever way', async () => {
    hoisted.mockIsFeatureEnabled.mockReturnValue(false)
    const { initPostHog, useWorkshopAuthFlag, useWorkshopAuthFlagSettled } =
      await import('./posthog')
    const settled = useWorkshopAuthFlagSettled()

    initPostHog()
    expect(settled.value, 'an unanswered flag is not a "no"').toBe(false)

    emitFeatureFlags()
    expect(settled.value).toBe(true)
    expect(useWorkshopAuthFlag().value).toBe(false)
  })

  it('counts the build override as an answer', async () => {
    vi.stubEnv('PUBLIC_WORKSHOP_AUTH_FLAG', '1')
    const { useWorkshopAuthFlagSettled } = await import('./posthog')

    expect(useWorkshopAuthFlagSettled().value).toBe(true)
  })

  it('honors the build override and keeps it sticky against a remote disable', async () => {
    vi.stubEnv('PUBLIC_WORKSHOP_AUTH_FLAG', '1')
    hoisted.mockIsFeatureEnabled.mockReturnValue(false)
    const { initPostHog, useWorkshopAuthFlag } = await import('./posthog')
    const enabled = useWorkshopAuthFlag()

    expect(enabled.value, 'override forces on with no PostHog').toBe(true)

    initPostHog()
    emitFeatureFlags()
    expect(
      enabled.value,
      'an override-on build ignores PostHog turning the flag off'
    ).toBe(true)
  })
})

describe('useWorkshopTurnstileMode', () => {
  beforeEach(() => {
    vi.resetModules()
    hoisted.mockOnFeatureFlags.mockReset()
    hoisted.mockGetFeatureFlag.mockReset()
  })

  it('defaults off and accepts only known remote variants', async () => {
    hoisted.mockGetFeatureFlag.mockReturnValue('shadow')
    const { initPostHog, useWorkshopTurnstileMode } = await import('./posthog')
    const mode = useWorkshopTurnstileMode()

    expect(mode.value).toBe('off')
    initPostHog()
    emitFeatureFlags()
    expect(mode.value).toBe('shadow')

    hoisted.mockGetFeatureFlag.mockReturnValue('typo')
    emitFeatureFlags()
    expect(mode.value, 'unknown remote variants fail closed').toBe('off')
  })

  it('honors a valid build override against remote changes', async () => {
    vi.stubEnv('PUBLIC_WORKSHOP_TURNSTILE_MODE', 'enforce')
    hoisted.mockGetFeatureFlag.mockReturnValue('off')
    const { initPostHog, useWorkshopTurnstileMode } = await import('./posthog')
    const mode = useWorkshopTurnstileMode()

    initPostHog()
    emitFeatureFlags()
    expect(mode.value).toBe('enforce')
  })
})

describe('shared auth telemetry events', () => {
  beforeEach(() => {
    vi.resetModules()
    hoisted.mockCapture.mockClear()
  })

  it("reports refresh outcomes under the package's shared event names", async () => {
    const {
      initPostHog,
      captureAuthRefreshSucceeded,
      captureAuthRefreshFailed
    } = await import('./posthog')
    initPostHog()

    captureAuthRefreshSucceeded()
    captureAuthRefreshFailed('retry_scheduled')

    expect(hoisted.mockCapture).toHaveBeenCalledWith(
      SESSION_TELEMETRY_EVENT.refreshSucceeded,
      { outcome: 'succeeded' }
    )
    expect(hoisted.mockCapture).toHaveBeenCalledWith(
      SESSION_TELEMETRY_EVENT.refreshFailed,
      { outcome: 'retry_scheduled' }
    )
  })

  it("reports sign-up opens and auth failures under the cloud app's event names", async () => {
    const {
      initPostHog,
      captureSignupOpened,
      captureAuthCompleted,
      captureAuthFailed
    } = await import('./posthog')
    initPostHog()

    captureSignupOpened()
    captureAuthCompleted({
      method: 'google',
      is_new_user: false,
      user_id: 'uid-1',
      email: 'a@b.co'
    })
    captureAuthFailed({
      error_code: 'auth/popup-closed-by-user',
      auth_action: 'google_sign_in'
    })

    expect(hoisted.mockCapture).toHaveBeenCalledWith(
      AUTH_TELEMETRY_EVENT.signUpOpened,
      undefined
    )
    expect(hoisted.mockCapture).toHaveBeenCalledWith(
      AUTH_TELEMETRY_EVENT.authCompleted,
      {
        method: 'google',
        is_new_user: false,
        user_id: 'uid-1',
        email: 'a@b.co'
      }
    )
    expect(hoisted.mockCapture).toHaveBeenCalledWith(
      AUTH_TELEMETRY_EVENT.authFailed,
      { error_code: 'auth/popup-closed-by-user', auth_action: 'google_sign_in' }
    )
  })
})
