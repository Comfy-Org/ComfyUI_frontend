import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  track: vi.fn(),
  settings: new Map<string, unknown>()
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackOnboardingTour: mocks.track })
}))
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) => mocks.settings.get(key) ?? [],
    set: (key: string, value: unknown) => {
      mocks.settings.set(key, value)
      return Promise.resolve()
    }
  })
}))
vi.mock('./useTourTriggers', () => ({
  useTourTriggers: () => []
}))
vi.mock('./coachmarkRegistry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  targetMounted: () => true,
  waitForTarget: () => Promise.resolve(true)
}))

import { useOnboardingTourStore } from './onboardingTourStore'
import { registerTour } from './onboardingTours'
import type { CoachStep } from './onboardingTours'

function step(name: string, overrides: Partial<CoachStep> = {}): CoachStep {
  return { name, placement: 'right', ...overrides }
}

describe('registered tours', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.track.mockClear()
    mocks.settings.clear()
  })

  it('runs resolver-produced steps', async () => {
    registerTour('firstRun', () => [step('upload')])
    const store = useOnboardingTourStore()
    expect(store.startTour('firstRun')).toBe(true)
    expect(store.step?.name).toBe('upload')
    expect(store.countedStepsTotal).toBe(1)
  })

  it('does not start on an empty resolver', async () => {
    registerTour('firstRun', () => [])
    const store = useOnboardingTourStore()
    expect(store.startTour('firstRun')).toBe(false)
    expect(mocks.track).not.toHaveBeenCalledWith('started', expect.anything())
  })

  it('postpone skips without marking seen, so the tour re-offers', async () => {
    registerTour('firstRun', () => [step('run')])
    const store = useOnboardingTourStore()
    store.startTour('firstRun')
    store.postpone()
    expect(mocks.track).toHaveBeenCalledWith(
      'skipped',
      expect.objectContaining({ skip_reason: 'postponed' })
    )
    expect(store.startTour('firstRun')).toBe(true)
  })

  it('blocks going back across a self-advancing step', async () => {
    registerTour('firstRun', () => [
      step('prompt'),
      step('run', { selfAdvancing: true }),
      step('result')
    ])
    const store = useOnboardingTourStore()
    store.startTour('firstRun')
    store.next()
    expect(store.canGoBack).toBe(true)
    store.next()
    expect(store.step?.name).toBe('result')
    expect(store.canGoBack).toBe(false)
  })
})
