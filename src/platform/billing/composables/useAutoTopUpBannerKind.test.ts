import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, effectScope } from 'vue'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { receiveServerFact } from '@/platform/serverFacts/serverFact'
import type { AutoReloadSettings } from '@/platform/workspace/api/workspaceApi'

import { useAutoTopUpBannerKind } from './useAutoTopUpBannerKind'
import { useBillingAutoTopUpCard } from './useBillingAutoTopUpCard'
import { useBillingCapabilities } from './useBillingCapabilities'
import { usePausedBanner } from './usePausedBanner'

const distribution = vi.hoisted(() => ({ isCloud: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('./useBillingCapabilities'))
vi.mock(import('./usePausedBanner'))
vi.mock(import('./useBillingAutoTopUpCard'))

interface Scenario {
  isCloud?: boolean
  subscriptionsRequired?: boolean
  isActive?: boolean
  paused?: boolean
  owner?: boolean
  flag?: boolean
  settings?: Pick<AutoReloadSettings, 'status' | 'disabled_reason'>
}

function arrange(scenario: Scenario) {
  distribution.isCloud = scenario.isCloud ?? false
  vi.mocked(useFeatureFlags().flags).autoTopUpEnabled = scenario.flag ?? true
  vi.mocked(useBillingContext).mockReturnValue(
    fromPartial({
      canAccessSubscriptionFeatures: computed(
        () =>
          !(scenario.subscriptionsRequired ?? true) ||
          (scenario.isActive ?? true)
      ),
      subscription: computed(() =>
        fromPartial({ isActive: scenario.isActive ?? true })
      )
    })
  )
  useBillingCapabilities().canManageAutoTopUp = computed(() =>
    receiveServerFact('can_manage_auto_top_up', scenario.owner ?? true)
  )
  vi.mocked(usePausedBanner).mockReturnValue({
    isPaused: computed(() => scenario.paused ?? false)
  })
  vi.mocked(useBillingAutoTopUpCard).mockReturnValue({
    state: computed(() =>
      scenario.settings
        ? { kind: 'loaded', settings: fromPartial(scenario.settings) }
        : { kind: 'loading' }
    ),
    isReady: computed(() => true),
    ensureRead: vi.fn(),
    retry: vi.fn()
  })
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  return scope.run(() => useAutoTopUpBannerKind())!.value
}

const failed = { status: 'failed', disabled_reason: null } as const
const turnedOff = {
  status: 'failed',
  disabled_reason: 'consecutive_declines'
} as const

describe('useAutoTopUpBannerKind', () => {
  it.for([
    {
      name: 'cloud with an active plan',
      scenario: { isCloud: true, settings: failed },
      kind: 'autoTopUpFailed'
    },
    {
      name: 'cloud turned off',
      scenario: { isCloud: true, settings: turnedOff },
      kind: 'autoTopUpOff'
    },
    {
      name: 'cloud where subscriptions are not required and is_active is false',
      scenario: {
        isCloud: true,
        subscriptionsRequired: false,
        isActive: false,
        settings: failed
      },
      kind: null
    },
    {
      name: 'cloud with is_active false',
      scenario: { isCloud: true, isActive: false, settings: failed },
      kind: null
    },
    {
      name: 'local with is_active false',
      scenario: { isActive: false, settings: failed },
      kind: 'autoTopUpFailed'
    },
    {
      name: 'a paused workspace',
      scenario: { isCloud: true, paused: true, settings: failed },
      kind: null
    },
    {
      name: 'a member',
      scenario: { owner: false, settings: failed },
      kind: null
    },
    {
      name: 'the flag off',
      scenario: { flag: false, settings: failed },
      kind: null
    },
    { name: 'a read still loading', scenario: {}, kind: null }
  ] as const satisfies readonly {
    name: string
    scenario: Scenario
    kind: string | null
  }[])('$name -> $kind', ({ scenario, kind }) => {
    expect(arrange(scenario)).toBe(kind)
  })
})
