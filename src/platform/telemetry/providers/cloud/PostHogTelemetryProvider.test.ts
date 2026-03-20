import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TelemetryEvents } from '../../types'

const hoisted = vi.hoisted(() => {
  const mockCapture = vi.fn()
  const mockInit = vi.fn()
  const mockIdentify = vi.fn()
  const mockPeopleSet = vi.fn()
  const mockOnUserResolved = vi.fn()

  return {
    mockCapture,
    mockInit,
    mockIdentify,
    mockPeopleSet,
    mockOnUserResolved,
    mockPosthog: {
      default: {
        init: mockInit,
        capture: mockCapture,
        identify: mockIdentify,
        people: { set: mockPeopleSet }
      }
    }
  }
})

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    watch: vi.fn()
  }
})

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    onUserResolved: hoisted.mockOnUserResolved
  })
}))

const mockRemoteConfig = vi.hoisted(
  () => ({ value: null }) as { value: Record<string, unknown> | null }
)

vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfig: mockRemoteConfig
}))

vi.mock('posthog-js', () => hoisted.mockPosthog)

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    subscriptionTier: { value: null }
  })
}))

import { PostHogTelemetryProvider } from './PostHogTelemetryProvider'

function createProvider(
  config: Partial<typeof window.__CONFIG__> = {}
): PostHogTelemetryProvider {
  const original = window.__CONFIG__
  window.__CONFIG__ = { ...original, ...config }
  const provider = new PostHogTelemetryProvider()
  window.__CONFIG__ = original
  return provider
}

describe('PostHogTelemetryProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRemoteConfig.value = null
    window.__CONFIG__ = {
      posthog_project_token: 'phc_test_token'
    } as typeof window.__CONFIG__
  })

  describe('initialization', () => {
    it('disables itself when posthog_project_token is not provided', async () => {
      const provider = createProvider({ posthog_project_token: undefined })
      await vi.dynamicImportSettled()

      provider.trackSignupOpened()

      expect(hoisted.mockCapture).not.toHaveBeenCalled()
    })

    it('calls posthog.init with the token and default config', async () => {
      createProvider()
      await vi.dynamicImportSettled()

      expect(hoisted.mockInit).toHaveBeenCalledWith(
        'phc_test_token',
        expect.objectContaining({
          api_host: 'https://t.comfy.org',
          ui_host: 'https://us.posthog.com',
          autocapture: false,
          capture_pageview: false,
          capture_pageleave: false,
          persistence: 'localStorage+cookie'
        })
      )
    })

    it('applies posthog_config overrides from remote config', async () => {
      mockRemoteConfig.value = {
        posthog_config: {
          debug: true,
          api_host: 'https://custom.host.com'
        }
      }
      createProvider()
      await vi.dynamicImportSettled()

      expect(hoisted.mockInit).toHaveBeenCalledWith(
        'phc_test_token',
        expect.objectContaining({
          debug: true,
          api_host: 'https://custom.host.com'
        })
      )
    })

    it('registers onUserResolved callback after init', async () => {
      createProvider()
      await vi.dynamicImportSettled()

      expect(hoisted.mockOnUserResolved).toHaveBeenCalledOnce()
    })

    it('identifies user when onUserResolved fires', async () => {
      createProvider()
      await vi.dynamicImportSettled()

      const callback = hoisted.mockOnUserResolved.mock.calls[0][0]
      callback({ id: 'user-123' })

      expect(hoisted.mockIdentify).toHaveBeenCalledWith('user-123')
    })
  })

  describe('event tracking', () => {
    it('captures events after initialization', async () => {
      const provider = createProvider()
      await vi.dynamicImportSettled()

      provider.trackSignupOpened()

      expect(hoisted.mockCapture).toHaveBeenCalledWith(
        TelemetryEvents.USER_SIGN_UP_OPENED,
        {}
      )
    })

    it('captures events with metadata', async () => {
      const provider = createProvider()
      await vi.dynamicImportSettled()

      provider.trackAuth({ method: 'google' })

      expect(hoisted.mockCapture).toHaveBeenCalledWith(
        TelemetryEvents.USER_AUTH_COMPLETED,
        { method: 'google' }
      )
    })

    it('queues events before initialization and flushes after', async () => {
      const provider = createProvider()

      provider.trackUserLoggedIn()
      expect(hoisted.mockCapture).not.toHaveBeenCalled()

      await vi.dynamicImportSettled()

      expect(hoisted.mockCapture).toHaveBeenCalledWith(
        TelemetryEvents.USER_LOGGED_IN,
        {}
      )
    })
  })

  describe('disabled events', () => {
    it('does not capture default disabled events', async () => {
      const provider = createProvider()
      await vi.dynamicImportSettled()

      provider.trackWorkflowOpened({
        missing_node_count: 0,
        missing_node_types: []
      })

      expect(hoisted.mockCapture).not.toHaveBeenCalled()
    })

    it('captures events not in the disabled list', async () => {
      const provider = createProvider()
      await vi.dynamicImportSettled()

      provider.trackMonthlySubscriptionSucceeded()

      expect(hoisted.mockCapture).toHaveBeenCalledWith(
        TelemetryEvents.MONTHLY_SUBSCRIPTION_SUCCEEDED,
        {}
      )
    })
  })

  describe('survey tracking', () => {
    it('sets user properties on survey submission', async () => {
      const provider = createProvider()
      await vi.dynamicImportSettled()

      const responses = { familiarity: 'beginner', industry: 'tech' }
      provider.trackSurvey('submitted', responses)

      expect(hoisted.mockCapture).toHaveBeenCalledWith(
        TelemetryEvents.USER_SURVEY_SUBMITTED,
        expect.objectContaining({ familiarity: 'beginner' })
      )
      expect(hoisted.mockPeopleSet).toHaveBeenCalled()
    })

    it('does not set user properties on survey opened', async () => {
      const provider = createProvider()
      await vi.dynamicImportSettled()

      provider.trackSurvey('opened')

      expect(hoisted.mockCapture).toHaveBeenCalledWith(
        TelemetryEvents.USER_SURVEY_OPENED,
        {}
      )
      expect(hoisted.mockPeopleSet).not.toHaveBeenCalled()
    })
  })

  describe('websocket reconnect', () => {
    it('captures reconnect event with metadata', async () => {
      const provider = createProvider()
      await vi.dynamicImportSettled()

      provider.trackWebSocketReconnected({
        disconnect_duration_ms: 5000,
        had_active_jobs: true,
        active_job_count: 3
      })

      expect(hoisted.mockCapture).toHaveBeenCalledWith(
        TelemetryEvents.WEBSOCKET_RECONNECTED,
        {
          disconnect_duration_ms: 5000,
          had_active_jobs: true,
          active_job_count: 3
        }
      )
    })

    it('captures reconnect event when no jobs were active', async () => {
      const provider = createProvider()
      await vi.dynamicImportSettled()

      provider.trackWebSocketReconnected({
        disconnect_duration_ms: 1200,
        had_active_jobs: false,
        active_job_count: 0
      })

      expect(hoisted.mockCapture).toHaveBeenCalledWith(
        TelemetryEvents.WEBSOCKET_RECONNECTED,
        {
          disconnect_duration_ms: 1200,
          had_active_jobs: false,
          active_job_count: 0
        }
      )
    })
  })

  describe('page view', () => {
    it('captures page view with page_name property', async () => {
      const provider = createProvider()
      await vi.dynamicImportSettled()

      provider.trackPageView('workflow_editor')

      expect(hoisted.mockCapture).toHaveBeenCalledWith(
        TelemetryEvents.PAGE_VIEW,
        { page_name: 'workflow_editor' }
      )
    })

    it('forwards additional metadata', async () => {
      const provider = createProvider()
      await vi.dynamicImportSettled()

      provider.trackPageView('workflow_editor', {
        path: '/workflows/123'
      })

      expect(hoisted.mockCapture).toHaveBeenCalledWith(
        TelemetryEvents.PAGE_VIEW,
        { page_name: 'workflow_editor', path: '/workflows/123' }
      )
    })
  })
})
