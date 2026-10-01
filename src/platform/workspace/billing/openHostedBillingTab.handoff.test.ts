import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTelemetry } from '@/platform/telemetry'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import {
  clearCheckoutJourney,
  resolveCheckoutJourney
} from '@/platform/workspace/utils/checkoutJourney'

import {
  disarmHostedBillingReturnRefresh,
  openHostedBillingTabOutcome
} from './openHostedBillingTab'

vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/composables/billing/useBillingContext'))

interface FakeTab {
  opener: unknown
  location: { href: string }
}

function stubOpenedTab(): FakeTab {
  const tab: FakeTab = { opener: {}, location: { href: '' } }
  vi.stubGlobal(
    'open',
    vi.fn(() => tab)
  )
  return tab
}

function linkParams(tab: FakeTab): Record<string, string> {
  return Object.fromEntries(new URL(tab.location.href).searchParams)
}

describe('the billing-web handoff', () => {
  beforeEach(() => {
    const previousConfig = remoteConfig.value
    remoteConfig.value = {
      hosted_billing_destination: 'billing_web',
      billing_web_url: 'https://billing.comfy.org',
      comfy_cloud_base_url: 'https://cloud.comfy.org'
    }
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'ws-1' })
    return () => {
      disarmHostedBillingReturnRefresh()
      remoteConfig.value = previousConfig
      sessionStorage.clear()
      clearCheckoutJourney()
    }
  })

  it('hands off a restored checkout journey under a fresh id when its stored id cannot ride the link', () => {
    const tab = stubOpenedTab()
    const unreadableId = 'journey/../1'
    sessionStorage.setItem(
      'comfy.checkout.journey',
      JSON.stringify({
        journey_id: unreadableId,
        entered_at: new Date().toISOString(),
        started_at_ms: Date.now(),
        actor_uid: 'user-1',
        workspace_id: 'ws-1',
        entry_flow: 'initial_subscription',
        entry_source: 'pricing',
        intent: 'pricing:standard:yearly',
        assignment_status: 'unavailable'
      })
    )
    const journey = resolveCheckoutJourney({
      actorUid: 'user-1',
      workspaceId: 'ws-1',
      entryFlow: 'initial_subscription',
      entrySource: 'pricing',
      intent: 'pricing:standard:yearly',
      assignment: { status: 'unavailable' }
    })
    assert(journey.status === 'active')

    const outcome = openHostedBillingTabOutcome('checkout', {
      plan: 'standard-yearly',
      journeyId: journey.record.journey_id
    })

    expect(outcome).toBe('opened')
    const sent = linkParams(tab).correlation_id
    expect(sent).toMatch(/^[\w-]{1,128}$/)
    expect(sent).not.toBe(unreadableId)
    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledExactlyOnceWith({
      operation: 'web_handoff',
      stage: 'opened',
      outcome: 'pending',
      intent: 'checkout',
      result: 'opened',
      correlation_id: sent
    })
  })

  it('carries the click-time source and the journey into the billing-web link', () => {
    const tab = stubOpenedTab()
    const handoff = {
      plan: 'standard-yearly',
      source: 'subscribe_to_run',
      journeyId: 'journey-1'
    } as const

    openHostedBillingTabOutcome('checkout', handoff)

    expect(linkParams(tab)).toEqual({
      product: 'comfyui',
      return_to: 'comfyui_workspace',
      plan: 'standard-yearly',
      workspace: 'ws-1',
      correlation_id: 'journey-1',
      source: 'subscribe_to_run'
    })
  })

  it('mints a journey for an entry that has none and reports the one it sent', () => {
    const tab = stubOpenedTab()

    openHostedBillingTabOutcome('payment-methods')

    const params = linkParams(tab)
    expect(params).toEqual({
      product: 'comfyui',
      return_to: 'comfyui_workspace',
      workspace: 'ws-1',
      correlation_id: expect.stringMatching(/^[\w-]{1,128}$/)
    })
    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledExactlyOnceWith({
      operation: 'web_handoff',
      stage: 'opened',
      outcome: 'pending',
      intent: 'payment-methods',
      result: 'opened',
      correlation_id: params.correlation_id
    })
  })

  it('mints a fresh journey for each handoff that has none', () => {
    const tab = stubOpenedTab()

    openHostedBillingTabOutcome('payment-methods')
    const first = linkParams(tab).correlation_id
    openHostedBillingTabOutcome('payment-methods')

    expect(linkParams(tab).correlation_id).not.toBe(first)
  })

  it.for([
    {
      result: 'opened',
      tab: (): FakeTab => ({ opener: {}, location: { href: '' } })
    },
    { result: 'blocked', tab: () => null }
  ] as const)(
    'reports a handoff the browser $result with its intent, source and journey',
    ({ result, tab }) => {
      vi.stubGlobal('open', vi.fn(tab))
      const handoff = {
        plan: 'standard-yearly',
        source: 'agent_paywall',
        journeyId: 'journey-1'
      } as const

      const outcome = openHostedBillingTabOutcome('checkout', handoff)

      expect(outcome).toBe(result)
      expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledExactlyOnceWith(
        {
          operation: 'web_handoff',
          stage: 'opened',
          outcome: 'pending',
          intent: 'checkout',
          result,
          payment_intent_source: 'agent_paywall',
          correlation_id: 'journey-1'
        }
      )
    }
  )

  it('reports no handoff while the server keeps billing on the provider', () => {
    remoteConfig.value = {
      ...remoteConfig.value,
      hosted_billing_destination: 'stripe'
    }
    const open = vi.fn()
    vi.stubGlobal('open', open)
    const handoff = {
      plan: 'standard-yearly',
      source: 'agent_paywall',
      journeyId: 'journey-1'
    } as const

    const outcome = openHostedBillingTabOutcome('checkout', handoff)

    expect(outcome).toBe('unavailable')
    expect(open).not.toHaveBeenCalled()
    expect(useTelemetry()?.trackBillingEvent).not.toHaveBeenCalled()
  })
})
