import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import {
  consumeFirstRunReplayRequest,
  consumeSurveyReplayRequest,
  isFirstRunReplayRequested,
  isSurveyReplayRequested,
  requestOnboardingReplay,
  resetOnboardingState
} from './onboardingReplay'
import { TOUR_SEEN_SETTING } from './onboardingTours'

const mocks = vi.hoisted<{ isCloud: boolean }>(() => ({ isCloud: true }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mocks.isCloud
  }
}))

function response(status: number): Response {
  return new Response(null, { status })
}

describe('onboardingReplay', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mocks.isCloud = true
    vi.spyOn(api, 'storeSetting').mockResolvedValue(response(200))
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

  describe('resetOnboardingState', () => {
    it('re-opens the coachmark tours', async () => {
      await resetOnboardingState()

      expect(api.storeSetting).toHaveBeenCalledWith(TOUR_SEEN_SETTING, [])
    })

    it('writes nothing else, so no other onboarding state can be left half-applied', async () => {
      await resetOnboardingState()

      expect(api.storeSetting).toHaveBeenCalledTimes(1)
    })

    it('never writes the survey key, whose stored answers a write would destroy', async () => {
      await resetOnboardingState()

      expect(api.storeSetting).not.toHaveBeenCalledWith(
        'onboarding_survey',
        expect.anything()
      )
    })

    it('requests the replay that both gates read', async () => {
      await resetOnboardingState()

      expect(isSurveyReplayRequested()).toBe(true)
      expect(isFirstRunReplayRequested()).toBe(true)
    })

    it('throws on a rejected write, which the settings API resolves rather than rejecting', async () => {
      vi.spyOn(api, 'storeSetting').mockResolvedValue(response(401))

      await expect(resetOnboardingState()).rejects.toThrow(
        'Failed to clear seen onboarding tours'
      )
    })

    it('requests no replay when the write is rejected, so a failed reset stays inert', async () => {
      vi.spyOn(api, 'storeSetting').mockResolvedValue(response(500))

      await expect(resetOnboardingState()).rejects.toThrow()

      expect(isSurveyReplayRequested()).toBe(false)
      expect(isFirstRunReplayRequested()).toBe(false)
    })

    it('clears the coachmark tours off cloud, where they are the whole of onboarding', async () => {
      mocks.isCloud = false

      await resetOnboardingState()

      expect(api.storeSetting).toHaveBeenCalledWith(TOUR_SEEN_SETTING, [])
    })

    it('throws when the replay cannot be recorded, rather than reporting success', async () => {
      vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

      await expect(resetOnboardingState()).rejects.toThrow(
        'Session storage is unavailable'
      )
    })
  })
})
