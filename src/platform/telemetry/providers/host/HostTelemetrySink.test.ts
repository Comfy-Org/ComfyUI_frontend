import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TelemetryEvents } from '@/platform/telemetry/types'
import type { SurveyResponses } from '@/platform/telemetry/types'
import type { AuditLog } from '@/services/customerEventsService'

import { HostTelemetrySink } from './HostTelemetrySink'

type ForwardCase = [
  string,
  (sink: HostTelemetrySink) => void,
  (typeof TelemetryEvents)[keyof typeof TelemetryEvents],
  object | undefined
]

const state = vi.hoisted(() => ({
  capture: vi.fn()
}))

const topupMocks = vi.hoisted(() => ({
  startTopupTracking: vi.fn(),
  checkForCompletedTopup: vi.fn().mockReturnValue(true),
  clearTopupTracking: vi.fn()
}))
vi.mock('@/platform/telemetry/topupTracker', () => topupMocks)

const mockNormalizeSurveyResponses = vi.hoisted(() =>
  vi.fn((responses: SurveyResponses) => ({
    ...responses,
    industry_normalized: 'Software / IT / AI'
  }))
)
vi.mock('../../utils/surveyNormalization', () => ({
  normalizeSurveyResponses: mockNormalizeSurveyResponses
}))

describe('HostTelemetrySink', () => {
  beforeEach(() => {
    state.capture.mockClear()
    topupMocks.startTopupTracking.mockClear()
    topupMocks.checkForCompletedTopup.mockClear()
    topupMocks.checkForCompletedTopup.mockReturnValue(true)
    topupMocks.clearTopupTracking.mockClear()
    mockNormalizeSurveyResponses.mockClear()
    window.__comfyDesktop2 = {
      isRemote: () => false,
      Telemetry: {
        capture: state.capture
      }
    }
  })

  afterEach(() => {
    delete window.__comfyDesktop2
  })

  it('forwards run button telemetry to the host bridge', () => {
    new HostTelemetrySink().trackRunButton({
      subscribe_to_run: true,
      workflow_type: 'custom',
      workflow_name: 'Host workflow',
      custom_node_count: 2,
      total_node_count: 4,
      subgraph_count: 1,
      has_api_nodes: true,
      api_node_names: ['LoadImage'],
      has_toolkit_nodes: false,
      toolkit_node_names: [],
      trigger_source: 'button',
      view_mode: 'graph',
      is_app_mode: false
    })

    expect(state.capture).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvents.RUN_BUTTON_CLICKED,
      {
        subscribe_to_run: true,
        workflow_type: 'custom',
        workflow_name: 'Host workflow',
        custom_node_count: 2,
        total_node_count: 4,
        subgraph_count: 1,
        has_api_nodes: true,
        api_node_names: ['LoadImage'],
        has_toolkit_nodes: false,
        toolkit_node_names: [],
        trigger_source: 'button',
        view_mode: 'graph',
        is_app_mode: false
      }
    )
  })

  it('keeps primitive arrays and drops nested payloads', () => {
    new HostTelemetrySink().trackWorkflowImported({
      missing_node_count: 2,
      missing_node_types: ['MissingA', 'MissingB'],
      open_source: 'file_drop'
    })

    expect(state.capture).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvents.WORKFLOW_IMPORTED,
      {
        missing_node_count: 2,
        missing_node_types: ['MissingA', 'MissingB'],
        open_source: 'file_drop'
      }
    )
  })

  it('forwards begin checkout using the existing GA4 event name', () => {
    new HostTelemetrySink().trackBeginCheckout({
      user_id: 'user-id',
      tier: 'pro',
      cycle: 'monthly',
      checkout_type: 'new',
      ecommerce: {
        items: [
          {
            item_name: 'Pro',
            price: 100,
            quantity: 1
          }
        ]
      }
    })

    expect(state.capture).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvents.BEGIN_CHECKOUT,
      {
        user_id: 'user-id',
        tier: 'pro',
        cycle: 'monthly',
        checkout_type: 'new'
      }
    )
  })

  it('does nothing when the host bridge is absent', () => {
    delete window.__comfyDesktop2

    expect(() =>
      new HostTelemetrySink().trackNodeSearch({ query: 'k sampler' })
    ).not.toThrow()
    expect(state.capture).not.toHaveBeenCalled()
  })

  it.for<ForwardCase>([
    [
      'trackSignupOpened',
      (sink: HostTelemetrySink) => sink.trackSignupOpened(),
      TelemetryEvents.USER_SIGN_UP_OPENED,
      undefined
    ],
    [
      'trackAuth',
      (sink: HostTelemetrySink) =>
        sink.trackAuth({
          method: 'google',
          is_new_user: true,
          user_id: 'user-id'
        }),
      TelemetryEvents.USER_AUTH_COMPLETED,
      {
        method: 'google',
        is_new_user: true,
        user_id: 'user-id'
      }
    ],
    [
      'trackUserLoggedIn',
      (sink: HostTelemetrySink) => sink.trackUserLoggedIn(),
      TelemetryEvents.USER_LOGGED_IN,
      undefined
    ],
    [
      'trackSubscription modal',
      (sink: HostTelemetrySink) =>
        sink.trackSubscription('modal_opened', {
          current_tier: 'free',
          reason: 'out_of_credits'
        }),
      TelemetryEvents.SUBSCRIPTION_REQUIRED_MODAL_OPENED,
      {
        current_tier: 'free',
        reason: 'out_of_credits'
      }
    ],
    [
      'trackSubscription subscribe',
      (sink: HostTelemetrySink) =>
        sink.trackSubscription('subscribe_clicked', { current_tier: 'free' }),
      TelemetryEvents.SUBSCRIBE_NOW_BUTTON_CLICKED,
      { current_tier: 'free' }
    ],
    [
      'trackMonthlySubscriptionSucceeded',
      (sink: HostTelemetrySink) =>
        sink.trackMonthlySubscriptionSucceeded({
          user_id: 'user-id',
          checkout_attempt_id: 'attempt-id',
          tier: 'pro',
          cycle: 'monthly',
          checkout_type: 'new',
          value: 100,
          currency: 'USD',
          ecommerce: {
            currency: 'USD',
            value: 100,
            items: [
              {
                item_name: 'Pro',
                item_category: 'subscription',
                price: 100,
                quantity: 1
              }
            ]
          }
        }),
      TelemetryEvents.MONTHLY_SUBSCRIPTION_SUCCEEDED,
      {
        user_id: 'user-id',
        checkout_attempt_id: 'attempt-id',
        tier: 'pro',
        cycle: 'monthly',
        checkout_type: 'new',
        value: 100,
        currency: 'USD'
      }
    ],
    [
      'trackMonthlySubscriptionCancelled',
      (sink: HostTelemetrySink) => sink.trackMonthlySubscriptionCancelled(),
      TelemetryEvents.MONTHLY_SUBSCRIPTION_CANCELLED,
      undefined
    ],
    [
      'trackAddApiCreditButtonClicked',
      (sink: HostTelemetrySink) => sink.trackAddApiCreditButtonClicked(),
      TelemetryEvents.ADD_API_CREDIT_BUTTON_CLICKED,
      undefined
    ],
    [
      'trackApiCreditTopupButtonPurchaseClicked',
      (sink: HostTelemetrySink) =>
        sink.trackApiCreditTopupButtonPurchaseClicked(25),
      TelemetryEvents.API_CREDIT_TOPUP_BUTTON_PURCHASE_CLICKED,
      { credit_amount: 25 }
    ],
    [
      'trackApiCreditTopupSucceeded',
      (sink: HostTelemetrySink) => sink.trackApiCreditTopupSucceeded(),
      TelemetryEvents.API_CREDIT_TOPUP_SUCCEEDED,
      undefined
    ],
    [
      'trackTemplate',
      (sink: HostTelemetrySink) =>
        sink.trackTemplate({
          workflow_name: 'Template',
          template_source: 'library'
        }),
      TelemetryEvents.TEMPLATE_WORKFLOW_OPENED,
      {
        workflow_name: 'Template',
        template_source: 'library'
      }
    ],
    [
      'trackTemplateLibraryOpened',
      (sink: HostTelemetrySink) =>
        sink.trackTemplateLibraryOpened({ source: 'sidebar' }),
      TelemetryEvents.TEMPLATE_LIBRARY_OPENED,
      { source: 'sidebar' }
    ],
    [
      'trackTemplateLibraryClosed',
      (sink: HostTelemetrySink) =>
        sink.trackTemplateLibraryClosed({
          template_selected: true,
          time_spent_seconds: 3
        }),
      TelemetryEvents.TEMPLATE_LIBRARY_CLOSED,
      {
        template_selected: true,
        time_spent_seconds: 3
      }
    ],
    [
      'trackWorkflowOpened',
      (sink: HostTelemetrySink) =>
        sink.trackWorkflowOpened({
          missing_node_count: 1,
          missing_node_types: ['MissingNode'],
          open_source: 'file_button'
        }),
      TelemetryEvents.WORKFLOW_OPENED,
      {
        missing_node_count: 1,
        missing_node_types: ['MissingNode'],
        open_source: 'file_button'
      }
    ],
    [
      'trackWorkflowSaved',
      (sink: HostTelemetrySink) =>
        sink.trackWorkflowSaved({ is_app: true, is_new: false }),
      TelemetryEvents.WORKFLOW_SAVED,
      { is_app: true, is_new: false }
    ],
    [
      'trackDefaultViewSet',
      (sink: HostTelemetrySink) =>
        sink.trackDefaultViewSet({ default_view: 'app' }),
      TelemetryEvents.DEFAULT_VIEW_SET,
      { default_view: 'app' }
    ],
    [
      'trackEnterLinear',
      (sink: HostTelemetrySink) => sink.trackEnterLinear({ source: 'toolbar' }),
      TelemetryEvents.ENTER_LINEAR_MODE,
      { source: 'toolbar' }
    ],
    [
      'trackShareFlow',
      (sink: HostTelemetrySink) =>
        sink.trackShareFlow({ step: 'link_created', source: 'app_mode' }),
      TelemetryEvents.SHARE_FLOW,
      { step: 'link_created', source: 'app_mode' }
    ],
    [
      'trackPageVisibilityChanged',
      (sink: HostTelemetrySink) =>
        sink.trackPageVisibilityChanged({ visibility_state: 'visible' }),
      TelemetryEvents.PAGE_VISIBILITY_CHANGED,
      { visibility_state: 'visible' }
    ],
    [
      'trackTabCount',
      (sink: HostTelemetrySink) => sink.trackTabCount({ tab_count: 2 }),
      TelemetryEvents.TAB_COUNT_TRACKING,
      { tab_count: 2 }
    ],
    [
      'trackNodeSearch',
      (sink: HostTelemetrySink) => sink.trackNodeSearch({ query: 'ksampler' }),
      TelemetryEvents.NODE_SEARCH,
      { query: 'ksampler' }
    ],
    [
      'trackNodeSearchResultSelected',
      (sink: HostTelemetrySink) =>
        sink.trackNodeSearchResultSelected({
          node_type: 'KSampler',
          last_query: 'sampler'
        }),
      TelemetryEvents.NODE_SEARCH_RESULT_SELECTED,
      { node_type: 'KSampler', last_query: 'sampler' }
    ],
    [
      'trackTemplateFilterChanged',
      (sink: HostTelemetrySink) =>
        sink.trackTemplateFilterChanged({
          selected_models: ['flux'],
          selected_use_cases: ['image'],
          selected_runs_on: ['local'],
          sort_by: 'popular',
          filtered_count: 4,
          total_count: 12
        }),
      TelemetryEvents.TEMPLATE_FILTER_CHANGED,
      {
        selected_models: ['flux'],
        selected_use_cases: ['image'],
        selected_runs_on: ['local'],
        sort_by: 'popular',
        filtered_count: 4,
        total_count: 12
      }
    ],
    [
      'trackHelpCenterOpened',
      (sink: HostTelemetrySink) =>
        sink.trackHelpCenterOpened({ source: 'menu' }),
      TelemetryEvents.HELP_CENTER_OPENED,
      { source: 'menu' }
    ],
    [
      'trackHelpResourceClicked',
      (sink: HostTelemetrySink) =>
        sink.trackHelpResourceClicked({
          resource_type: 'docs',
          is_external: true,
          source: 'help_center'
        }),
      TelemetryEvents.HELP_RESOURCE_CLICKED,
      {
        resource_type: 'docs',
        is_external: true,
        source: 'help_center'
      }
    ],
    [
      'trackHelpCenterClosed',
      (sink: HostTelemetrySink) =>
        sink.trackHelpCenterClosed({ time_spent_seconds: 5 }),
      TelemetryEvents.HELP_CENTER_CLOSED,
      { time_spent_seconds: 5 }
    ],
    [
      'trackWorkflowCreated',
      (sink: HostTelemetrySink) =>
        sink.trackWorkflowCreated({
          workflow_type: 'blank',
          previous_workflow_had_nodes: false
        }),
      TelemetryEvents.WORKFLOW_CREATED,
      {
        workflow_type: 'blank',
        previous_workflow_had_nodes: false
      }
    ],
    [
      'trackWorkflowExecution',
      (sink: HostTelemetrySink) => sink.trackWorkflowExecution(),
      TelemetryEvents.EXECUTION_START,
      undefined
    ],
    [
      'trackExecutionError',
      (sink: HostTelemetrySink) =>
        sink.trackExecutionError({
          jobId: 'job-id',
          nodeId: 'node-id',
          nodeType: 'KSampler',
          error: 'failed'
        }),
      TelemetryEvents.EXECUTION_ERROR,
      {
        jobId: 'job-id',
        nodeId: 'node-id',
        nodeType: 'KSampler',
        error: 'failed'
      }
    ],
    [
      'trackExecutionSuccess',
      (sink: HostTelemetrySink) =>
        sink.trackExecutionSuccess({ jobId: 'job-id' }),
      TelemetryEvents.EXECUTION_SUCCESS,
      { jobId: 'job-id' }
    ],
    [
      'trackSettingChanged',
      (sink: HostTelemetrySink) =>
        sink.trackSettingChanged({
          setting_id: 'Comfy.Test',
          previous_value: 'off',
          new_value: 'on'
        }),
      TelemetryEvents.SETTING_CHANGED,
      {
        setting_id: 'Comfy.Test',
        previous_value: 'off',
        new_value: 'on'
      }
    ],
    [
      'trackUiButtonClicked',
      (sink: HostTelemetrySink) =>
        sink.trackUiButtonClicked({ button_id: 'comfy_logo' }),
      TelemetryEvents.UI_BUTTON_CLICKED,
      { button_id: 'comfy_logo' }
    ],
    [
      'trackPageView',
      (sink: HostTelemetrySink) =>
        sink.trackPageView('Settings', {
          path: '/settings',
          title: 'Settings'
        }),
      TelemetryEvents.PAGE_VIEW,
      {
        page_name: 'Settings',
        path: '/settings',
        title: 'Settings'
      }
    ]
  ])('forwards %s to the host bridge', ([_, track, event, properties]) => {
    track(new HostTelemetrySink())

    expect(state.capture).toHaveBeenCalledExactlyOnceWith(event, properties)
  })

  it.for<
    [
      'opened' | 'submitted',
      (typeof TelemetryEvents)[keyof typeof TelemetryEvents]
    ]
  >([
    ['opened' as const, TelemetryEvents.USER_SURVEY_OPENED],
    ['submitted' as const, TelemetryEvents.USER_SURVEY_SUBMITTED]
  ])('normalizes survey responses for %s events', ([stage, event]) => {
    const responses = { industry: 'software' }

    new HostTelemetrySink().trackSurvey(stage, responses)

    expect(mockNormalizeSurveyResponses).toHaveBeenCalledExactlyOnceWith(
      responses
    )
    expect(state.capture).toHaveBeenCalledExactlyOnceWith(event, {
      industry: 'software',
      industry_normalized: 'Software / IT / AI'
    })
  })

  it('forwards survey events without responses', () => {
    new HostTelemetrySink().trackSurvey('opened')

    expect(mockNormalizeSurveyResponses).not.toHaveBeenCalled()
    expect(state.capture).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvents.USER_SURVEY_OPENED,
      undefined
    )
  })

  it.for<
    [
      'opened' | 'requested' | 'completed',
      (typeof TelemetryEvents)[keyof typeof TelemetryEvents]
    ]
  >([
    ['opened' as const, TelemetryEvents.USER_EMAIL_VERIFY_OPENED],
    ['requested' as const, TelemetryEvents.USER_EMAIL_VERIFY_REQUESTED],
    ['completed' as const, TelemetryEvents.USER_EMAIL_VERIFY_COMPLETED]
  ])('forwards email verification %s events', ([stage, event]) => {
    new HostTelemetrySink().trackEmailVerification(stage)

    expect(state.capture).toHaveBeenCalledExactlyOnceWith(event, undefined)
  })

  it('delegates topup tracking to the shared tracker', () => {
    const events = [{ event_type: 'credit_added' }] as AuditLog[]
    const sink = new HostTelemetrySink()

    sink.startTopupTracking()
    const completed = sink.checkForCompletedTopup(events)
    sink.clearTopupTracking()

    expect(topupMocks.startTopupTracking).toHaveBeenCalledOnce()
    expect(topupMocks.checkForCompletedTopup).toHaveBeenCalledExactlyOnceWith(
      events
    )
    expect(completed).toBe(true)
    expect(topupMocks.clearTopupTracking).toHaveBeenCalledOnce()
  })
})
