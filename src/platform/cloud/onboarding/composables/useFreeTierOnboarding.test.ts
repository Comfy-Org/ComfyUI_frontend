import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFreeTierOnboarding } from '@/platform/cloud/onboarding/composables/useFreeTierOnboarding'
import { HAS_ACCOUNT_KEY } from '@/stores/firebaseAuthStore'

vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfig: { value: { free_tier_credits: 50 } }
}))

describe('useFreeTierOnboarding', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('showFreeTierBadge', () => {
    it('returns true when neither key exists in localStorage', () => {
      const { showFreeTierBadge } = useFreeTierOnboarding()
      expect(showFreeTierBadge.value).toBe(true)
    })

    it('returns false when HAS_ACCOUNT_KEY is set', () => {
      localStorage.setItem(HAS_ACCOUNT_KEY, '1')
      const { showFreeTierBadge } = useFreeTierOnboarding()
      expect(showFreeTierBadge.value).toBe(false)
    })

    it('returns false when Comfy.PreviousWorkflow is set', () => {
      localStorage.setItem('Comfy.PreviousWorkflow', 'default.json')
      const { showFreeTierBadge } = useFreeTierOnboarding()
      expect(showFreeTierBadge.value).toBe(false)
    })
  })

  describe('showEmailForm', () => {
    it('starts as false', () => {
      const { showEmailForm } = useFreeTierOnboarding()
      expect(showEmailForm.value).toBe(false)
    })

    it('switchToEmailForm sets it to true', () => {
      const { showEmailForm, switchToEmailForm } = useFreeTierOnboarding()
      switchToEmailForm()
      expect(showEmailForm.value).toBe(true)
    })

    it('switchToSocialLogin sets it back to false', () => {
      const { showEmailForm, switchToEmailForm, switchToSocialLogin } =
        useFreeTierOnboarding()
      switchToEmailForm()
      switchToSocialLogin()
      expect(showEmailForm.value).toBe(false)
    })
  })

  describe('freeTierCredits', () => {
    it('returns value from remote config', () => {
      const { freeTierCredits } = useFreeTierOnboarding()
      expect(freeTierCredits.value).toBe(50)
    })
  })
})
