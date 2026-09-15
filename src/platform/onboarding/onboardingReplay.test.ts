import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  consumeFirstRunReplayRequest,
  consumeSurveyReplayRequest,
  isFirstRunReplayRequested,
  isSurveyReplayRequested,
  requestOnboardingReplay
} from './onboardingReplay'

const mocks = vi.hoisted<{ isCloud: boolean }>(() => ({ isCloud: true }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mocks.isCloud
  }
}))

describe('onboardingReplay', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mocks.isCloud = true
  })

  describe('replay requests', () => {
    it('are absent until made', () => {
      expect(isSurveyReplayRequested()).toBe(false)
      expect(isFirstRunReplayRequested()).toBe(false)
    })

    it('are both readable once made', () => {
      expect(requestOnboardingReplay()).toBe(true)

      expect(isSurveyReplayRequested()).toBe(true)
      expect(isFirstRunReplayRequested()).toBe(true)
    })

    it('are spent independently, so the gate served first cannot swallow the second', () => {
      requestOnboardingReplay()

      consumeSurveyReplayRequest()

      expect(isSurveyReplayRequested()).toBe(false)
      expect(isFirstRunReplayRequested()).toBe(true)

      consumeFirstRunReplayRequest()

      expect(isFirstRunReplayRequested()).toBe(false)
    })

    it('live in session storage, so they cannot outlive the tab', () => {
      requestOnboardingReplay()

      expect(sessionStorage.getItem('Comfy.OnboardingReplay.Survey')).toBe(
        'true'
      )
      expect(localStorage.getItem('Comfy.OnboardingReplay.Survey')).toBeNull()
    })

    it('report failure when session storage rejects the write', () => {
      vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

      expect(requestOnboardingReplay()).toBe(false)
    })

    it('arm neither gate when only the first write lands', () => {
      // Captured before the spy replaces it, so the surviving write is the real
      // one rather than a re-entry that would consume the throwing case.
      const write = Storage.prototype.setItem.bind(sessionStorage)
      vi.spyOn(sessionStorage, 'setItem').mockImplementation((key, value) => {
        if (key === 'Comfy.OnboardingReplay.FirstRun') {
          throw new Error('QuotaExceededError')
        }
        write(key, value)
      })

      expect(requestOnboardingReplay()).toBe(false)

      expect(isSurveyReplayRequested()).toBe(false)
      expect(isFirstRunReplayRequested()).toBe(false)
    })

    it('arm nothing off cloud, where neither gate exists to serve them', () => {
      mocks.isCloud = false

      expect(requestOnboardingReplay()).toBe(true)

      expect(isSurveyReplayRequested()).toBe(false)
      expect(isFirstRunReplayRequested()).toBe(false)
    })

    it('are still spent when removal fails, so a served gate cannot re-serve forever', () => {
      requestOnboardingReplay()
      vi.spyOn(sessionStorage, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })

      consumeSurveyReplayRequest()

      expect(isSurveyReplayRequested()).toBe(false)
    })
  })
})
