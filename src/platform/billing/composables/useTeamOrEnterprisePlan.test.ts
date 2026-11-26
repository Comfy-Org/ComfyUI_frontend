import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useTeamOrEnterprisePlan } from '@/platform/billing/composables/useTeamOrEnterprisePlan'

vi.mock(import('@/platform/billing/composables/useBillingContext'))

function onPlan(
  isTeamPlan: boolean,
  tier: 'STANDARD' | 'PRO' | 'TEAM' | 'ENTERPRISE' | null
) {
  const unplanned = useBillingContext()
  vi.mocked(useBillingContext).mockReturnValue({
    ...unplanned,
    isTeamPlan: computed(() => isTeamPlan),
    tier: computed(() => tier)
  })
}

describe(useTeamOrEnterprisePlan, () => {
  it.for([
    { plan: 'a Team plan', isTeamPlan: true, tier: null, expected: true },
    {
      plan: 'an Enterprise plan',
      isTeamPlan: false,
      tier: 'ENTERPRISE',
      expected: true
    },
    {
      plan: 'an individual plan',
      isTeamPlan: false,
      tier: 'PRO',
      expected: false
    },
    {
      plan: 'a plan that has not loaded',
      isTeamPlan: false,
      tier: null,
      expected: false
    }
  ] as const)(
    'answers $expected on $plan',
    ({ isTeamPlan, tier, expected }) => {
      onPlan(isTeamPlan, tier)

      expect(useTeamOrEnterprisePlan().value).toBe(expected)
    }
  )
})
