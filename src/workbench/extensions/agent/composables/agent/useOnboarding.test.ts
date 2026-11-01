import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'

import type { reportError } from '@/platform/telemetry/reportError'

import { AGENT_ONBOARDED_SCOPES_SETTING_ID } from '@/platform/settings/constants/agent'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'

import type { CoachStep } from './useOnboarding'
import type * as OnboardingModule from './useOnboarding'
import {
  adoptSharedOnboardingFlag,
  hasSeenCoach,
  resetCoach,
  scopedOnboardingKey,
  useOnboarding
} from './useOnboarding'

vi.mock(import('@/platform/telemetry/reportError'))

const KEY = 'test.onboarded'
const STEPS: CoachStep[] = Array.from({ length: 4 }, (_, index) => ({
  target: `#target-${index}`,
  title: `Card ${index + 1}`,
  body: `Description ${index + 1}`,
  placement: 'left-center'
}))

describe('useOnboarding', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.spyOn(api, 'storeSetting').mockResolvedValue(new Response())
  })

  it('ignores a settings value that is not a list', () => {
    Object.assign(useSettingStore().settingValues, {
      [AGENT_ONBOARDED_SCOPES_SETTING_ID]: true
    })

    expect(hasSeenCoach(KEY)).toBe(false)
    expect(useOnboarding(STEPS, KEY).active.value).toBe(true)
  })

  it('stays finished on an origin whose localStorage never saw the tour', async () => {
    useOnboarding(STEPS, KEY).finish()
    await nextTick()

    window.localStorage.clear()

    expect(useOnboarding(STEPS, KEY).active.value).toBe(false)
    expect(hasSeenCoach(KEY)).toBe(true)
    await vi.waitFor(() =>
      expect(api.storeSetting).toHaveBeenCalledWith(
        AGENT_ONBOARDED_SCOPES_SETTING_ID,
        [KEY]
      )
    )
    expect(api.storeSetting).toHaveBeenCalledTimes(1)
  })

  it('adds the scope to the scopes already loaded', async () => {
    Object.assign(useSettingStore().settingValues, {
      [AGENT_ONBOARDED_SCOPES_SETTING_ID]: ['other.onboarded']
    })

    useOnboarding(STEPS, KEY).finish()

    await vi.waitFor(() =>
      expect(api.storeSetting).toHaveBeenCalledWith(
        AGENT_ONBOARDED_SCOPES_SETTING_ID,
        ['other.onboarded', KEY]
      )
    )
  })

  it('removes only this scope on restart', async () => {
    Object.assign(useSettingStore().settingValues, {
      [AGENT_ONBOARDED_SCOPES_SETTING_ID]: ['other.onboarded', KEY]
    })

    useOnboarding(STEPS, KEY).restart()

    await vi.waitFor(() =>
      expect(api.storeSetting).toHaveBeenCalledWith(
        AGENT_ONBOARDED_SCOPES_SETTING_ID,
        ['other.onboarded']
      )
    )
  })

  it('copies a completion recorded only in localStorage into settings', async () => {
    localStorage.setItem(KEY, 'true')

    useOnboarding(STEPS, KEY)

    await vi.waitFor(() =>
      expect(api.storeSetting).toHaveBeenCalledWith(
        AGENT_ONBOARDED_SCOPES_SETTING_ID,
        [KEY]
      )
    )
  })

  it('honours a replay requested while no tour is mounted', async () => {
    // The take-the-tour button stays clickable while the coach is deferred by
    // App Mode, so there is no instance to take restart(). Clearing the flag
    // has to survive until the coach next mounts, or the click is dropped.
    const finished = useOnboarding(STEPS, KEY)
    finished.finish()
    await nextTick()

    resetCoach(KEY)

    expect(useOnboarding(STEPS, KEY).active.value).toBe(true)
  })

  it('replays from the first card on the same instance after finishing', async () => {
    const tour = useOnboarding(STEPS, KEY)
    tour.next()
    tour.finish()
    await nextTick()
    expect(tour.active.value).toBe(false)

    tour.restart()
    await nextTick()

    // Same instance, no remount: the tour reads `seen` reactively, so the
    // transition is visible to the consumer that was already listening.
    expect(tour.active.value).toBe(true)
    expect(tour.index.value).toBe(0)
    expect(tour.step.value).toEqual(STEPS[0])
  })

  it('clears the persisted completion flag so a reload does not re-hide it', async () => {
    const tour = useOnboarding(STEPS, KEY)
    tour.finish()
    await nextTick()

    tour.restart()
    await nextTick()

    expect(useOnboarding(STEPS, KEY).active.value).toBe(true)
  })

  it('advances in order and persists completion only after the final card', async () => {
    const tour = useOnboarding(STEPS, KEY)
    for (const [index, step] of STEPS.entries()) {
      expect(tour.active.value).toBe(true)
      expect(tour.index.value).toBe(index)
      expect(tour.step.value).toEqual(step)
      expect(tour.isLast.value).toBe(index === STEPS.length - 1)
      await nextTick()
      expect(localStorage.getItem(KEY)).toBe('false')
      tour.next()
    }
    expect(tour.active.value).toBe(false)
    await nextTick()
    expect(localStorage.getItem(KEY)).toBe('true')
    expect(useOnboarding(STEPS, KEY).active.value).toBe(false)
  })

  it.for([0, 1, 2, 3])(
    'can dismiss from card index %i without advancing further',
    async (index) => {
      const tour = useOnboarding(STEPS, KEY)
      for (let i = 0; i < index; i++) tour.next()
      tour.finish()
      tour.next()
      expect(tour.active.value).toBe(false)
      expect(tour.index.value).toBe(index)
      await nextTick()
      expect(useOnboarding(STEPS, KEY).active.value).toBe(false)
    }
  )

  it('starts again at the first card after an unfinished tour remounts', async () => {
    useOnboarding(STEPS, KEY).next()
    await nextTick()
    const resumed = useOnboarding(STEPS, KEY)
    expect(resumed.active.value).toBe(true)
    expect(resumed.step.value).toEqual(STEPS[0])
  })

  it('honors the existing default completion key', () => {
    localStorage.setItem('Comfy.AgentPanel.onboarded', 'true')
    const tour = useOnboarding(STEPS)
    expect(tour.active.value).toBe(false)
    tour.next()
    expect(tour.index.value).toBe(0)
  })

  it('reflects translated step updates without resetting progress', () => {
    const steps = ref(STEPS)
    const tour = useOnboarding(steps, KEY)
    tour.next()
    steps.value = STEPS.map((step) => ({
      ...step,
      title: `Translated ${step.title}`
    }))
    expect(tour.index.value).toBe(1)
    expect(tour.step.value.title).toBe('Translated Card 2')
  })

  it('scopes the stored flag to the account and workspace', () => {
    expect(scopedOnboardingKey('user-a', 'workspace-a')).toBe(
      'Comfy.AgentPanel.onboarded.user-a.workspace-a'
    )
  })

  it('has no scope until both the account and workspace are known', () => {
    expect(scopedOnboardingKey(undefined, 'workspace-a')).toBeNull()
    expect(scopedOnboardingKey('user-a', null)).toBeNull()
  })

  it('carries a device-wide flag onto the scope in front of the user', () => {
    localStorage.setItem('Comfy.AgentPanel.onboarded', 'true')

    adoptSharedOnboardingFlag('Comfy.AgentPanel.onboarded.user-a.workspace-a')

    expect(
      localStorage.getItem('Comfy.AgentPanel.onboarded.user-a.workspace-a')
    ).toBe('true')
    expect(localStorage.getItem('Comfy.AgentPanel.onboarded')).toBeNull()
  })

  it('leaves a workspace the user has not seen clear of the old flag', () => {
    localStorage.setItem('Comfy.AgentPanel.onboarded', 'true')
    adoptSharedOnboardingFlag('Comfy.AgentPanel.onboarded.user-a.workspace-a')

    adoptSharedOnboardingFlag('Comfy.AgentPanel.onboarded.user-a.workspace-b')

    expect(
      localStorage.getItem('Comfy.AgentPanel.onboarded.user-a.workspace-b')
    ).toBeNull()
  })

  it('runs the tour again for another account in the same browser and workspace', async () => {
    const first = useOnboarding(
      STEPS,
      scopedOnboardingKey('user-a', 'workspace-a')!
    )
    first.finish()
    expect(first.active.value).toBe(false)
    await nextTick()

    const second = useOnboarding(
      STEPS,
      scopedOnboardingKey('user-b', 'workspace-a')!
    )

    expect(second.active.value).toBe(true)
    expect(second.index.value).toBe(0)
  })

  it('does not complete when there are no cards', () => {
    const tour = useOnboarding([], KEY)
    tour.next()
    expect(tour.active.value).toBe(false)
    expect(localStorage.getItem(KEY)).toBe('false')
  })
})

describe('useOnboarding settings write failures', () => {
  let onboarding: typeof OnboardingModule
  let storeSetting: MockInstance<typeof api.storeSetting>
  let reportFailure: typeof reportError
  let settingValues: () => Record<string, unknown>

  beforeEach(async () => {
    window.localStorage.clear()
    vi.resetModules()
    const { api: freshApi } = await import('@/scripts/api')
    storeSetting = vi
      .spyOn(freshApi, 'storeSetting')
      .mockResolvedValue(new Response())
    onboarding = await import('./useOnboarding')
    reportFailure = (await import('@/platform/telemetry/reportError'))
      .reportError
    const settings = await import('@/platform/settings/settingStore')
    settingValues = () => settings.useSettingStore().settingValues
  })

  it('sends a completion again on the next mount when its write threw', async () => {
    storeSetting.mockRejectedValueOnce(new Error('offline'))

    onboarding.useOnboarding(STEPS, KEY).finish()
    await vi.waitFor(() => expect(reportFailure).toHaveBeenCalledTimes(1))
    expect(settingValues()[AGENT_ONBOARDED_SCOPES_SETTING_ID]).toEqual([KEY])

    onboarding.useOnboarding(STEPS, KEY)
    await vi.waitFor(() => expect(storeSetting).toHaveBeenCalledTimes(2))
    expect(storeSetting).toHaveBeenLastCalledWith(
      AGENT_ONBOARDED_SCOPES_SETTING_ID,
      [KEY]
    )

    onboarding.useOnboarding(STEPS, KEY)
    await nextTick()
    expect(storeSetting).toHaveBeenCalledTimes(2)
  })

  it('sends a replay clear again on the next mount when its write threw', async () => {
    Object.assign(settingValues(), {
      [AGENT_ONBOARDED_SCOPES_SETTING_ID]: [KEY]
    })
    storeSetting.mockRejectedValueOnce(new Error('offline'))

    onboarding.resetCoach(KEY)
    await vi.waitFor(() => expect(reportFailure).toHaveBeenCalledTimes(1))

    onboarding.useOnboarding(STEPS, KEY)
    await vi.waitFor(() => expect(storeSetting).toHaveBeenCalledTimes(2))
    expect(storeSetting).toHaveBeenLastCalledWith(
      AGENT_ONBOARDED_SCOPES_SETTING_ID,
      []
    )
  })

  it('drops an unsaved replay clear once a later completion is saved', async () => {
    Object.assign(settingValues(), {
      [AGENT_ONBOARDED_SCOPES_SETTING_ID]: [KEY]
    })
    storeSetting.mockRejectedValueOnce(new Error('offline'))
    const tour = onboarding.useOnboarding(STEPS, KEY)

    tour.restart()
    await vi.waitFor(() => expect(reportFailure).toHaveBeenCalledTimes(1))
    tour.finish()
    await vi.waitFor(() => expect(storeSetting).toHaveBeenCalledTimes(2))

    window.localStorage.clear()
    expect(onboarding.useOnboarding(STEPS, KEY).active.value).toBe(false)
    await nextTick()
    expect(storeSetting).toHaveBeenCalledTimes(2)
  })

  it('sends a replay only after the finish before it settles', async () => {
    let settleFinish: (response: Response) => void = () => {}
    storeSetting.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        settleFinish = resolve
      })
    )
    const tour = onboarding.useOnboarding(STEPS, KEY)

    tour.finish()
    await vi.waitFor(() => expect(storeSetting).toHaveBeenCalledTimes(1))
    tour.restart()
    await nextTick()
    expect(storeSetting).toHaveBeenCalledTimes(1)

    settleFinish(new Response())

    await vi.waitFor(() => expect(storeSetting).toHaveBeenCalledTimes(2))
    expect(storeSetting).toHaveBeenLastCalledWith(
      AGENT_ONBOARDED_SCOPES_SETTING_ID,
      []
    )
    await vi.waitFor(() =>
      expect(settingValues()[AGENT_ONBOARDED_SCOPES_SETTING_ID]).toEqual([])
    )
  })
})
