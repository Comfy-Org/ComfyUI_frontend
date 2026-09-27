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
const OWNER_ID = 'account-a'

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
      expect(isSurveyReplayRequested(OWNER_ID)).toBe(false)
      expect(isFirstRunReplayRequested(OWNER_ID)).toBe(false)
    })

    it('are both readable once made', () => {
      expect(requestOnboardingReplay(OWNER_ID)).toBe(true)

      expect(isSurveyReplayRequested(OWNER_ID)).toBe(true)
      expect(isFirstRunReplayRequested(OWNER_ID)).toBe(true)
    })

    it('are spent independently, so the gate served first cannot swallow the second', () => {
      requestOnboardingReplay(OWNER_ID)

      consumeSurveyReplayRequest(OWNER_ID)

      expect(isSurveyReplayRequested(OWNER_ID)).toBe(false)
      expect(isFirstRunReplayRequested(OWNER_ID)).toBe(true)

      consumeFirstRunReplayRequest(OWNER_ID)

      expect(isFirstRunReplayRequested(OWNER_ID)).toBe(false)
    })

    it('live in session storage, so they cannot outlive the tab', () => {
      requestOnboardingReplay(OWNER_ID)

      expect(sessionStorage.getItem('Comfy.OnboardingReplay')).toBe(
        JSON.stringify({ ownerId: OWNER_ID, survey: true, firstRun: true })
      )
      expect(localStorage.getItem('Comfy.OnboardingReplay')).toBeNull()
    })

    it('report failure when session storage rejects the write', () => {
      vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

      expect(requestOnboardingReplay(OWNER_ID)).toBe(false)
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'QuotaExceededError' }),
        { errorType: 'error_writing_onboarding_replay_request' }
      )
    })

    it('arms both gates with one atomic write', () => {
      const setItem = vi.spyOn(sessionStorage, 'setItem')

      expect(requestOnboardingReplay(OWNER_ID)).toBe(true)

      expect(setItem).toHaveBeenCalledOnce()
    })

    it('arm nothing off cloud, where neither gate exists to serve them', () => {
      mocks.isCloud = false

      expect(requestOnboardingReplay(OWNER_ID)).toBe(true)

      expect(isSurveyReplayRequested(OWNER_ID)).toBe(false)
      expect(isFirstRunReplayRequested(OWNER_ID)).toBe(false)
    })

    it('records both gates as spent without relying on removal', () => {
      requestOnboardingReplay(OWNER_ID)
      vi.spyOn(sessionStorage, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })

      consumeSurveyReplayRequest(OWNER_ID)
      consumeFirstRunReplayRequest(OWNER_ID)

      expect(isSurveyReplayRequested(OWNER_ID)).toBe(false)
      expect(isFirstRunReplayRequested(OWNER_ID)).toBe(false)
    })

    it('restores only the survey gate after navigation fails', () => {
      requestOnboardingReplay(OWNER_ID)
      consumeSurveyReplayRequest(OWNER_ID)
      consumeFirstRunReplayRequest(OWNER_ID)

      restoreSurveyReplayRequest(OWNER_ID)

      expect(isSurveyReplayRequested(OWNER_ID)).toBe(true)
      expect(isFirstRunReplayRequested(OWNER_ID)).toBe(false)
    })

    it('discards malformed replay records', () => {
      sessionStorage.setItem('Comfy.OnboardingReplay', '{}')

      expect(isSurveyReplayRequested(OWNER_ID)).toBe(false)
      expect(sessionStorage.getItem('Comfy.OnboardingReplay')).toBeNull()
    })

    it('discards replay requests owned by another account', () => {
      requestOnboardingReplay(OWNER_ID)

      expect(isSurveyReplayRequested('account-b')).toBe(false)
      expect(sessionStorage.getItem('Comfy.OnboardingReplay')).toBeNull()
    })

    it('fails safely when replay storage cannot be read', () => {
      vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })

      expect(isSurveyReplayRequested(OWNER_ID)).toBe(false)
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'SecurityError' }),
        { errorType: 'error_reading_onboarding_replay_request' }
      )
    })

    it('fails safely when replay JSON is invalid', () => {
      sessionStorage.setItem('Comfy.OnboardingReplay', '{')

      expect(isSurveyReplayRequested(OWNER_ID)).toBe(false)
      expect(reportError).toHaveBeenCalledWith(expect.any(SyntaxError), {
        errorType: 'error_reading_onboarding_replay_request'
      })
    })
  })
})
