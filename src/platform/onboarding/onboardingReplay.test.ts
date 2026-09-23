import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  consumeFirstRunReplayRequest,
  consumeSurveyReplayRequest,
  isFirstRunReplayRequested,
  isSurveyReplayRequested,
  requestOnboardingReplay,
  restoreSurveyReplayRequest
} from './onboardingReplay'

const mocks = vi.hoisted<{ isCloud: boolean }>(() => ({ isCloud: true }))
const reportError = vi.hoisted(() => vi.fn())

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mocks.isCloud
  }
}))

vi.mock(import('@/platform/telemetry/reportError'), () => ({ reportError }))

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

      expect(sessionStorage.getItem('Comfy.OnboardingReplay')).toBe(
        JSON.stringify({ survey: true, firstRun: true })
      )
      expect(localStorage.getItem('Comfy.OnboardingReplay')).toBeNull()
    })

    it('report failure when session storage rejects the write', () => {
      vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

      expect(requestOnboardingReplay()).toBe(false)
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'QuotaExceededError' }),
        { errorType: 'error_writing_onboarding_replay_request' }
      )
    })

    it('arms both gates with one atomic write', () => {
      const setItem = vi.spyOn(sessionStorage, 'setItem')

      expect(requestOnboardingReplay()).toBe(true)

      expect(setItem).toHaveBeenCalledOnce()
    })

    it('arm nothing off cloud, where neither gate exists to serve them', () => {
      mocks.isCloud = false

      expect(requestOnboardingReplay()).toBe(true)

      expect(isSurveyReplayRequested()).toBe(false)
      expect(isFirstRunReplayRequested()).toBe(false)
    })

    it('records both gates as spent without relying on removal', () => {
      requestOnboardingReplay()
      vi.spyOn(sessionStorage, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })

      consumeSurveyReplayRequest()
      consumeFirstRunReplayRequest()

      expect(isSurveyReplayRequested()).toBe(false)
      expect(isFirstRunReplayRequested()).toBe(false)
    })

    it('restores only the survey gate after navigation fails', () => {
      requestOnboardingReplay()
      consumeSurveyReplayRequest()
      consumeFirstRunReplayRequest()

      restoreSurveyReplayRequest()

      expect(isSurveyReplayRequested()).toBe(true)
      expect(isFirstRunReplayRequested()).toBe(false)
    })

    it('discards malformed replay records', () => {
      sessionStorage.setItem('Comfy.OnboardingReplay', '{}')

      expect(isSurveyReplayRequested()).toBe(false)
      expect(sessionStorage.getItem('Comfy.OnboardingReplay')).toBeNull()
    })
  })
})
