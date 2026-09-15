import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isFirstRunReplayRequested,
  isSurveyReplayRequested
} from '@/platform/onboarding/onboardingReplay'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'

import { resetOnboardingState } from './onboardingReset'
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

beforeEach(() => {
  sessionStorage.clear()
  mocks.isCloud = true
  vi.spyOn(api, 'storeSetting').mockResolvedValue(response(200))
})

describe('resetOnboardingState', () => {
  it('re-opens the coachmark tours', async () => {
    await resetOnboardingState()

    expect(api.storeSetting).toHaveBeenCalledWith(TOUR_SEEN_SETTING, [])
  })

  it('writes no other key, so no further onboarding state can be left half-applied', async () => {
    await resetOnboardingState()

    const keys = vi.mocked(api.storeSetting).mock.calls.map(([key]) => key)
    expect(new Set(keys)).toEqual(new Set([TOUR_SEEN_SETTING]))
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

  it('requests no replay when the write never reaches the server', async () => {
    vi.spyOn(api, 'storeSetting').mockRejectedValue(
      new DOMException('Fetch timeout', 'TimeoutError')
    )

    await expect(resetOnboardingState()).rejects.toThrow('Fetch timeout')

    expect(isSurveyReplayRequested()).toBe(false)
    expect(isFirstRunReplayRequested()).toBe(false)
  })

  it("refreshes the store's copy, which a declined reload would otherwise revert", async () => {
    const settingStore = useSettingStore()
    settingStore.settingValues[TOUR_SEEN_SETTING] = ['appMode']

    await resetOnboardingState()

    expect(settingStore.settingValues[TOUR_SEEN_SETTING]).toEqual([])
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
