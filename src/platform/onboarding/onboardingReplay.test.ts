import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'

import {
  consumeOnboardingReplayRequest,
  isOnboardingReplayRequested,
  requestOnboardingReplay,
  resetOnboardingState
} from './onboardingReplay'
import { TOUR_SEEN_SETTING } from './onboardingTours'

const mocks = vi.hoisted<{
  isCloud: boolean
  resetSurvey: ReturnType<typeof vi.fn>
}>(() => ({
  isCloud: true,
  resetSurvey: vi.fn()
}))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mocks.isCloud
  }
}))

vi.mock<unknown>(import('@/platform/cloud/onboarding/auth'), () => ({
  resetSurvey: mocks.resetSurvey
}))

describe('onboardingReplay', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mocks.isCloud = true
    mocks.resetSurvey.mockReset().mockResolvedValue(undefined)
  })

  describe('the replay request', () => {
    it('is absent until it is made', () => {
      expect(isOnboardingReplayRequested()).toBe(false)
    })

    it('is readable once made', () => {
      requestOnboardingReplay()

      expect(isOnboardingReplayRequested()).toBe(true)
    })

    it('is gone once consumed, so one request replays onboarding once', () => {
      requestOnboardingReplay()
      consumeOnboardingReplayRequest()

      expect(isOnboardingReplayRequested()).toBe(false)
    })

    it('survives a reload but not the tab, so it cannot leak to a later session', () => {
      requestOnboardingReplay()

      expect(sessionStorage.getItem('Comfy.OnboardingReplayRequested')).toBe(
        'true'
      )
      expect(localStorage.getItem('Comfy.OnboardingReplayRequested')).toBeNull()
    })
  })

  describe('resetOnboardingState', () => {
    it('re-opens the Getting Started screen and the coachmark tours', async () => {
      const set = vi.spyOn(useSettingStore(), 'set').mockResolvedValue()

      await resetOnboardingState()

      expect(set).toHaveBeenCalledWith('Comfy.TutorialCompleted', false)
      expect(set).toHaveBeenCalledWith(TOUR_SEEN_SETTING, [])
    })

    it('re-opens the cloud signup survey on cloud', async () => {
      vi.spyOn(useSettingStore(), 'set').mockResolvedValue()

      await resetOnboardingState()

      expect(mocks.resetSurvey).toHaveBeenCalled()
    })

    it('leaves the survey alone off cloud, where it does not exist', async () => {
      mocks.isCloud = false
      vi.spyOn(useSettingStore(), 'set').mockResolvedValue()

      await resetOnboardingState()

      expect(mocks.resetSurvey).not.toHaveBeenCalled()
    })

    it('records the replay request so the next boot shows Getting Started', async () => {
      vi.spyOn(useSettingStore(), 'set').mockResolvedValue()

      await resetOnboardingState()

      expect(isOnboardingReplayRequested()).toBe(true)
    })

    it('records no request when a gate fails to reset, so a failed reset is inert', async () => {
      vi.spyOn(useSettingStore(), 'set').mockRejectedValue(
        new Error('settings unavailable')
      )

      await expect(resetOnboardingState()).rejects.toThrow(
        'settings unavailable'
      )
      expect(isOnboardingReplayRequested()).toBe(false)
    })

    it('records no request when the survey fails to reset', async () => {
      vi.spyOn(useSettingStore(), 'set').mockResolvedValue()
      mocks.resetSurvey.mockRejectedValue(new Error('survey unavailable'))

      await expect(resetOnboardingState()).rejects.toThrow('survey unavailable')
      expect(isOnboardingReplayRequested()).toBe(false)
    })
  })
})
