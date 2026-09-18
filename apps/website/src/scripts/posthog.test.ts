import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as PostHogModule from 'posthog-js'

import {
  AUTH_TELEMETRY_EVENT,
  SESSION_TELEMETRY_EVENT
} from '@comfyorg/account-core/telemetry'

const hoisted = vi.hoisted(() => ({
  localDev: false,
  deployEnv: '',
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

vi.mock(import('astro:env/client'), () => ({
  get WORKSHOP_LOCAL_DEV() {
    return hoisted.localDev
  },
  get WORKSHOP_DEPLOY_ENV() {
    return hoisted.deployEnv
  }
}))

beforeEach(() => {
  hoisted.localDev = false
  hoisted.deployEnv = ''
})

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
  posthog: fromPartial<typeof PostHogModule.posthog>(postHogMock)
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

  it('requires an explicit enable and keeps the last answer through load failures', async () => {
    const { initPostHog, useWorkshopEnabled } = await import('./posthog')
    const enabled = useWorkshopEnabled()
    initPostHog()
    expect(enabled.value).toBe(false)
    emitFeatureFlags(true)
    expect(enabled.value).toBe(false)

    for (const answer of [undefined, false, 'true', true, false, true]) {
      hoisted.mockIsFeatureEnabled.mockImplementation((key) =>
        key === 'workshop-enabled' ? answer : true
      )
      emitFeatureFlags()
      expect(enabled.value).toBe(answer === true)
    }
    emitFeatureFlags(true)
    expect(enabled.value).toBe(true)
  })

  it('does not let preview auth or production visibility overrides bypass PostHog', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('PUBLIC_WORKSHOP_AUTH_FLAG', '1')
    vi.stubEnv('PUBLIC_WORKSHOP_ENABLED', '1')
    const { initPostHog, useWorkshopEnabled } = await import('./posthog')
    initPostHog()
    emitFeatureFlags()
    expect(useWorkshopEnabled().value).toBe(false)
  })

  it('allows local development to preview the feature without PostHog', async () => {
    hoisted.localDev = true
    vi.stubEnv('PUBLIC_WORKSHOP_ENABLED', '1')
    const { useWorkshopEnabled } = await import('./posthog')
    expect(useWorkshopEnabled().value).toBe(true)
  })

  it('identifies staff by UID and hides the feature while reevaluating another user or sign-out', async () => {
    const { initPostHog, identifyWorkshopUser, useWorkshopEnabled } =
      await import('./posthog')
    identifyWorkshopUser({ uid: 'staff-uid' })
    initPostHog()
    expect(hoisted.mockIdentify).toHaveBeenCalledWith('staff-uid')
    hoisted.mockIsFeatureEnabled.mockReturnValue(true)
    emitFeatureFlags()
    expect(useWorkshopEnabled().value).toBe(true)

    identifyWorkshopUser({ uid: 'staff-uid' })
    expect(hoisted.mockIdentify).toHaveBeenCalledOnce()
    expect(useWorkshopEnabled().value).toBe(true)

    identifyWorkshopUser({ uid: 'another-uid' })
    expect(useWorkshopEnabled().value).toBe(false)
    emitFeatureFlags()
    identifyWorkshopUser(null)
    expect(useWorkshopEnabled().value).toBe(false)
    expect(hoisted.mockReset).toHaveBeenCalledTimes(2)
    expect(hoisted.mockReloadFeatureFlags).toHaveBeenCalledTimes(3)
  })

  it('marks verified staff with a boolean and never sends the email', async () => {
    const { initPostHog, identifyWorkshopUser } = await import('./posthog')
    initPostHog()
    identifyWorkshopUser({
      uid: 'staff-uid',
      email: 'Someone@Comfy.org',
      emailVerified: true
    })
    expect(hoisted.mockIdentify).toHaveBeenCalledWith('staff-uid', {
      comfy_staff: true
    })
  })

  it.for([
    { uid: 'unverified', email: 'someone@comfy.org', emailVerified: false },
    { uid: 'external', email: 'someone@example.com', emailVerified: true },
    { uid: 'no-email', email: null, emailVerified: true }
  ])('sends nothing beyond the UID for $uid', async (user) => {
    const { initPostHog, identifyWorkshopUser } = await import('./posthog')
    initPostHog()
    identifyWorkshopUser(user)
    expect(hoisted.mockIdentify).toHaveBeenCalledExactlyOnceWith(user.uid)
  })

  it('seeds cached access before Firebase resolves so a returning user can bootstrap the session', async () => {
    hoisted.mockGetProperty.mockReturnValue('staff-uid')
    hoisted.mockIsFeatureEnabled.mockReturnValue(true)
    const { initPostHog, useWorkshopEnabled, useWorkshopEnabledSettled } =
      await import('./posthog')
    initPostHog()
    expect(useWorkshopEnabled().value).toBe(true)
    expect(useWorkshopEnabledSettled().value).toBe(true)
    expect(hoisted.mockIsFeatureEnabled).toHaveBeenCalledWith(
      'workshop-enabled',
      { send_event: false }
    )
  })

  it('waits for a fresh flag answer when a verified staff identity changes', async () => {
    const {
      initPostHog,
      identifyWorkshopUser,
      useWorkshopEnabled,
      useWorkshopEnabledSettled
    } = await import('./posthog')
    initPostHog()
    identifyWorkshopUser({
      uid: 'staff-uid',
      email: 'someone@comfy.org',
      emailVerified: true
    })
    expect(useWorkshopEnabled().value).toBe(false)
    expect(useWorkshopEnabledSettled().value).toBe(false)

    hoisted.mockIsFeatureEnabled.mockReturnValue(true)
    emitFeatureFlags()
    expect(useWorkshopEnabled().value).toBe(true)
    expect(useWorkshopEnabledSettled().value).toBe(true)
  })

  it('honors a public rollout answer for an external identity', async () => {
    const {
      initPostHog,
      identifyWorkshopUser,
      useWorkshopEnabled,
      useWorkshopEnabledSettled
    } = await import('./posthog')
    initPostHog()
    identifyWorkshopUser({
      uid: 'external-uid',
      email: 'someone@example.com',
      emailVerified: true
    })
    expect(useWorkshopEnabledSettled().value).toBe(false)

    hoisted.mockIsFeatureEnabled.mockReturnValue(true)
    emitFeatureFlags()
    expect(useWorkshopEnabled().value).toBe(true)
    expect(useWorkshopEnabledSettled().value).toBe(true)
  })

  it('waits for a fresh answer when the persisted identity has no cached flag', async () => {
    hoisted.mockGetProperty.mockReturnValue('external-uid')
    const { initPostHog, identifyWorkshopUser, useWorkshopEnabledSettled } =
      await import('./posthog')
    initPostHog()
    identifyWorkshopUser({ uid: 'external-uid' })

    expect(useWorkshopEnabledSettled().value).toBe(false)
    expect(hoisted.mockReloadFeatureFlags).toHaveBeenCalledOnce()

    hoisted.mockIsFeatureEnabled.mockReturnValue(true)
    emitFeatureFlags()
    expect(useWorkshopEnabledSettled().value).toBe(true)
  })

  it('never carries a grant across identities, even when the reload fails', async () => {
    const {
      initPostHog,
      identifyWorkshopUser,
      useWorkshopEnabled,
      useWorkshopEnabledSettled
    } = await import('./posthog')
    initPostHog()
    identifyWorkshopUser({ uid: 'staff-uid' })
    hoisted.mockIsFeatureEnabled.mockReturnValue(true)
    emitFeatureFlags()
    expect(useWorkshopEnabled().value).toBe(true)

    identifyWorkshopUser({
      uid: 'another-uid',
      email: 'another@comfy.org',
      emailVerified: true
    })
    expect(useWorkshopEnabledSettled().value).toBe(false)
    emitFeatureFlags(true)
    expect(useWorkshopEnabled().value).toBe(false)
    expect(useWorkshopEnabledSettled().value).toBe(true)
  })

  it('keeps confirmed access when Firebase restores the same PostHog user', async () => {
    hoisted.mockGetProperty.mockReturnValue('staff-uid')
    hoisted.mockIsFeatureEnabled.mockReturnValue(true)
    const { initPostHog, identifyWorkshopUser, useWorkshopEnabled } =
      await import('./posthog')
    initPostHog()
    emitFeatureFlags()
    identifyWorkshopUser({ uid: 'staff-uid' })
    expect(useWorkshopEnabled().value).toBe(true)
    expect(hoisted.mockIdentify).not.toHaveBeenCalled()
    expect(hoisted.mockReloadFeatureFlags).not.toHaveBeenCalled()
  })

  it.for(['identify', 'reset'] as const)(
    'retries a failed %s transition without restoring the old access',
    async (operation) => {
      const { initPostHog, identifyWorkshopUser, useWorkshopEnabled } =
        await import('./posthog')
      initPostHog()
      identifyWorkshopUser({ uid: 'staff-uid' })
      hoisted.mockIsFeatureEnabled.mockReturnValue(true)
      emitFeatureFlags()
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const call =
        operation === 'identify' ? hoisted.mockIdentify : hoisted.mockReset
      call.mockImplementationOnce(() => {
        throw new Error('Unavailable')
      })
      const user = operation === 'identify' ? { uid: 'another-uid' } : null
      identifyWorkshopUser(user)
      expect(useWorkshopEnabled().value).toBe(false)
      const attempts = call.mock.calls.length
      identifyWorkshopUser(user)
      expect(call).toHaveBeenCalledTimes(attempts + 1)
      emitFeatureFlags(true)
      expect(useWorkshopEnabled().value).toBe(false)
    }
  )

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

describe('workshop-enabled settles only on an observed answer', () => {
  beforeEach(() => {
    vi.resetModules()
    hoisted.mockGetProperty.mockReturnValue(undefined)
    hoisted.mockIsFeatureEnabled.mockReturnValue(undefined)
  })

  it('settles to the public site when PostHog never initializes', async () => {
    const { useWorkshopEnabledSettled, useWorkshopEnabled } =
      await import('./posthog')
    expect(useWorkshopEnabledSettled().value).toBe(true)
    expect(useWorkshopEnabled().value).toBe(false)
  })

  it('an identity arriving before init does not strand the gate', async () => {
    const { identifyWorkshopUser, useWorkshopEnabledSettled } =
      await import('./posthog')
    identifyWorkshopUser({ uid: 'x' })
    expect(useWorkshopEnabledSettled().value).toBe(true)
  })

  it('is settled at load under the local dev override', async () => {
    hoisted.localDev = true
    vi.stubEnv('PUBLIC_WORKSHOP_ENABLED', '1')
    const { useWorkshopEnabledSettled, useWorkshopEnabled } =
      await import('./posthog')
    expect(useWorkshopEnabledSettled().value).toBe(true)
    expect(useWorkshopEnabled().value).toBe(true)
  })

  it('stays unsettled through init until a flag answer arrives', async () => {
    const { initPostHog, useWorkshopEnabledSettled } = await import('./posthog')
    initPostHog()
    expect(useWorkshopEnabledSettled().value).toBe(false)
    hoisted.mockIsFeatureEnabled.mockReturnValue(false)
    emitFeatureFlags()
    expect(useWorkshopEnabledSettled().value).toBe(true)
  })

  it('settles to the persisted answer synchronously on a warm load', async () => {
    hoisted.mockIsFeatureEnabled.mockReturnValue(false)
    const { initPostHog, useWorkshopEnabledSettled, useWorkshopEnabled } =
      await import('./posthog')
    initPostHog()
    expect(useWorkshopEnabledSettled().value).toBe(true)
    expect(useWorkshopEnabled().value).toBe(false)
  })

  it('settles after a timeout when PostHog never answers', async () => {
    vi.useFakeTimers()
    const { initPostHog, useWorkshopEnabledSettled } = await import('./posthog')
    initPostHog()
    expect(useWorkshopEnabledSettled().value).toBe(false)
    await vi.advanceTimersByTimeAsync(3000)
    expect(useWorkshopEnabledSettled().value).toBe(true)
    vi.useRealTimers()
  })

  it('settles when the flag load errors', async () => {
    const { initPostHog, useWorkshopEnabledSettled } = await import('./posthog')
    initPostHog()
    emitFeatureFlags(true)
    expect(useWorkshopEnabledSettled().value).toBe(true)
  })

  it('does not churn state when the timeout fires after a real answer', async () => {
    vi.useFakeTimers()
    hoisted.mockIsFeatureEnabled.mockReturnValue(true)
    const { initPostHog, useWorkshopEnabled, useWorkshopEnabledSettled } =
      await import('./posthog')
    initPostHog()
    emitFeatureFlags()
    expect(useWorkshopEnabled().value).toBe(true)
    expect(useWorkshopEnabledSettled().value).toBe(true)
    await vi.advanceTimersByTimeAsync(3000)
    expect(useWorkshopEnabled().value).toBe(true)
    expect(useWorkshopEnabledSettled().value).toBe(true)
    vi.useRealTimers()
  })

  it('re-arms the timeout when an identity reload leaves visibility pending', async () => {
    vi.useFakeTimers()
    hoisted.mockGetProperty.mockReturnValue('staff-uid')
    const { initPostHog, identifyWorkshopUser, useWorkshopEnabledSettled } =
      await import('./posthog')
    initPostHog()
    emitFeatureFlags()
    expect(useWorkshopEnabledSettled().value).toBe(true)

    hoisted.mockIsFeatureEnabled.mockReturnValue(undefined)
    identifyWorkshopUser({ uid: 'staff-uid' })
    expect(useWorkshopEnabledSettled().value).toBe(false)
    await vi.advanceTimersByTimeAsync(3000)
    expect(useWorkshopEnabledSettled().value).toBe(true)
    vi.useRealTimers()
  })

  it('drops a stale grant when a same-identity reload times out', async () => {
    vi.useFakeTimers()
    hoisted.mockGetProperty.mockReturnValue('staff-uid')
    hoisted.mockIsFeatureEnabled.mockReturnValue(true)
    const {
      initPostHog,
      identifyWorkshopUser,
      useWorkshopEnabled,
      useWorkshopEnabledSettled
    } = await import('./posthog')
    initPostHog()
    emitFeatureFlags()
    expect(useWorkshopEnabled().value).toBe(true)

    hoisted.mockIsFeatureEnabled.mockReturnValue(undefined)
    identifyWorkshopUser({ uid: 'staff-uid' })
    expect(useWorkshopEnabled().value).toBe(false)
    await vi.advanceTimersByTimeAsync(3000)
    expect(useWorkshopEnabledSettled().value).toBe(true)
    expect(useWorkshopEnabled().value).toBe(false)
    vi.useRealTimers()
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

describe('Workshop analytics transport', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('sends sanitized run exceptions through the initialized website stream', async () => {
    const { initPostHog, captureWorkshopEvent } = await import('./posthog')
    const { workshopFailureAnalytics } = await import('./workshop-analytics')
    const { WorkshopRouterError } =
      await import('../config/workshop-router-errors')
    const cause = new DOMException('Private filename.png', 'NotReadableError')
    const properties = {
      model_slug: 'image-edit',
      attempt_id: 'attempt-1',
      user_id: 'user-1',
      workspace_id: 'workspace-1',
      duration_ms: 50,
      ...workshopFailureAnalytics(
        new WorkshopRouterError(
          'client',
          null,
          { images: 'fileUnreadable' },
          undefined,
          'file_read',
          { cause }
        )
      ),
      status: 'failed' as const
    }
    initPostHog()
    captureWorkshopEvent({ name: 'run_finished', properties })

    expect(hoisted.mockCapture).toHaveBeenCalledWith(
      'website:workshop_run_finished',
      expect.objectContaining({
        attempt_id: 'attempt-1',
        failure_stage: 'file_read',
        exception_name: 'NotReadableError'
      })
    )
    expect(JSON.stringify(hoisted.mockCapture.mock.calls)).not.toContain(
      'filename.png'
    )
  })

  it('uses the website PostHog stream and cannot interrupt interaction when capture fails', async () => {
    const { initPostHog, captureWorkshopEvent } = await import('./posthog')
    captureWorkshopEvent({
      name: 'catalogue_viewed',
      properties: { model_count: 10 }
    })
    expect(hoisted.mockCapture).not.toHaveBeenCalled()
    initPostHog()
    captureWorkshopEvent({
      name: 'catalogue_viewed',
      properties: { model_count: 10 }
    })
    expect(hoisted.mockCapture).toHaveBeenCalledWith(
      'website:workshop_catalogue_viewed',
      { model_count: 10 }
    )
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    hoisted.mockCapture.mockImplementation(() => {
      throw new Error('Capture unavailable')
    })
    expect(() =>
      captureWorkshopEvent({
        name: 'catalogue_viewed',
        properties: { model_count: 10 }
      })
    ).not.toThrow()
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

  it('allows sign-in without an auth flag while Models stays disabled, and honors explicit auth changes', async () => {
    hoisted.deployEnv = 'production'
    hoisted.mockIsFeatureEnabled.mockImplementation((key) =>
      key === 'workshop-enabled' ? false : undefined
    )
    const { initPostHog, useWorkshopAuthFlag, useWorkshopEnabled } =
      await import('./posthog')
    const enabled = useWorkshopAuthFlag()
    initPostHog()
    emitFeatureFlags()
    expect(enabled.value).toBe(true)
    expect(useWorkshopEnabled().value).toBe(false)

    hoisted.mockIsFeatureEnabled.mockReturnValue(false)
    emitFeatureFlags()
    expect(enabled.value).toBe(false)
    hoisted.mockIsFeatureEnabled.mockReturnValue(true)
    emitFeatureFlags()
    expect(enabled.value).toBe(true)
  })

  it('keeps authentication available when PostHog is unavailable', async () => {
    const { initPostHog, useWorkshopAuthFlag, useWorkshopEnabled } =
      await import('./posthog')

    initPostHog()
    emitFeatureFlags(true)
    expect(useWorkshopAuthFlag().value).toBe(true)
    expect(useWorkshopEnabled().value).toBe(false)
  })

  it('allows authentication even if analytics initialization fails', async () => {
    hoisted.mockInit.mockImplementationOnce(() => {
      throw new Error('Analytics unavailable')
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { initPostHog, useWorkshopAuthFlag } = await import('./posthog')

    initPostHog()
    expect(useWorkshopAuthFlag().value).toBe(true)
  })

  it('keeps the production auth kill switch despite a configured override', async () => {
    hoisted.deployEnv = 'production'
    vi.stubEnv('PUBLIC_WORKSHOP_AUTH_FLAG', '1')
    const { initPostHog, useWorkshopAuthFlag } = await import('./posthog')
    initPostHog()
    const enabled = useWorkshopAuthFlag()
    hoisted.mockIsFeatureEnabled.mockReturnValue(true)
    emitFeatureFlags()
    expect(enabled.value).toBe(true)
    hoisted.mockIsFeatureEnabled.mockReturnValue(false)
    emitFeatureFlags()
    expect(enabled.value).toBe(false)
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
