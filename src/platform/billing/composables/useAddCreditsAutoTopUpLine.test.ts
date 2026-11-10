import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import {
  autoTopUpCardState,
  loadedAutoTopUp
} from '@/platform/billing/composables/__mocks__/useBillingAutoTopUpCard'
import {
  autoTopUpEnabledFact,
  canManageAutoTopUpFact
} from '@/platform/billing/composables/__mocks__/useBillingCapabilities'
import { useAddCreditsAutoTopUpLine } from '@/platform/billing/composables/useAddCreditsAutoTopUpLine'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'

vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@/platform/billing/composables/useBillingAutoTopUpCard'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/workspace/utils/platformLink'), () => ({
  platformLink: (path: string) => `https://platform.test${path}`
}))

function lineFor(
  status: Parameters<typeof loadedAutoTopUp>[0],
  enabled = true
) {
  const capabilities = useBillingCapabilities()
  capabilities.autoTopUpEnabled = autoTopUpEnabledFact(enabled)
  capabilities.canManageAutoTopUp = canManageAutoTopUpFact(true)
  capabilities.autoTopUpSetup = computed(() => ({ state: 'ready' }))
  autoTopUpCardState.value = loadedAutoTopUp(status)
  return useAddCreditsAutoTopUpLine()
}

describe('useAddCreditsAutoTopUpLine', () => {
  it('says auto top-up is on with a link to Billing when the served status is on', () => {
    const { offer, billingUrl } = lineFor('on')

    expect(offer.value).toEqual({ kind: 'on' })
    expect(billingUrl.value).toBe('https://platform.test/profile/billing')
  })

  it.for([
    { name: 'auto top-up is off', status: 'off', enabled: true },
    { name: 'the rollout is off', status: 'on', enabled: false }
  ] as const)('shows nothing when $name', ({ status, enabled }) => {
    expect(lineFor(status, enabled).offer.value).toEqual({ kind: 'hidden' })
  })
})
