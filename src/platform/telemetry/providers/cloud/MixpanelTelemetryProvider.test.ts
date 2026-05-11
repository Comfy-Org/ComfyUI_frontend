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

const mockNormalizeSurveyResponses = vi.hoisted(() => vi.fn())
vi.mock('@/platform/telemetry/utils/surveyNormalization', () => ({
  normalizeSurveyResponses: mockNormalizeSurveyResponses
}))

vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfig: { value: null }
}))

import { MixpanelTelemetryProvider } from '@/platform/telemetry/providers/cloud/MixpanelTelemetryProvider'
import type {
  AuthMetadata,
  DefaultViewSetMetadata,
  EnterLinearMetadata,
  ExecutionErrorMetadata,
  ExecutionSuccessMetadata,
  ShareFlowMetadata,
  SurveyResponses,
  TemplateLibraryClosedMetadata,
  TemplateLibraryMetadata,
  TemplateMetadata,
  WorkflowImportMetadata,
  WorkflowSavedMetadata
} from '@/platform/telemetry/types'
import { TelemetryEvents } from '@/platform/telemetry/types'

const waitForMixpanelInit = () =>
  vi.waitFor(() => expect(mockMixpanel.init).toHaveBeenCalled())

type ConfigWindow = { __CONFIG__?: { mixpanel_token?: string } }

describe('MixpanelTelemetryProvider — without configured token', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete (window as unknown as ConfigWindow).__CONFIG__
  })

  it('warns and disables itself when no mixpanel_token is configured', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    try {
      const provider = new MixpanelTelemetryProvider()
      provider.trackUserLoggedIn()

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Mixpanel token')
      )
      expect(mockMixpanel.track).not.toHaveBeenCalled()
      expect(mockMixpanel.init).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
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
    mockNormalizeSurveyResponses.mockImplementation((responses) => responses)
  })

  it('initializes Mixpanel and tracks events synchronously after the loaded callback fires', async () => {
    const provider = new MixpanelTelemetryProvider()
    await waitForMixpanelInit()

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
    await waitForMixpanelInit()

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
    await waitForMixpanelInit()
    mockMixpanel.track.mockClear()

    const metadata: WorkflowImportMetadata = {
      missing_node_count: 0,
      missing_node_types: []
    }
    provider.trackWorkflowOpened(metadata)

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
      await waitForMixpanelInit()
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
    await waitForMixpanelInit()
    mockMixpanel.track.mockClear()

    provider.trackSubscription(event)

    expect(mockMixpanel.track).toHaveBeenCalledWith(expectedEvent, {})
  })

  it('writes normalized survey properties to Mixpanel.people on submit', async () => {
    const provider = new MixpanelTelemetryProvider()
    await waitForMixpanelInit()

    const normalized = {
      industry: 'tech',
      industry_normalized: 'Software / IT / AI',
      industry_raw: 'tech',
      useCase: 'fun',
      useCase_normalized: 'Personal & Hobby',
      useCase_raw: 'fun'
    }
    mockNormalizeSurveyResponses.mockReturnValueOnce(normalized)

    const responses: SurveyResponses = { industry: 'tech', useCase: 'fun' }
    provider.trackSurvey('submitted', responses)

    expect(mockNormalizeSurveyResponses).toHaveBeenCalledWith(responses)
    expect(mockMixpanel.people.set).toHaveBeenCalledWith(normalized)
  })

  it('does not write to Mixpanel.people for survey "opened"', async () => {
    const provider = new MixpanelTelemetryProvider()
    await waitForMixpanelInit()
    mockMixpanel.people.set.mockClear()

    provider.trackSurvey('opened')

    expect(mockMixpanel.people.set).not.toHaveBeenCalled()
  })

  it('forwards user identification when onUserResolved callback fires with a user id', async () => {
    new MixpanelTelemetryProvider()
    await waitForMixpanelInit()

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
    mockNormalizeSurveyResponses.mockImplementation((responses) => responses)
  })

  type Trackable = (provider: MixpanelTelemetryProvider) => void

  const templateMetadata: TemplateMetadata = { workflow_name: 't' }
  const templateLibraryMetadata: TemplateLibraryMetadata = { source: 'menu' }
  const templateLibraryClosedMetadata: TemplateLibraryClosedMetadata = {
    template_selected: false,
    time_spent_seconds: 0
  }
  const workflowImportMetadata: WorkflowImportMetadata = {
    missing_node_count: 0,
    missing_node_types: []
  }
  const workflowSavedMetadata: WorkflowSavedMetadata = {
    is_app: false,
    is_new: false
  }
  const defaultViewSetMetadata: DefaultViewSetMetadata = {
    default_view: 'graph'
  }
  const enterLinearMetadata: EnterLinearMetadata = {}
  const shareFlowMetadata: ShareFlowMetadata = { step: 'dialog_opened' }
  const executionErrorMetadata: ExecutionErrorMetadata = { jobId: 'job-1' }
  const executionSuccessMetadata: ExecutionSuccessMetadata = { jobId: 'job-1' }
  const authMetadata: AuthMetadata = {}

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
      (p) => p.trackTemplate(templateMetadata),
      TelemetryEvents.TEMPLATE_WORKFLOW_OPENED
    ],
    [
      'trackTemplateLibraryOpened',
      (p) => p.trackTemplateLibraryOpened(templateLibraryMetadata),
      TelemetryEvents.TEMPLATE_LIBRARY_OPENED
    ],
    [
      'trackTemplateLibraryClosed',
      (p) => p.trackTemplateLibraryClosed(templateLibraryClosedMetadata),
      TelemetryEvents.TEMPLATE_LIBRARY_CLOSED
    ],
    [
      'trackWorkflowImported',
      (p) => p.trackWorkflowImported(workflowImportMetadata),
      TelemetryEvents.WORKFLOW_IMPORTED
    ],
    [
      'trackWorkflowSaved',
      (p) => p.trackWorkflowSaved(workflowSavedMetadata),
      TelemetryEvents.WORKFLOW_SAVED
    ],
    [
      'trackDefaultViewSet',
      (p) => p.trackDefaultViewSet(defaultViewSetMetadata),
      TelemetryEvents.DEFAULT_VIEW_SET
    ],
    [
      'trackEnterLinear',
      (p) => p.trackEnterLinear(enterLinearMetadata),
      TelemetryEvents.ENTER_LINEAR_MODE
    ],
    [
      'trackShareFlow',
      (p) => p.trackShareFlow(shareFlowMetadata),
      TelemetryEvents.SHARE_FLOW
    ],
    [
      'trackExecutionError',
      (p) => p.trackExecutionError(executionErrorMetadata),
      TelemetryEvents.EXECUTION_ERROR
    ],
    [
      'trackExecutionSuccess',
      (p) => p.trackExecutionSuccess(executionSuccessMetadata),
      TelemetryEvents.EXECUTION_SUCCESS
    ],
    [
      'trackAuth',
      (p) => p.trackAuth(authMetadata),
      TelemetryEvents.USER_AUTH_COMPLETED
    ],
    [
      'trackSignupOpened',
      (p) => p.trackSignupOpened(),
      TelemetryEvents.USER_SIGN_UP_OPENED
    ]
  ])('%s dispatches %s', async (_name, invoke, expectedEvent) => {
    const provider = new MixpanelTelemetryProvider()
    await waitForMixpanelInit()
    mockMixpanel.track.mockClear()

    invoke(provider)

    expect(mockMixpanel.track).toHaveBeenCalledWith(
      expectedEvent,
      expect.anything()
    )
  })

  it('trackApiCreditTopupButtonPurchaseClicked includes the credit_amount payload', async () => {
    const provider = new MixpanelTelemetryProvider()
    await waitForMixpanelInit()
    mockMixpanel.track.mockClear()

    provider.trackApiCreditTopupButtonPurchaseClicked(42)

    expect(mockMixpanel.track).toHaveBeenCalledWith(
      TelemetryEvents.API_CREDIT_TOPUP_BUTTON_PURCHASE_CLICKED,
      { credit_amount: 42 }
    )
  })

  it('trackRunButton populates RunButtonProperties from the execution context', async () => {
    const provider = new MixpanelTelemetryProvider()
    await waitForMixpanelInit()
    mockMixpanel.track.mockClear()

    provider.trackRunButton({
      subscribe_to_run: true,
      trigger_source: 'button'
    })

    expect(mockMixpanel.track).toHaveBeenCalledWith(
      TelemetryEvents.RUN_BUTTON_CLICKED,
      expect.objectContaining({
        subscribe_to_run: true,
        workflow_type: 'custom',
        trigger_source: 'button',
        view_mode: 'workflow',
        is_app_mode: false
      })
    )
  })

  it('trackWorkflowExecution forwards the latest trigger_source from trackRunButton', async () => {
    const provider = new MixpanelTelemetryProvider()
    await waitForMixpanelInit()
    mockMixpanel.track.mockClear()

    provider.trackRunButton({ trigger_source: 'keybinding' })
    provider.trackWorkflowExecution()

    expect(mockMixpanel.track).toHaveBeenCalledWith(
      TelemetryEvents.EXECUTION_START,
      expect.objectContaining({ trigger_source: 'keybinding' })
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
