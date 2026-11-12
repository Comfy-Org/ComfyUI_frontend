import type { AutoTopUpSetup } from '@comfyorg/ingest-types'
import type { AutoReloadSettings } from '@comfyorg/billing-core'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { useTelemetry } from '@comfyorg/telemetry'
import { billingApi } from '@/platform/billing/api/billingApi'
import {
  autoTopUpEnabledFact,
  canManageAutoTopUpFact
} from '@/platform/billing/composables/__mocks__/useBillingCapabilities'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'

import { useAutoTopUpSetupOffer } from './useAutoTopUpSetupOffer'

vi.mock(import('@/platform/billing/api/billingApi'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/workspace/utils/platformLink'), () => ({
  platformLink: (path: string, correlationId?: string) =>
    `https://platform.test${path}&correlation_id=${correlationId}`
}))

type Served = {
  enabled: boolean
  canManage: boolean
  setup: AutoTopUpSetup | null
  status: AutoReloadSettings['status']
}

const offered: Served = {
  enabled: true,
  canManage: true,
  setup: { state: 'ready' },
  status: 'off'
}

async function serve(served: Partial<Served> = {}) {
  const { enabled, canManage, setup, status } = { ...offered, ...served }
  const capabilities = useBillingCapabilities()
  capabilities.autoTopUpEnabled = autoTopUpEnabledFact(enabled)
  capabilities.canManageAutoTopUp = canManageAutoTopUpFact(canManage)
  capabilities.autoTopUpSetup = computed(() => setup)
  const read = vi.mocked(billingApi.getBillingAutoReload)
  const settings = await read()
  read.mockClear()
  read.mockResolvedValue({ ...settings, status })
  return useAutoTopUpSetupOffer()
}

describe('useAutoTopUpSetupOffer', () => {
  it('offers the Platform Billing setup link to a manager whose auto top-up is off', async () => {
    const { setupUrl } = await serve()

    await expect(setupUrl()).resolves.toMatch(
      /^https:\/\/platform\.test\/profile\/billing\?auto_top_up=setup&correlation_id=/
    )
  })

  it.for<{ name: string; served: Partial<Served> }>([
    { name: 'auto top-up not served', served: { enabled: false } },
    { name: 'no can_manage_auto_top_up', served: { canManage: false } },
    { name: 'no served setup', served: { setup: null } },
    {
      name: 'an unavailable setup',
      served: { setup: { state: 'unavailable' } }
    },
    {
      name: 'a setup frozen for past due',
      served: { setup: { state: 'frozen', reason: 'payment_past_due' } }
    }
  ])(
    'offers nothing, without reading settings, for $name',
    async ({ served }) => {
      const { setupUrl } = await serve(served)

      await expect(setupUrl()).resolves.toBeNull()
      expect(billingApi.getBillingAutoReload).not.toHaveBeenCalled()
    }
  )

  it('offers nothing once auto top-up is already on', async () => {
    const { setupUrl } = await serve({ status: 'on' })

    await expect(setupUrl()).resolves.toBeNull()
  })

  it('fails when the settings read fails, so the dialog closes as before', async () => {
    const { setupUrl } = await serve()
    vi.mocked(billingApi.getBillingAutoReload).mockRejectedValue(
      new TypeError('Failed to fetch')
    )

    await expect(setupUrl()).rejects.toThrow('Failed to fetch')
  })

  it('reports the offer once it is shown, and not when nothing is offered', async () => {
    const billingEvents = vi.mocked(useTelemetry()!.trackBillingEvent)
    const shown = await serve()
    await shown.setupUrl()
    expect(billingEvents).toHaveBeenCalledExactlyOnceWith({
      operation: 'auto_top_up_offer',
      stage: 'viewed',
      outcome: 'pending'
    })

    billingEvents.mockClear()
    const alreadyOn = await serve({ status: 'on' })
    await alreadyOn.setupUrl()
    expect(billingEvents).not.toHaveBeenCalled()
  })

  it('reports Not now as a declined offer', async () => {
    const billingEvents = vi.mocked(useTelemetry()!.trackBillingEvent)
    billingEvents.mockClear()
    const { trackDeclined } = await serve()

    trackDeclined()

    expect(billingEvents).toHaveBeenCalledExactlyOnceWith({
      operation: 'auto_top_up_offer',
      stage: 'declined',
      outcome: 'pending'
    })
  })

  it('reports the Set up click as a Turn on handoff', async () => {
    const { track } = await serve()

    track()

    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'platform_handoff',
        target: 'auto_top_up',
        action: 'turn_on'
      })
    )
  })
})
