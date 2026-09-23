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
  it('re-opens coachmarks with one server write and updates the local value', async () => {
    const settingStore = useSettingStore()
    settingStore.settingValues[TOUR_SEEN_SETTING] = ['appMode']

    await resetOnboardingState()

    expect(api.storeSetting).toHaveBeenCalledOnce()
    expect(api.storeSetting).toHaveBeenCalledWith(TOUR_SEEN_SETTING, [])
    expect(settingStore.settingValues[TOUR_SEEN_SETTING]).toEqual([])
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

  it('reports a non-ok settings response as failed', async () => {
    vi.spyOn(api, 'storeSetting').mockResolvedValue(response(401))

    await expect(resetOnboardingState()).resolves.toEqual({
      status: 'failed',
      cause: expect.stringContaining('Failed to clear seen onboarding tours')
    })
  })

  it('requests no replay when the write is rejected, so a failed reset stays inert', async () => {
    vi.spyOn(api, 'storeSetting').mockResolvedValue(response(500))

    await expect(resetOnboardingState()).resolves.toMatchObject({
      status: 'failed'
    })

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

    await expect(resetOnboardingState()).resolves.toMatchObject({
      status: 'failed',
      cause: expect.objectContaining({ message: 'Fetch timeout' })
    })

    expect(isSurveyReplayRequested()).toBe(false)
    expect(isFirstRunReplayRequested()).toBe(false)
  })

  it('fails when the replay cannot be recorded', async () => {
    vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    await expect(resetOnboardingState()).resolves.toEqual({
      status: 'failed',
      cause: expect.stringContaining('Session storage is unavailable')
    })
  })
})
