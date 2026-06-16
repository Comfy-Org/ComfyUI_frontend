import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TelemetryEvents } from '../../types'

const hoisted = vi.hoisted(() => {
  const mockCapture = vi.fn()
  const mockInit = vi.fn()
  const mockIdentify = vi.fn()
  const mockPeopleSet = vi.fn()
  const mockPeopleSetOnce = vi.fn()
  const mockRegister = vi.fn()
  const mockReset = vi.fn()
  const mockOnUserResolved = vi.fn()
  const mockOnUserLogout = vi.fn()

  return {
    mockCapture,
    mockInit,
    mockIdentify,
    mockPeopleSet,
    mockPeopleSetOnce,
    mockRegister,
    mockReset,
    mockOnUserResolved,
    mockOnUserLogout,
    mockPosthog: {
      default: {
        init: mockInit,
        capture: mockCapture,
        identify: mockIdentify,
        register: mockRegister,
        people: { set: mockPeopleSet, set_once: mockPeopleSetOnce },
        reset: mockReset
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
    onUserResolved: hoisted.mockOnUserResolved,
    onUserLogout: hoisted.mockOnUserLogout
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

    it('identifies user without setting first_auth_at when onUserResolved fires', async () => {
      createProvider()
      await vi.dynamicImportSettled()

      const callback = hoisted.mockOnUserResolved.mock.calls[0][0]
      callback({ id: 'user-123' })

      expect(hoisted.mockIdentify).toHaveBeenCalledWith('user-123')
    })
  })

  describe('desktop entry capture', () => {
    function setLocation(search: string): void {
      Object.defineProperty(window.location, 'search', {
        configurable: true,
        value: search,
        writable: true
      })
    }

    afterEach(() => {
      setLocation('')
    })

    it('does not register desktop props when utm_source is absent', async () => {
      setLocation('')
      createProvider()
      await vi.dynamicImportSettled()

      expect(hoisted.mockRegister).not.toHaveBeenCalled()
    })

    it('does not register desktop props when utm_source is not comfy.desktop', async () => {
      setLocation('?utm_source=google&desktop_device_id=should-be-ignored')
      createProvider()
      await vi.dynamicImportSettled()

      expect(hoisted.mockRegister).not.toHaveBeenCalled()
    })

    it('registers source_app and desktop_device_id when arriving from desktop', async () => {
      setLocation(
        '?utm_source=comfy.desktop&utm_medium=app_feature&desktop_device_id=device-abc'
      )
      createProvider()
      await vi.dynamicImportSettled()

      expect(hoisted.mockRegister).toHaveBeenCalledWith({
        source_app: 'desktop',
        desktop_device_id: 'device-abc'
      })
    })

    it('registers source_app alone when desktop_device_id is missing', async () => {
      setLocation('?utm_source=comfy.desktop')
      createProvider()
      await vi.dynamicImportSettled()

      expect(hoisted.mockRegister).toHaveBeenCalledWith({
        source_app: 'desktop'
      })
    })

    it('persists desktop props to the person on identify so backend events inherit them', async () => {
      setLocation('?utm_source=comfy.desktop&desktop_device_id=device-xyz')
      createProvider()
      await vi.dynamicImportSettled()

      const callback = hoisted.mockOnUserResolved.mock.calls[0][0]
      callback({ id: 'user-456' })

      const setCall = hoisted.mockPeopleSet.mock.calls.find(
        ([props]) => props && 'desktop_device_id' in props
      )
      expect(setCall?.[0]).toEqual(
        expect.objectContaining({
          source_app: 'desktop',
          desktop_device_id: 'device-xyz',
          last_seen_via_desktop: expect.any(String)
        })
      )
      expect(hoisted.mockPeopleSetOnce).toHaveBeenCalledWith(
        expect.objectContaining({ first_seen_via_desktop: expect.any(String) })
      )
    })

    it('does not touch the person profile on identify for non-desktop visitors', async () => {
      setLocation('')
      createProvider()
      await vi.dynamicImportSettled()

      const callback = hoisted.mockOnUserResolved.mock.calls[0][0]
      callback({ id: 'user-789' })

      const desktopSetCall = hoisted.mockPeopleSet.mock.calls.find(
        ([props]) =>
          props &&
          ('desktop_device_id' in props || 'last_seen_via_desktop' in props)
      )
      expect(desktopSetCall).toBeUndefined()
      expect(hoisted.mockPeopleSetOnce).not.toHaveBeenCalled()
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

    it('captures share attribution events', async () => {
      const provider = createProvider()
      await vi.dynamicImportSettled()

      provider.trackShareLinkOpened({
        share_id: 'share-1',
        is_authenticated: true,
        view_mode: 'graph',
        is_app_mode: false
      })
      provider.trackShareFlow({
        step: 'link_created',
        source: 'app_mode',
        share_id: 'share-1',
        view_mode: 'app',
        is_app_mode: true
      })
      provider.trackSharedWorkflowRun({
        job_id: 'job-1',
        share_id: 'share-1',
        view_mode: 'app',
        is_app_mode: true
      })

      expect(hoisted.mockCapture).toHaveBeenCalledWith(
        TelemetryEvents.SHARE_LINK_OPENED,
        {
          share_id: 'share-1',
          is_authenticated: true,
          view_mode: 'graph',
          is_app_mode: false
        }
      )
      expect(hoisted.mockCapture).toHaveBeenCalledWith(
        TelemetryEvents.SHARE_FLOW,
        {
          step: 'link_created',
          source: 'app_mode',
          share_id: 'share-1',
          view_mode: 'app',
          is_app_mode: true
        }
      )
      expect(hoisted.mockCapture).toHaveBeenCalledWith(
        TelemetryEvents.SHARED_WORKFLOW_RUN,
        {
          job_id: 'job-1',
          share_id: 'share-1',
          view_mode: 'app',
          is_app_mode: true
        }
      )
    })

    it('captures search queries with surface, query, length, and result count', async () => {
      const provider = createProvider()
      await vi.dynamicImportSettled()

      provider.trackSearchQuery({
        surface: 'node_sidebar',
        query: 'sampler',
        query_length: 7,
        result_count: 3,
        has_results: true
      })

      expect(hoisted.mockCapture).toHaveBeenCalledWith(
        TelemetryEvents.SEARCH_QUERY,
        {
          surface: 'node_sidebar',
          query: 'sampler',
          query_length: 7,
          result_count: 3,
          has_results: true
        }
      )
    })

    it('sets first_auth_at on new-user auth', async () => {
      const provider = createProvider()
      await vi.dynamicImportSettled()

      provider.trackAuth({
        method: 'google',
        is_new_user: true,
        user_id: 'user-123'
      })

      expect(hoisted.mockIdentify).toHaveBeenCalledWith(
        'user-123',
        undefined,
        expect.objectContaining({
          first_auth_at: expect.any(String)
        })
      )
      expect(hoisted.mockCapture).toHaveBeenCalledWith(
        TelemetryEvents.USER_AUTH_COMPLETED,
        {
          method: 'google',
          is_new_user: true,
          user_id: 'user-123'
        }
      )
    })

    it('does not set first_auth_at on returning-user auth', async () => {
      const provider = createProvider()
      await vi.dynamicImportSettled()

      provider.trackAuth({
        method: 'google',
        is_new_user: false,
        user_id: 'user-123'
      })

      expect(hoisted.mockIdentify).not.toHaveBeenCalled()
      expect(hoisted.mockCapture).toHaveBeenCalledWith(
        TelemetryEvents.USER_AUTH_COMPLETED,
        {
          method: 'google',
          is_new_user: false,
          user_id: 'user-123'
        }
      )
    })

    it('flushes queued first_auth_at before queued auth event', async () => {
      const provider = createProvider()

      provider.trackAuth({
        method: 'google',
        is_new_user: true,
        user_id: 'user-123'
      })

      expect(hoisted.mockIdentify).not.toHaveBeenCalled()
      expect(hoisted.mockCapture).not.toHaveBeenCalled()

      await vi.dynamicImportSettled()

      expect(hoisted.mockIdentify).toHaveBeenCalledWith(
        'user-123',
        undefined,
        expect.objectContaining({
          first_auth_at: expect.any(String)
        })
      )
      expect(hoisted.mockCapture).toHaveBeenCalledWith(
        TelemetryEvents.USER_AUTH_COMPLETED,
        {
          method: 'google',
          is_new_user: true,
          user_id: 'user-123'
        }
      )
      expect(hoisted.mockIdentify.mock.invocationCallOrder[0]).toBeLessThan(
        hoisted.mockCapture.mock.invocationCallOrder[0]
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

    it('captures enabled funnel events by default', async () => {
      const provider = createProvider()
      await vi.dynamicImportSettled()

      provider.trackSettingChanged({ setting_id: 'theme' })
      provider.trackTemplateFilterChanged({
        selected_models: [],
        selected_use_cases: [],
        selected_runs_on: [],
        sort_by: 'default',
        filtered_count: 1,
        total_count: 2
      })
      provider.trackUiButtonClicked({
        button_id: 'sidebar_settings_button_clicked',
        element_group: 'sidebar'
      })

      expect(hoisted.mockCapture).toHaveBeenCalledWith(
        TelemetryEvents.SETTING_CHANGED,
        { setting_id: 'theme' }
      )
      expect(hoisted.mockCapture).toHaveBeenCalledWith(
        TelemetryEvents.TEMPLATE_FILTER_CHANGED,
        {
          selected_models: [],
          selected_use_cases: [],
          selected_runs_on: [],
          sort_by: 'default',
          filtered_count: 1,
          total_count: 2
        }
      )
      expect(hoisted.mockCapture).toHaveBeenCalledWith(
        TelemetryEvents.UI_BUTTON_CLICKED,
        {
          button_id: 'sidebar_settings_button_clicked',
          element_group: 'sidebar'
        }
      )
    })

    it('captures shell layout snapshots', async () => {
      const provider = createProvider()
      await vi.dynamicImportSettled()

      const shellLayoutMetadata = {
        view_mode: 'graph',
        is_app_mode: false,
        dock_state: 'floating',
        actionbar_position: 'Top',
        active_sidebar_tab: 'node-library',
        right_side_panel_open: true,
        bottom_panel_open: false,
        open_workflow_tabs: 2
      } as const

      provider.trackShellLayout(shellLayoutMetadata)

      expect(hoisted.mockCapture).toHaveBeenCalledWith(
        TelemetryEvents.SHELL_LAYOUT,
        shellLayoutMetadata
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

  describe('logout', () => {
    it('registers onUserLogout watcher after init', async () => {
      createProvider()
      await vi.dynamicImportSettled()

      expect(hoisted.mockOnUserLogout).toHaveBeenCalledOnce()
    })

    it('calls posthog.reset(true) when the watcher fires', async () => {
      createProvider()
      await vi.dynamicImportSettled()

      const callback = hoisted.mockOnUserLogout.mock.calls[0][0]
      callback()

      expect(hoisted.mockReset).toHaveBeenCalledWith(true)
    })

    it('does not register the watcher before init resolves', () => {
      createProvider()

      expect(hoisted.mockOnUserLogout).not.toHaveBeenCalled()
      expect(hoisted.mockReset).not.toHaveBeenCalled()
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

  describe('before_send', () => {
    it('strips PII keys from event properties, $set, and $set_once', async () => {
      createProvider()
      await vi.dynamicImportSettled()

      const { before_send } = hoisted.mockInit.mock.calls[0][1]

      const event = {
        event: 'test',
        properties: {
          email: 'props@example.com',
          prompt: 'hello',
          user_email: 'props_user@example.com',
          $email: 'props_posthog@example.com',
          method: 'google'
        },
        $set: {
          email: 'set@example.com',
          user_email: 'set_user@example.com',
          $email: 'set_posthog@example.com',
          name: 'keep me'
        },
        $set_once: {
          email: 'set_once@example.com',
          plan: 'free'
        }
      }

      const result = before_send(event)

      // event.properties — all four PII keys stripped, non-PII preserved
      expect(result.properties).not.toHaveProperty('email')
      expect(result.properties).not.toHaveProperty('prompt')
      expect(result.properties).not.toHaveProperty('user_email')
      expect(result.properties).not.toHaveProperty('$email')
      expect(result.properties).toHaveProperty('method', 'google')

      // event.$set — PII stripped, non-PII preserved
      // posthog.identify(id, { email }) lands here, not in properties
      expect(result.$set).not.toHaveProperty('email')
      expect(result.$set).not.toHaveProperty('user_email')
      expect(result.$set).not.toHaveProperty('$email')
      expect(result.$set).toHaveProperty('name', 'keep me')

      // event.$set_once — PII stripped, non-PII preserved
      expect(result.$set_once).not.toHaveProperty('email')
      expect(result.$set_once).toHaveProperty('plan', 'free')
    })

    it('remoteConfig.posthog_config cannot override before_send or person_profiles', async () => {
      const remoteBefore_send = vi.fn()
      mockRemoteConfig.value = {
        posthog_config: {
          before_send: remoteBefore_send,
          person_profiles: 'always'
        }
      }

      createProvider()
      await vi.dynamicImportSettled()

      const initConfig = hoisted.mockInit.mock.calls[0][1]

      expect(initConfig.before_send).not.toBe(remoteBefore_send)
      expect(initConfig.person_profiles).toBe('identified_only')
    })
  })
})
