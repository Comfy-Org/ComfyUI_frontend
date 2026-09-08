// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  mockInit: vi.fn(),
  mockCapture: vi.fn(),
  mockOnFeatureFlags: vi.fn(),
  mockIsFeatureEnabled: vi.fn(),
  mockGetFeatureFlag: vi.fn()
}))

vi.mock('posthog-js', () => ({
  default: {
    init: hoisted.mockInit,
    capture: hoisted.mockCapture,
    onFeatureFlags: hoisted.mockOnFeatureFlags,
    isFeatureEnabled: hoisted.mockIsFeatureEnabled,
    getFeatureFlag: hoisted.mockGetFeatureFlag
  }
}))

/** Fire the callback PostHog registered with onFeatureFlags. */
function emitFeatureFlags() {
  const cb = hoisted.mockOnFeatureFlags.mock.calls.at(-1)?.[0] as
    | (() => void)
    | undefined
  cb?.()
}

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
