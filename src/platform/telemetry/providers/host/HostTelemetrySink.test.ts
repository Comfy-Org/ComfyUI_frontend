import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TelemetryEvents } from '@/platform/telemetry/types'

import { HostTelemetrySink } from './HostTelemetrySink'

const state = vi.hoisted(() => ({
  capture: vi.fn()
}))

describe('HostTelemetrySink', () => {
  beforeEach(() => {
    state.capture.mockClear()
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
      is_app_mode: false,
      dock_state: 'docked'
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
        is_app_mode: false,
        dock_state: 'docked'
      }
    )
  })

  it('keeps primitive arrays and drops nested payloads', () => {
    new HostTelemetrySink().trackWorkflowImported({
      missing_node_count: 2,
      missing_node_types: ['MissingA', 'MissingB'],
      missing_node_packs: [
        {
          pack_id: 'pack',
          node_types: ['MissingA']
        }
      ],
      open_source: 'file_drop',
      share_id: 'share-id'
    })

    expect(state.capture).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvents.WORKFLOW_IMPORTED,
      {
        missing_node_count: 2,
        missing_node_types: ['MissingA', 'MissingB'],
        open_source: 'file_drop',
        share_id: 'share-id'
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

  // Activation / auth / monetization funnel events: now forwarded to the host
  // bridge so the desktop-embedded frontend reaches cloud-funnel parity.
  it.for([
    ['trackCanvasReady', { is_new_user: true }, TelemetryEvents.CANVAS_READY],
    [
      'trackOutputViewed',
      { workflow_run_id: 'r1', media_type: 'image', is_first_output: true },
      TelemetryEvents.OUTPUT_VIEWED
    ],
    [
      'trackFirstExecutionCompleted',
      { workflow_run_id: 'r1' },
      TelemetryEvents.FIRST_EXECUTION_COMPLETED
    ],
    [
      'trackAuthMethodSelected',
      { method: 'google', view: 'login' },
      TelemetryEvents.AUTH_METHOD_SELECTED
    ],
    [
      'trackOAuthPopupResult',
      { provider: 'google', result: 'success' },
      TelemetryEvents.OAUTH_POPUP_RESULT
    ],
    [
      'trackAuthFailed',
      { method: 'email', stage: 'firebase' },
      TelemetryEvents.AUTH_FAILED
    ],
    [
      'trackAuthError',
      { method: 'email', is_sign_up: false },
      TelemetryEvents.AUTH_ERROR
    ],
    [
      'trackOnboardingRouted',
      {
        destination: 'survey',
        survey_completed: false,
        has_cloud_status: false
      },
      TelemetryEvents.ONBOARDING_ROUTED
    ],
    [
      'trackPaywallViewed',
      { reason: 'subscription_required' },
      TelemetryEvents.PAYWALL_VIEWED
    ],
    [
      'trackCheckoutViewed',
      { checkout_attempt_id: 'c1', tier: 'pro', cycle: 'monthly' },
      TelemetryEvents.CHECKOUT_VIEWED
    ],
    [
      'trackTemplateCategorySelected',
      { category_id: 'image' },
      TelemetryEvents.TEMPLATE_CATEGORY_SELECTED
    ]
  ] as const)('forwards %s to the host bridge', ([method, metadata, event]) => {
    const sink = new HostTelemetrySink()
    ;(sink[method] as (m: object) => void)(metadata)

    expect(state.capture).toHaveBeenCalledExactlyOnceWith(event, metadata)
  })
})
