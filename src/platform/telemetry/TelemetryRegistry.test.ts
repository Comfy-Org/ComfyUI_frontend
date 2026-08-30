import { describe, expect, it, vi } from 'vitest'

import { TelemetryRegistry } from './TelemetryRegistry'
import type {
  AgentEntryButtonClickedMetadata,
  AgentMessageFeedbackMetadata,
  AgentMessageSentMetadata,
  AgentNodeTaggedMetadata,
  AgentPanelClosedMetadata,
  AgentPanelOpenedMetadata,
  AgentWorkflowAppliedMetadata,
  BillingTelemetryEvent,
  TelemetryProvider
} from './types'

describe('TelemetryRegistry', () => {
  it('dispatches trackSearchQuery to every registered provider', () => {
    const a: TelemetryProvider = { trackSearchQuery: vi.fn() }
    const b: TelemetryProvider = { trackSearchQuery: vi.fn() }
    const registry = new TelemetryRegistry()
    registry.registerProvider(a)
    registry.registerProvider(b)

    registry.trackSearchQuery({
      surface: 'templates',
      query: 'flux',
      query_length: 4,
      result_count: 3,
      has_results: true
    })

    const payload = {
      surface: 'templates',
      query: 'flux',
      query_length: 4,
      result_count: 3,
      has_results: true
    }
    expect(a.trackSearchQuery).toHaveBeenCalledExactlyOnceWith(payload)
    expect(b.trackSearchQuery).toHaveBeenCalledExactlyOnceWith(payload)
  })

  it('dispatches trackBeginCheckout with intent metadata to every provider', () => {
    const a: TelemetryProvider = { trackBeginCheckout: vi.fn() }
    const b: TelemetryProvider = {}
    const registry = new TelemetryRegistry()
    registry.registerProvider(a)
    registry.registerProvider(b)

    const metadata = {
      user_id: 'user-1',
      tier: 'pro' as const,
      cycle: 'monthly' as const,
      checkout_type: 'new' as const,
      payment_intent_source: 'subscribe_to_run' as const
    }
    registry.trackBeginCheckout(metadata)

    expect(a.trackBeginCheckout).toHaveBeenCalledExactlyOnceWith(metadata)
  })

  it('dispatches trackAuthFailed to every registered provider', () => {
    const a: TelemetryProvider = { trackAuthFailed: vi.fn() }
    const b: TelemetryProvider = { trackAuthFailed: vi.fn() }
    const registry = new TelemetryRegistry()
    registry.registerProvider(a)
    registry.registerProvider(b)

    const payload = {
      error_code: 'auth/user-not-found',
      auth_action: 'email_sign_in' as const
    }
    registry.trackAuthFailed(payload)

    expect(a.trackAuthFailed).toHaveBeenCalledExactlyOnceWith(payload)
    expect(b.trackAuthFailed).toHaveBeenCalledExactlyOnceWith(payload)
  })

  it('dispatches unified auth retry outcomes to supporting providers', () => {
    const trackUnifiedAuthRetry = vi.fn()
    const registry = new TelemetryRegistry()
    registry.registerProvider({ trackUnifiedAuthRetry })
    registry.registerProvider({})

    registry.trackUnifiedAuthRetry({
      transport: 'fetch',
      outcome: 'failed',
      final_status: 401,
      failure_reason: 'retry_rejected'
    })

    expect(trackUnifiedAuthRetry).toHaveBeenCalledExactlyOnceWith({
      transport: 'fetch',
      outcome: 'failed',
      final_status: 401,
      failure_reason: 'retry_rejected'
    })
  })

  it('dispatches trackAddApiCreditButtonClicked with its source', () => {
    const provider: TelemetryProvider = {
      trackAddApiCreditButtonClicked: vi.fn()
    }
    const registry = new TelemetryRegistry()
    registry.registerProvider(provider)

    registry.trackAddApiCreditButtonClicked({ source: 'credits_panel' })

    expect(
      provider.trackAddApiCreditButtonClicked
    ).toHaveBeenCalledExactlyOnceWith({ source: 'credits_panel' })
  })

  it('skips providers that do not implement trackSearchQuery', () => {
    const empty: TelemetryProvider = {}
    const registry = new TelemetryRegistry()
    registry.registerProvider(empty)

    expect(() =>
      registry.trackSearchQuery({
        surface: 'settings',
        query: 'theme',
        query_length: 5,
        result_count: 0,
        has_results: false
      })
    ).not.toThrow()
  })

  it('dispatches subscription cancellation telemetry to every registered provider', () => {
    const a: TelemetryProvider = { trackSubscriptionCancellation: vi.fn() }
    const b: TelemetryProvider = { trackSubscriptionCancellation: vi.fn() }
    const registry = new TelemetryRegistry()
    registry.registerProvider(a)
    registry.registerProvider(b)

    const payload = {
      source: 'cancel_plan_menu' as const,
      current_tier: 'standard',
      cycle: 'monthly' as const,
      end_date: '2026-08-01T00:00:00.000Z'
    }
    registry.trackSubscriptionCancellation('flow_opened', payload)

    expect(a.trackSubscriptionCancellation).toHaveBeenCalledExactlyOnceWith(
      'flow_opened',
      payload
    )
    expect(b.trackSubscriptionCancellation).toHaveBeenCalledExactlyOnceWith(
      'flow_opened',
      payload
    )
  })

  it('dispatches resubscribe click telemetry to every registered provider', () => {
    const a: TelemetryProvider = { trackResubscribeClicked: vi.fn() }
    const b: TelemetryProvider = { trackResubscribeClicked: vi.fn() }
    const registry = new TelemetryRegistry()
    registry.registerProvider(a)
    registry.registerProvider(b)

    const payload = { source: 'settings_billing_panel' as const }
    registry.trackResubscribeClicked(payload)

    expect(a.trackResubscribeClicked).toHaveBeenCalledExactlyOnceWith(payload)
    expect(b.trackResubscribeClicked).toHaveBeenCalledExactlyOnceWith(payload)
  })

  it('dispatches trackWorkspaceInviteFailed to every registered provider', () => {
    const a: TelemetryProvider = { trackWorkspaceInviteFailed: vi.fn() }
    const b: TelemetryProvider = { trackWorkspaceInviteFailed: vi.fn() }
    const registry = new TelemetryRegistry()
    registry.registerProvider(a)
    registry.registerProvider(b)

    const payload = {
      source: 'settings_members' as const,
      attempted_count: 3,
      failed_count: 1
    }
    registry.trackWorkspaceInviteFailed(payload)

    expect(a.trackWorkspaceInviteFailed).toHaveBeenCalledExactlyOnceWith(
      payload
    )
    expect(b.trackWorkspaceInviteFailed).toHaveBeenCalledExactlyOnceWith(
      payload
    )
  })

  it('dispatches the same canonical billing event to every provider', () => {
    const a: TelemetryProvider = { trackBillingEvent: vi.fn() }
    const b: TelemetryProvider = { trackBillingEvent: vi.fn() }
    const registry = new TelemetryRegistry()
    registry.registerProvider(a)
    registry.registerProvider(b)

    const event: BillingTelemetryEvent = {
      operation: 'operation',
      stage: 'failed',
      outcome: 'failure',
      billing_op_id: 'op-1',
      operation_type: 'subscription',
      failure_category: 'provider_decline'
    }
    registry.trackBillingEvent(event)

    expect(a.trackBillingEvent).toHaveBeenCalledExactlyOnceWith(event)
    expect(b.trackBillingEvent).toHaveBeenCalledExactlyOnceWith(event)
  })

  it('dispatches trackWidgetFavoriteToggled to every registered provider', () => {
    const a: TelemetryProvider = { trackWidgetFavoriteToggled: vi.fn() }
    const b: TelemetryProvider = { trackWidgetFavoriteToggled: vi.fn() }
    const registry = new TelemetryRegistry()
    registry.registerProvider(a)
    registry.registerProvider(b)

    const payload = {
      node_type: 'CheckpointLoaderSimple',
      widget_name: 'ckpt_name',
      widget_type: 'combo',
      is_favorited: true,
      source: 'right_side_panel' as const
    }
    registry.trackWidgetFavoriteToggled(payload)

    expect(a.trackWidgetFavoriteToggled).toHaveBeenCalledExactlyOnceWith(
      payload
    )
    expect(b.trackWidgetFavoriteToggled).toHaveBeenCalledExactlyOnceWith(
      payload
    )
  })

  describe('agent telemetry dispatch', () => {
    const feedbackMetadata = {
      message_id: 'm1',
      vote: 'up',
      workflow_id: null
    } satisfies AgentMessageFeedbackMetadata
    const panelOpenedMetadata = {
      source: 'topbar_button'
    } satisfies AgentPanelOpenedMetadata
    const panelClosedMetadata = {
      source: 'close_button',
      open_duration_ms: 1200
    } satisfies AgentPanelClosedMetadata
    const entryClickedMetadata = {
      resulting_state: 'opened'
    } satisfies AgentEntryButtonClickedMetadata
    const messageSentMetadata = {
      attachment_count: 1,
      node_tag_count: 2
    } satisfies AgentMessageSentMetadata
    const nodeTaggedMetadata = {
      source: 'mention_picker'
    } satisfies AgentNodeTaggedMetadata
    const workflowAppliedMetadata = {
      workflow_id: 'w1',
      target: 'new_tab'
    } satisfies AgentWorkflowAppliedMetadata

    const cases: Array<{
      method: keyof TelemetryProvider & `trackAgent${string}`
      expected: unknown
      invoke: (registry: TelemetryRegistry) => void
    }> = [
      {
        method: 'trackAgentMessageFeedback',
        expected: { ...feedbackMetadata },
        invoke: (registry) =>
          registry.trackAgentMessageFeedback(feedbackMetadata)
      },
      {
        method: 'trackAgentPanelOpened',
        expected: { ...panelOpenedMetadata },
        invoke: (registry) =>
          registry.trackAgentPanelOpened(panelOpenedMetadata)
      },
      {
        method: 'trackAgentPanelClosed',
        expected: { ...panelClosedMetadata },
        invoke: (registry) =>
          registry.trackAgentPanelClosed(panelClosedMetadata)
      },
      {
        method: 'trackAgentEntryButtonClicked',
        expected: { ...entryClickedMetadata },
        invoke: (registry) =>
          registry.trackAgentEntryButtonClicked(entryClickedMetadata)
      },
      {
        method: 'trackAgentCloseButtonClicked',
        expected: undefined,
        invoke: (registry) => registry.trackAgentCloseButtonClicked()
      },
      {
        method: 'trackAgentMessageSent',
        expected: { ...messageSentMetadata },
        invoke: (registry) =>
          registry.trackAgentMessageSent(messageSentMetadata)
      },
      {
        method: 'trackAgentNodeTagged',
        expected: { ...nodeTaggedMetadata },
        invoke: (registry) => registry.trackAgentNodeTagged(nodeTaggedMetadata)
      },
      {
        method: 'trackAgentAttachButtonClicked',
        expected: undefined,
        invoke: (registry) => registry.trackAgentAttachButtonClicked()
      },
      {
        method: 'trackAgentWorkflowApplied',
        expected: { ...workflowAppliedMetadata },
        invoke: (registry) =>
          registry.trackAgentWorkflowApplied(workflowAppliedMetadata)
      }
    ]

    it.for(cases)(
      'dispatches $method to every registered provider',
      ({ method, expected, invoke }) => {
        const a: TelemetryProvider = { [method]: vi.fn() }
        const b: TelemetryProvider = { [method]: vi.fn() }
        const registry = new TelemetryRegistry()
        registry.registerProvider(a)
        registry.registerProvider(b)

        invoke(registry)

        for (const provider of [a, b]) {
          const spy = provider[method]
          if (expected === undefined) {
            expect(spy).toHaveBeenCalledExactlyOnceWith()
          } else {
            expect(spy).toHaveBeenCalledExactlyOnceWith(expected)
          }
        }
      }
    )
  })
})
