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
      api_node_count: 1,
      total_node_count: 4,
      subgraph_count: 1,
      has_api_nodes: true,
      api_node_names: ['LoadImage'],
      has_toolkit_nodes: false,
      toolkit_node_names: [],
      trigger_source: 'button',
      execution_scope: 'full',
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
        api_node_count: 1,
        total_node_count: 4,
        subgraph_count: 1,
        has_api_nodes: true,
        api_node_names: ['LoadImage'],
        has_toolkit_nodes: false,
        toolkit_node_names: [],
        trigger_source: 'button',
        execution_scope: 'full',
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

  it('does nothing when the host bridge is absent', () => {
    delete window.__comfyDesktop2

    expect(() =>
      new HostTelemetrySink().trackNodeSearch({ query: 'k sampler' })
    ).not.toThrow()
    expect(state.capture).not.toHaveBeenCalled()
  })
})
