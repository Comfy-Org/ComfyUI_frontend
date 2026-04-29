import type * as VueModule from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockMixpanel = vi.hoisted(() => ({
  init: vi.fn(),
  track: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  people: { set: vi.fn() }
}))

vi.mock('mixpanel-browser', () => ({
  default: mockMixpanel
}))

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof VueModule>('vue')
  return {
    ...actual,
    watch: vi.fn()
  }
})

const mockOnUserResolved = vi.hoisted(() => vi.fn())
vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ onUserResolved: mockOnUserResolved })
}))

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({
    mode: { value: 'workflow' },
    isAppMode: { value: false }
  })
}))

const topupMocks = vi.hoisted(() => ({
  startTopupTracking: vi.fn(),
  clearTopupTracking: vi.fn(),
  checkForCompletedTopup: vi.fn().mockReturnValue(true)
}))
vi.mock('@/platform/telemetry/topupTracker', () => topupMocks)

vi.mock('@/platform/telemetry/utils/getExecutionContext', () => ({
  getExecutionContext: () => ({
    is_template: false,
    workflow_name: 'untitled',
    custom_node_count: 0,
    total_node_count: 0,
    subgraph_count: 0,
    has_api_nodes: false,
    api_node_names: [],
    has_toolkit_nodes: false,
    toolkit_node_names: []
  })
}))

vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfig: { value: null }
}))

import { MixpanelTelemetryProvider } from '@/platform/telemetry/providers/cloud/MixpanelTelemetryProvider'
import { TelemetryEvents } from '@/platform/telemetry/types'

const flushDynamicImport = () => new Promise((r) => setTimeout(r, 0))

type ConfigWindow = { __CONFIG__?: { mixpanel_token?: string } }

describe('MixpanelTelemetryProvider — without configured token', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete (window as unknown as ConfigWindow).__CONFIG__
  })

  it('warns and disables itself when no mixpanel_token is configured', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const provider = new MixpanelTelemetryProvider()
    provider.trackUserLoggedIn()

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Mixpanel token'))
    expect(mockMixpanel.track).not.toHaveBeenCalled()
    expect(mockMixpanel.init).not.toHaveBeenCalled()
  })
})

describe('MixpanelTelemetryProvider — with configured token', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(window as unknown as ConfigWindow).__CONFIG__ = {
      mixpanel_token: 'test-token'
    }
    mockMixpanel.init.mockImplementation((_token, config) => {
      config?.loaded?.()
    })
  })

  it('initializes Mixpanel and tracks events synchronously after the loaded callback fires', async () => {
    const provider = new MixpanelTelemetryProvider()
    await flushDynamicImport()

    provider.trackUserLoggedIn()

    expect(mockMixpanel.init).toHaveBeenCalledWith(
      'test-token',
      expect.any(Object)
    )
    expect(mockMixpanel.track).toHaveBeenCalledWith(
      TelemetryEvents.USER_LOGGED_IN,
      {}
    )
  })

  it('queues events fired before loaded() and flushes them once Mixpanel reports ready', async () => {
    const captured: { trigger: (() => void) | null } = { trigger: null }
    mockMixpanel.init.mockImplementationOnce((_token, config) => {
      captured.trigger = config?.loaded ?? null
    })

    const provider = new MixpanelTelemetryProvider()
    await flushDynamicImport()

    provider.trackSignupOpened()
    provider.trackUserLoggedIn()
    expect(mockMixpanel.track).not.toHaveBeenCalled()

    captured.trigger?.()

    expect(mockMixpanel.track).toHaveBeenCalledWith(
      TelemetryEvents.USER_SIGN_UP_OPENED,
      {}
    )
    expect(mockMixpanel.track).toHaveBeenCalledWith(
      TelemetryEvents.USER_LOGGED_IN,
      {}
    )
  })

  it('skips events that are in the default disabled set', async () => {
    const provider = new MixpanelTelemetryProvider()
    await flushDynamicImport()
    mockMixpanel.track.mockClear()

    provider.trackWorkflowOpened({} as never)

    expect(mockMixpanel.track).not.toHaveBeenCalled()
  })

  it.each([
    ['opened' as const, TelemetryEvents.USER_EMAIL_VERIFY_OPENED],
    ['requested' as const, TelemetryEvents.USER_EMAIL_VERIFY_REQUESTED],
    ['completed' as const, TelemetryEvents.USER_EMAIL_VERIFY_COMPLETED]
  ])(
    'trackEmailVerification(%s) dispatches %s',
    async (stage, expectedEvent) => {
      const provider = new MixpanelTelemetryProvider()
      await flushDynamicImport()
      mockMixpanel.track.mockClear()

      provider.trackEmailVerification(stage)

      expect(mockMixpanel.track).toHaveBeenCalledWith(expectedEvent, {})
    }
  )

  it.each([
    [
      'modal_opened' as const,
      TelemetryEvents.SUBSCRIPTION_REQUIRED_MODAL_OPENED
    ],
    ['subscribe_clicked' as const, TelemetryEvents.SUBSCRIBE_NOW_BUTTON_CLICKED]
  ])('trackSubscription(%s) dispatches %s', async (event, expectedEvent) => {
    const provider = new MixpanelTelemetryProvider()
    await flushDynamicImport()
    mockMixpanel.track.mockClear()

    provider.trackSubscription(event)

    expect(mockMixpanel.track).toHaveBeenCalledWith(expectedEvent, {})
  })

  it('writes normalized survey properties to Mixpanel.people on submit', async () => {
    const provider = new MixpanelTelemetryProvider()
    await flushDynamicImport()

    provider.trackSurvey('submitted', {
      industry: 'tech',
      use_case: 'fun'
    } as never)

    expect(mockMixpanel.people.set).toHaveBeenCalled()
  })

  it('does not write to Mixpanel.people for survey "opened"', async () => {
    const provider = new MixpanelTelemetryProvider()
    await flushDynamicImport()
    mockMixpanel.people.set.mockClear()

    provider.trackSurvey('opened')

    expect(mockMixpanel.people.set).not.toHaveBeenCalled()
  })

  it('forwards user identification when onUserResolved callback fires with a user id', async () => {
    new MixpanelTelemetryProvider()
    await flushDynamicImport()

    expect(mockOnUserResolved).toHaveBeenCalled()
    const callback = mockOnUserResolved.mock.calls[0]?.[0] as (user: {
      id?: string
    }) => void
    callback({ id: 'user-42' })

    expect(mockMixpanel.identify).toHaveBeenCalledWith('user-42')
  })
})

describe('MixpanelTelemetryProvider — direct event tracking methods', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(window as unknown as ConfigWindow).__CONFIG__ = {
      mixpanel_token: 'test-token'
    }
    mockMixpanel.init.mockImplementation((_token, config) => {
      config?.loaded?.()
    })
  })

  type Trackable = (provider: MixpanelTelemetryProvider) => void

  it.each<
    [string, Trackable, (typeof TelemetryEvents)[keyof typeof TelemetryEvents]]
  >([
    [
      'trackAddApiCreditButtonClicked',
      (p) => p.trackAddApiCreditButtonClicked(),
      TelemetryEvents.ADD_API_CREDIT_BUTTON_CLICKED
    ],
    [
      'trackMonthlySubscriptionSucceeded',
      (p) => p.trackMonthlySubscriptionSucceeded(),
      TelemetryEvents.MONTHLY_SUBSCRIPTION_SUCCEEDED
    ],
    [
      'trackMonthlySubscriptionCancelled',
      (p) => p.trackMonthlySubscriptionCancelled(),
      TelemetryEvents.MONTHLY_SUBSCRIPTION_CANCELLED
    ],
    [
      'trackApiCreditTopupSucceeded',
      (p) => p.trackApiCreditTopupSucceeded(),
      TelemetryEvents.API_CREDIT_TOPUP_SUCCEEDED
    ],
    [
      'trackTemplate',
      (p) => p.trackTemplate({ template_name: 't' } as never),
      TelemetryEvents.TEMPLATE_WORKFLOW_OPENED
    ],
    [
      'trackTemplateLibraryOpened',
      (p) => p.trackTemplateLibraryOpened({} as never),
      TelemetryEvents.TEMPLATE_LIBRARY_OPENED
    ],
    [
      'trackTemplateLibraryClosed',
      (p) => p.trackTemplateLibraryClosed({} as never),
      TelemetryEvents.TEMPLATE_LIBRARY_CLOSED
    ],
    [
      'trackWorkflowImported',
      (p) => p.trackWorkflowImported({} as never),
      TelemetryEvents.WORKFLOW_IMPORTED
    ],
    [
      'trackWorkflowSaved',
      (p) => p.trackWorkflowSaved({} as never),
      TelemetryEvents.WORKFLOW_SAVED
    ],
    [
      'trackDefaultViewSet',
      (p) => p.trackDefaultViewSet({} as never),
      TelemetryEvents.DEFAULT_VIEW_SET
    ],
    [
      'trackEnterLinear',
      (p) => p.trackEnterLinear({} as never),
      TelemetryEvents.ENTER_LINEAR_MODE
    ],
    [
      'trackShareFlow',
      (p) => p.trackShareFlow({} as never),
      TelemetryEvents.SHARE_FLOW
    ],
    [
      'trackExecutionError',
      (p) => p.trackExecutionError({} as never),
      TelemetryEvents.EXECUTION_ERROR
    ],
    [
      'trackExecutionSuccess',
      (p) => p.trackExecutionSuccess({} as never),
      TelemetryEvents.EXECUTION_SUCCESS
    ],
    [
      'trackAuth',
      (p) => p.trackAuth({} as never),
      TelemetryEvents.USER_AUTH_COMPLETED
    ],
    [
      'trackSignupOpened',
      (p) => p.trackSignupOpened(),
      TelemetryEvents.USER_SIGN_UP_OPENED
    ]
  ])('%s dispatches %s', async (_name, invoke, expectedEvent) => {
    const provider = new MixpanelTelemetryProvider()
    await flushDynamicImport()
    mockMixpanel.track.mockClear()

    invoke(provider)

    expect(mockMixpanel.track).toHaveBeenCalledWith(
      expectedEvent,
      expect.anything()
    )
  })

  it('trackApiCreditTopupButtonPurchaseClicked includes the credit_amount payload', async () => {
    const provider = new MixpanelTelemetryProvider()
    await flushDynamicImport()
    mockMixpanel.track.mockClear()

    provider.trackApiCreditTopupButtonPurchaseClicked(42)

    expect(mockMixpanel.track).toHaveBeenCalledWith(
      TelemetryEvents.API_CREDIT_TOPUP_BUTTON_PURCHASE_CLICKED,
      { credit_amount: 42 }
    )
  })

  it('trackRunButton populates RunButtonProperties from the execution context', async () => {
    const provider = new MixpanelTelemetryProvider()
    await flushDynamicImport()
    mockMixpanel.track.mockClear()

    provider.trackRunButton({
      subscribe_to_run: true,
      trigger_source: 'menu' as never
    })

    expect(mockMixpanel.track).toHaveBeenCalledWith(
      TelemetryEvents.RUN_BUTTON_CLICKED,
      expect.objectContaining({
        subscribe_to_run: true,
        workflow_type: 'custom',
        trigger_source: 'menu',
        view_mode: 'workflow',
        is_app_mode: false
      })
    )
  })

  it('trackWorkflowExecution forwards the latest trigger_source from trackRunButton', async () => {
    const provider = new MixpanelTelemetryProvider()
    await flushDynamicImport()
    mockMixpanel.track.mockClear()

    provider.trackRunButton({ trigger_source: 'menu' as never })
    provider.trackWorkflowExecution()

    expect(mockMixpanel.track).toHaveBeenCalledWith(
      TelemetryEvents.EXECUTION_START,
      expect.objectContaining({ trigger_source: 'menu' })
    )

    mockMixpanel.track.mockClear()
    provider.trackWorkflowExecution()
    expect(mockMixpanel.track).toHaveBeenCalledWith(
      TelemetryEvents.EXECUTION_START,
      expect.objectContaining({ trigger_source: 'unknown' })
    )
  })
})

describe('MixpanelTelemetryProvider — topup delegation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete (window as unknown as ConfigWindow).__CONFIG__
  })

  it('forwards topup lifecycle calls to the topupTracker utility', () => {
    const provider = new MixpanelTelemetryProvider()

    provider.startTopupTracking()
    provider.clearTopupTracking()
    const result = provider.checkForCompletedTopup([])

    expect(topupMocks.startTopupTracking).toHaveBeenCalled()
    expect(topupMocks.clearTopupTracking).toHaveBeenCalled()
    expect(topupMocks.checkForCompletedTopup).toHaveBeenCalledWith([])
    expect(result).toBe(true)
  })
})
