import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'

import { useEduPricing } from '@/platform/cloud/subscription/composables/useEduPricing'

// Plain (non-reactive) hoisted holder: `useEduPricing` pulls in the real
// teamWorkspaceStore, whose transitive authStore import reads `isCloud` at
// module-evaluation time — before a normal top-level `const` would exist.
// `vi.hoisted` runs before that import graph, but its factory can't call into
// `vue`, so this stays a plain object; `isCloud` is read fresh inside the
// computed each time regardless of its own reactivity.
const { mockIsCloud } = vi.hoisted(() => ({
  mockIsCloud: { value: true }
}))
// Real reactivity primitives: `flags` is a `reactive()` object in production
// (mirrored here so `flags.eduPricingEnabled` registers as a tracked
// dependency even when short-circuit evaluation skips later operands), and
// `isEduCustomer` backs a `computed()` inside the mocked useSubscription.
const mockFlags = reactive({ eduPricingEnabled: false })
const mockIsEduCustomer = ref(false)

vi.mock<unknown>(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () => ({
    flags: mockFlags
  })
}))

vi.mock<unknown>(
  import('@/platform/cloud/subscription/composables/useSubscription'),
  () => ({
    useSubscription: () => ({
      isEduCustomer: computed(() => mockIsEduCustomer.value)
    })
  })
)

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

describe('useEduPricing', () => {
  afterEach(() => {
    localStorage.removeItem('ff:edu_customer')
    mockIsCloud.value = true
    mockFlags.eduPricingEnabled = false
    mockIsEduCustomer.value = false
  })

  describe('isEduPricingActive', () => {
    it('is inactive unless both the flag and the customer marker are set', () => {
      const { isEduPricingActive } = useEduPricing()

      mockFlags.eduPricingEnabled = false
      mockIsEduCustomer.value = true
      expect(isEduPricingActive.value).toBe(false)

      mockFlags.eduPricingEnabled = true
      mockIsEduCustomer.value = false
      expect(isEduPricingActive.value).toBe(false)

      mockFlags.eduPricingEnabled = true
      mockIsEduCustomer.value = true
      expect(isEduPricingActive.value).toBe(true)
    })

    it('is inactive off cloud builds', () => {
      mockIsCloud.value = false
      mockFlags.eduPricingEnabled = true
      mockIsEduCustomer.value = true

      const { isEduPricingActive } = useEduPricing()
      expect(isEduPricingActive.value).toBe(false)
    })

    it('dev override fakes the customer marker', () => {
      mockFlags.eduPricingEnabled = true
      mockIsEduCustomer.value = false
      localStorage.setItem('ff:edu_customer', 'true')

      const { isEduPricingActive } = useEduPricing()
      expect(isEduPricingActive.value).toBe(true)
    })
  })

  describe('isTeamEduEligible', () => {
    // The backing field (a workspace member's is_edu) isn't exposed by any
    // API yet — a separate, not-yet-shipped backend PR — so with the real
    // store's default empty member list this reads as false even with the
    // flag on. teamWorkspaceStore.test.ts pins the member-mapping half of the
    // wiring (`fetchMembers updates active workspace members`), and
    // UnifiedPricingTable.test.ts exercises the true branch once eligible.
    it('is false by default (flag on, no active-workspace member data)', async () => {
      mockFlags.eduPricingEnabled = true
      const { useTeamWorkspaceStore } =
        await import('@/platform/workspace/stores/teamWorkspaceStore')
      expect(useTeamWorkspaceStore().members).toEqual([])

      const { isTeamEduEligible } = useEduPricing()
      expect(isTeamEduEligible.value).toBe(false)
    })

    it('is false when the flag is off', () => {
      mockFlags.eduPricingEnabled = false

      const { isTeamEduEligible } = useEduPricing()
      expect(isTeamEduEligible.value).toBe(false)
    })

    it('is false off cloud builds', () => {
      mockIsCloud.value = false
      mockFlags.eduPricingEnabled = true

      const { isTeamEduEligible } = useEduPricing()
      expect(isTeamEduEligible.value).toBe(false)
    })
  })
})
