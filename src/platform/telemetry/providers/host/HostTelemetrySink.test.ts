import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TelemetryEvents } from '@/platform/telemetry/types'

import { HostTelemetrySink } from './HostTelemetrySink'

const state = vi.hoisted(() => ({
  capture: vi.fn()
}))

describe('HostTelemetrySink', () => {
  beforeEach(() => {
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
      dock_state: 'docked',
      agent_panel_open: true
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
        dock_state: 'docked',
        agent_panel_open: true
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

  it('forwards subscription cancellation telemetry to the host bridge', () => {
    new HostTelemetrySink().trackSubscriptionCancellation('confirmed', {
      source: 'cancel_plan_menu',
      current_tier: 'standard',
      cycle: 'yearly',
      end_date: '2026-08-01T00:00:00.000Z'
    })

    expect(state.capture).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvents.SUBSCRIPTION_CANCEL_CONFIRMED,
      {
        source: 'cancel_plan_menu',
        current_tier: 'standard',
        cycle: 'yearly',
        end_date: '2026-08-01T00:00:00.000Z'
      }
    )
  })

  it('forwards resubscribe click telemetry to the host bridge', () => {
    new HostTelemetrySink().trackResubscribeClicked({
      source: 'pricing_dialog'
    })

    expect(state.capture).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvents.RESUBSCRIBE_BUTTON_CLICKED,
      { source: 'pricing_dialog' }
    )
  })

  it('forwards add-credit clicks with their source', () => {
    new HostTelemetrySink().trackAddApiCreditButtonClicked({
      source: 'avatar_menu'
    })

    expect(state.capture).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvents.ADD_API_CREDIT_BUTTON_CLICKED,
      { source: 'avatar_menu' }
    )
  })

  it('forwards canonical billing events using the derived name and payload', () => {
    new HostTelemetrySink().trackBillingEvent({
      operation: 'operation',
      stage: 'succeeded',
      outcome: 'success',
      billing_op_id: 'op-1',
      operation_type: 'subscription',
      tier: 'pro',
      cycle: 'monthly',
      checkout_type: 'new'
    })

    expect(state.capture).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvents.BILLING_OPERATION_SUCCEEDED,
      {
        operation: 'operation',
        stage: 'succeeded',
        outcome: 'success',
        billing_op_id: 'op-1',
        operation_type: 'subscription',
        tier: 'pro',
        cycle: 'monthly',
        checkout_type: 'new'
      }
    )
  })

  it('forwards billing failures with their failure category', () => {
    new HostTelemetrySink().trackBillingEvent({
      operation: 'topup',
      stage: 'failed',
      outcome: 'failure',
      billing_op_id: 'op-2',
      failure_category: 'provider_decline'
    })

    expect(state.capture).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvents.BILLING_TOPUP_FAILED,
      {
        operation: 'topup',
        stage: 'failed',
        outcome: 'failure',
        billing_op_id: 'op-2',
        failure_category: 'provider_decline'
      }
    )
  })

  it.for([
    {
      name: TelemetryEvents.AGENT_MESSAGE_FEEDBACK,
      track: (sink: HostTelemetrySink) =>
        sink.trackAgentMessageFeedback({
          message_id: 'message-1',
          turn_id: 'message-1',
          vote: 'up',
          workflow_id: 'workflow-1'
        }),
      properties: {
        message_id: 'message-1',
        turn_id: 'message-1',
        vote: 'up',
        workflow_id: 'workflow-1'
      }
    },
    {
      name: TelemetryEvents.AGENT_PANEL_OPENED,
      track: (sink: HostTelemetrySink) =>
        sink.trackAgentPanelOpened({ source: 'topbar_button' }),
      properties: { source: 'topbar_button' }
    },
    {
      name: TelemetryEvents.AGENT_PANEL_CLOSED,
      track: (sink: HostTelemetrySink) =>
        sink.trackAgentPanelClosed({
          source: 'close_button',
          open_duration_ms: 1234
        }),
      properties: { source: 'close_button', open_duration_ms: 1234 }
    },
    {
      name: TelemetryEvents.AGENT_ENTRY_BUTTON_CLICKED,
      track: (sink: HostTelemetrySink) =>
        sink.trackAgentEntryButtonClicked({ resulting_state: 'opened' }),
      properties: { resulting_state: 'opened' }
    },
    {
      name: TelemetryEvents.AGENT_CLOSE_BUTTON_CLICKED,
      track: (sink: HostTelemetrySink) => sink.trackAgentCloseButtonClicked(),
      properties: undefined
    },
    {
      name: TelemetryEvents.AGENT_MESSAGE_SENT,
      track: (sink: HostTelemetrySink) =>
        sink.trackAgentMessageSent({
          attachment_count: 2,
          node_tag_count: 1,
          thread_id: 'thread-1',
          workflow_id: 'workflow-1',
          client_message_id: 'client-message-1',
          input_method: 'suggestion'
        }),
      properties: {
        attachment_count: 2,
        node_tag_count: 1,
        thread_id: 'thread-1',
        workflow_id: 'workflow-1',
        client_message_id: 'client-message-1',
        input_method: 'suggestion'
      }
    },
    {
      name: TelemetryEvents.AGENT_MESSAGE_SENT,
      track: (sink: HostTelemetrySink) =>
        sink.trackAgentMessageSent({
          attachment_count: 0,
          node_tag_count: 0,
          thread_id: null,
          workflow_id: null,
          client_message_id: 'client-message-2',
          input_method: 'typed'
        }),
      properties: {
        attachment_count: 0,
        node_tag_count: 0,
        thread_id: null,
        workflow_id: null,
        client_message_id: 'client-message-2',
        input_method: 'typed'
      }
    },
    {
      name: TelemetryEvents.AGENT_CONSENT_SHOWN,
      track: (sink: HostTelemetrySink) =>
        sink.trackAgentConsentShown({ trigger: 'first_load' }),
      properties: { trigger: 'first_load' }
    },
    {
      name: TelemetryEvents.AGENT_CONSENT_RESOLVED,
      track: (sink: HostTelemetrySink) =>
        sink.trackAgentConsentResolved({ decision: 'accepted' }),
      properties: { decision: 'accepted' }
    },
    {
      name: TelemetryEvents.AGENT_ONBOARDING_SHOWN,
      track: (sink: HostTelemetrySink) => sink.trackAgentOnboardingShown(),
      properties: undefined
    },
    {
      name: TelemetryEvents.AGENT_ONBOARDING_STEP,
      track: (sink: HostTelemetrySink) =>
        sink.trackAgentOnboardingStep({ step: 4, action: 'finish' }),
      properties: { step: 4, action: 'finish' }
    },
    {
      name: TelemetryEvents.AGENT_NODE_TAGGED,
      track: (sink: HostTelemetrySink) =>
        sink.trackAgentNodeTagged({ source: 'mention_picker' }),
      properties: { source: 'mention_picker' }
    },
    {
      name: TelemetryEvents.AGENT_ATTACH_BUTTON_CLICKED,
      track: (sink: HostTelemetrySink) =>
        sink.trackAgentAttachButtonClicked({ method: 'drag_drop' }),
      properties: { method: 'drag_drop' }
    },
    {
      name: TelemetryEvents.AGENT_STOP_CLICKED,
      track: (sink: HostTelemetrySink) =>
        sink.trackAgentStopClicked({
          method: 'button',
          turn_id: 'turn-1',
          turn_elapsed_ms: 250
        }),
      properties: {
        method: 'button',
        turn_id: 'turn-1',
        turn_elapsed_ms: 250
      }
    },
    {
      name: TelemetryEvents.AGENT_WORKFLOW_BOUND,
      track: (sink: HostTelemetrySink) =>
        sink.trackAgentWorkflowBound({
          thread_id: 'thread-1',
          workflow_id: 'workflow-2',
          prev_workflow_id: 'workflow-1',
          bind_source: 'active_tab'
        }),
      properties: {
        thread_id: 'thread-1',
        workflow_id: 'workflow-2',
        prev_workflow_id: 'workflow-1',
        bind_source: 'active_tab'
      }
    },
    {
      name: TelemetryEvents.AGENT_RUN_APPROVAL_SHOWN,
      track: (sink: HostTelemetrySink) =>
        sink.trackAgentRunApprovalShown({
          turn_id: 'turn-1',
          workflow_id: 'workflow-1'
        }),
      properties: { turn_id: 'turn-1', workflow_id: 'workflow-1' }
    },
    {
      name: TelemetryEvents.AGENT_RUN_APPROVAL_RESOLVED,
      track: (sink: HostTelemetrySink) =>
        sink.trackAgentRunApprovalResolved({
          decision: 'cancel',
          time_to_decide_ms: 300
        }),
      properties: { decision: 'cancel', time_to_decide_ms: 300 }
    },
    {
      name: TelemetryEvents.AGENT_RUN_MODE_CHANGED,
      track: (sink: HostTelemetrySink) =>
        sink.trackAgentRunModeChanged({ from: 'ask_approval', to: 'auto' }),
      properties: { from: 'ask_approval', to: 'auto' }
    },
    {
      name: TelemetryEvents.AGENT_THREAD_STARTED,
      track: (sink: HostTelemetrySink) =>
        sink.trackAgentThreadStarted({ source: 'new_chat_button' }),
      properties: { source: 'new_chat_button' }
    },
    {
      name: TelemetryEvents.AGENT_WORKFLOW_APPLIED,
      track: (sink: HostTelemetrySink) =>
        sink.trackAgentWorkflowApplied({
          workflow_id: 'workflow-1',
          target: 'active_tab_switch'
        }),
      properties: {
        workflow_id: 'workflow-1',
        target: 'active_tab_switch'
      }
    },
    {
      name: TelemetryEvents.AGENT_CONSENT_NOT_OFFERED,
      track: (sink: HostTelemetrySink) =>
        sink.trackAgentConsentNotOffered({ reason: 'tour_active' }),
      properties: { reason: 'tour_active' }
    },
    {
      name: TelemetryEvents.AGENT_ONBOARDING_NOT_SHOWN,
      track: (sink: HostTelemetrySink) =>
        sink.trackAgentOnboardingNotShown({
          reason: 'target_missing',
          step: 2
        }),
      properties: { reason: 'target_missing', step: 2 }
    }
  ])('forwards $name to the host bridge', ({ name, track, properties }) => {
    track(new HostTelemetrySink())

    expect(state.capture).toHaveBeenCalledExactlyOnceWith(name, properties)
  })

  it('forwards link dedup drops to the host bridge', () => {
    new HostTelemetrySink().trackLinkDedupDrop({
      droppedLinkId: 7,
      survivorLinkId: 3,
      target: '12:0'
    })

    expect(state.capture).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvents.LINK_DEDUP_DROP,
      {
        droppedLinkId: 7,
        survivorLinkId: 3,
        target: '12:0'
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
})
