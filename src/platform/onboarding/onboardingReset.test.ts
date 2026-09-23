import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isFirstRunReplayRequested,
  isSurveyReplayRequested
} from '@/platform/onboarding/onboardingReplay'
import { firebaseIdentity } from '@/platform/auth/firebaseIdentity'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'

import { resetOnboardingState } from './onboardingReset'
import { TOUR_SEEN_SETTING } from './onboardingTours'

const mocks = vi.hoisted<{ isCloud: boolean }>(() => ({ isCloud: true }))
const OWNER_ID = 'account-a'

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mocks.isCloud
  }
}))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/platform/auth/firebaseIdentity'), { spy: true })

const storeSetting = vi.mocked(api.storeSetting)

function response(status: number): Response {
  return new Response(null, { status })
}

beforeEach(() => {
  mocks.isCloud = true
  vi.mocked(firebaseIdentity.onUserChanged).mockReturnValue(() => undefined)
  vi.mocked(firebaseIdentity.onTokenChanged).mockReturnValue(() => undefined)
  Object.assign(useAuthStore(), { userId: OWNER_ID })
  storeSetting.mockResolvedValue(response(200))
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

    expect(isSurveyReplayRequested(OWNER_ID)).toBe(true)
    expect(isFirstRunReplayRequested(OWNER_ID)).toBe(true)
  })

  it('reports a non-ok settings response as failed', async () => {
    storeSetting.mockResolvedValue(response(401))

    await expect(resetOnboardingState()).resolves.toEqual({
      status: 'failed',
      cause: expect.stringContaining('Failed to clear seen onboarding tours')
    })
  })

  it('requests no replay when the write is rejected, so a failed reset stays inert', async () => {
    storeSetting.mockResolvedValue(response(500))

    await expect(resetOnboardingState()).resolves.toMatchObject({
      status: 'failed'
    })

    expect(isSurveyReplayRequested(OWNER_ID)).toBe(false)
    expect(isFirstRunReplayRequested(OWNER_ID)).toBe(false)
  })

  it('clears the coachmark tours off cloud, where they are the whole of onboarding', async () => {
    mocks.isCloud = false

    await resetOnboardingState()

    expect(storeSetting.mock.calls).toEqual([[TOUR_SEEN_SETTING, []]])
    expect(isSurveyReplayRequested(OWNER_ID)).toBe(false)
    expect(isFirstRunReplayRequested(OWNER_ID)).toBe(false)
  })

  it('requests no replay when the write never reaches the server', async () => {
    storeSetting.mockRejectedValue(
      new DOMException('Fetch timeout', 'TimeoutError')
    )

    await expect(resetOnboardingState()).resolves.toMatchObject({
      status: 'failed',
      cause: expect.objectContaining({ message: 'Fetch timeout' })
    })

    expect(isSurveyReplayRequested(OWNER_ID)).toBe(false)
    expect(isFirstRunReplayRequested(OWNER_ID)).toBe(false)
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
