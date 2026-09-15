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

function response(status: number): Response {
  return new Response(null, { status })
}

describe('onboardingReplay', () => {
  beforeEach(() => {
    sessionStorage.clear()
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
  })

  describe('resetOnboardingState', () => {
    it('re-opens the Getting Started screen and the coachmark tours', async () => {
      await resetOnboardingState()

      expect(api.storeSetting).toHaveBeenCalledWith(
        'Comfy.TutorialCompleted',
        false
      )
      expect(api.storeSetting).toHaveBeenCalledWith(TOUR_SEEN_SETTING, [])
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
        'Failed to store Comfy.TutorialCompleted'
      )
    })

    it('requests no replay when a write is rejected, so a failed reset stays inert', async () => {
      vi.spyOn(api, 'storeSetting').mockResolvedValue(response(500))

      await expect(resetOnboardingState()).rejects.toThrow()

      expect(isSurveyReplayRequested()).toBe(false)
      expect(isFirstRunReplayRequested()).toBe(false)
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
