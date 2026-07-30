import { createPinia, disposePinia, setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { Ref } from 'vue'

import type { AppMode } from '@/utils/appMode'

import { clearCoachmarks } from './coachmarkRegistry'
import { TOUR_SEEN_SETTING, registerTour } from './onboardingTours'
import type { CoachStep } from './onboardingTours'
import { useOnboardingTourStore } from './onboardingTourStore'

const settings = vi.hoisted(() => ({ store: new Map<string, unknown>() }))
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) =>
      settings.store.get(key) ?? (key === TOUR_SEEN_SETTING ? [] : undefined),
    set: (key: string, value: unknown) => {
      settings.store.set(key, value)
      return Promise.resolve()
    }
  })
}))

const telemetry = vi.hoisted(() => ({ track: vi.fn() }))
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackOnboardingTour: telemetry.track })
}))

const appModeMock = vi.hoisted(() => ({ mode: null as Ref<AppMode> | null }))
vi.mock('@/composables/useAppMode', async () => {
  const { ref } = await import('vue')
  appModeMock.mode = ref<AppMode>('graph')
  return { useAppMode: () => ({ mode: appModeMock.mode }) }
})
vi.mock('@/stores/appModeStore', () => ({
  useAppModeStore: () => ({ hasOutputs: false })
}))

function step(name: string, overrides: Partial<CoachStep> = {}): CoachStep {
  return { name, placement: 'center', ...overrides }
}

function stages(): string[] {
  return telemetry.track.mock.calls.map(([stage]) => stage)
}

let pinia: Pinia | undefined

function mountStore() {
  pinia = createPinia()
  setActivePinia(pinia)
  return useOnboardingTourStore()
}

describe('onboardingTourStore — runtime-resolved tours', () => {
  afterEach(() => {
    if (pinia) disposePinia(pinia)
    pinia = undefined
    clearCoachmarks()
    settings.store.clear()
    telemetry.track.mockClear()
  })

  it('reports no start for an entry no one registered', async () => {
    vi.resetModules()
    const { useOnboardingTourStore: freshStore } =
      await import('./onboardingTourStore')
    pinia = createPinia()
    setActivePinia(pinia)
    const store = freshStore()

    await expect(store.startTour('firstRun')).resolves.toBe(false)
    expect(store.activeTour).toBeNull()
  })

  it('reports no start when the resolver produces no steps', async () => {
    registerTour('firstRun', () => Promise.resolve([]))
    const store = mountStore()

    await expect(store.startTour('firstRun')).resolves.toBe(false)
    expect(store.activeTour, 'an empty resolution must not open a tour').toBe(
      null
    )
    expect(stages()).not.toContain('started')
  })

  it('stays startable after a resolver rejects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    registerTour('firstRun', () =>
      Promise.reject(new Error('unreadable graph'))
    )
    const store = mountStore()

    await expect(store.startTour('firstRun')).resolves.toBe(false)

    registerTour('firstRun', () => Promise.resolve([step('run')]))
    await expect(
      store.startTour('firstRun'),
      'one unreadable graph must not cost the user every tour after it'
    ).resolves.toBe(true)
  })

  it('runs the steps its resolver builds', async () => {
    registerTour('firstRun', () =>
      Promise.resolve([step('upload'), step('run')])
    )
    const store = mountStore()

    await expect(store.startTour('firstRun')).resolves.toBe(true)
    expect(store.activeTour).toBe('firstRun')
    expect(store.countedStepsTotal).toBe(2)
    expect(store.step?.name).toBe('upload')
  })

  it('ends the tour as completed when a consumer completes it', async () => {
    registerTour('firstRun', () => Promise.resolve([step('run')]))
    const store = mountStore()
    await store.startTour('firstRun')

    store.complete()

    expect(stages()).toContain('completed')
    expect(stages()).not.toContain('skipped')
    expect(store.activeTour).toBeNull()
  })

  it('holds the step until its onEnter settles, so framing precedes the copy', async () => {
    let release = () => {}
    const entered = new Promise<void>((resolve) => {
      release = resolve
    })
    registerTour('firstRun', () =>
      Promise.resolve([step('upload', { onEnter: () => entered })])
    )
    const store = mountStore()

    await store.startTour('firstRun')
    await nextTick()
    expect(stages()).not.toContain('step_shown')

    release()
    await entered
    await nextTick()
    expect(stages()).toContain('step_shown')
  })

  it('shows no step until the first one has framed itself', async () => {
    let release = () => {}
    const framed = new Promise<void>((resolve) => {
      release = resolve
    })
    registerTour('firstRun', () =>
      Promise.resolve([
        step('upload', { onEnter: () => framed }),
        step('prompt', { onEnter: () => framed })
      ])
    )
    const store = mountStore()

    await store.startTour('firstRun')
    await nextTick()
    expect(
      store.step,
      'a card placed against a view still flying reads as a glitch'
    ).toBeNull()

    release()
    await framed
    await nextTick()
    expect(store.step?.name).toBe('upload')

    store.next()
    await nextTick()
    expect(
      store.step?.name,
      'a card that blanks out on every step reads as a restart, not a next step'
    ).toBe('prompt')
  })

  it('offers no way back into a step that only its own action leaves', async () => {
    registerTour('firstRun', () =>
      Promise.resolve([
        step('prompt'),
        step('run', { selfAdvancing: true }),
        step('result')
      ])
    )
    const store = mountStore()
    await store.startTour('firstRun')
    await nextTick()

    store.next()
    await nextTick()
    expect(store.canGoBack, 'Run is reachable from the step before it').toBe(
      true
    )

    store.next()
    await nextTick()
    expect(
      store.canGoBack,
      'Back into Run strands the user on a step whose only exit queues a second run'
    ).toBe(false)
  })

  it('postpones a tour something else blocked, so it is offered again', async () => {
    registerTour('firstRun', () => Promise.resolve([step('run')]))
    const store = mountStore()
    await store.startTour('firstRun')

    store.postpone()

    expect(
      telemetry.track,
      'a postponement counted as a plain skip reads as a user who refused the tour'
    ).toHaveBeenCalledWith(
      'skipped',
      expect.objectContaining({ skip_reason: 'postponed' })
    )
    expect(store.activeTour).toBeNull()
    await expect(
      store.startTour('firstRun'),
      'a user turned away at the paywall has still not had their tour'
    ).resolves.toBe(true)
  })

  it('aborts a step onEnter signal when the tour ends, so framing cannot outlive it', async () => {
    let signal: AbortSignal | undefined
    registerTour('firstRun', () =>
      Promise.resolve([
        step('upload', {
          onEnter: (s) => {
            signal = s
            return new Promise<void>(() => {})
          }
        })
      ])
    )
    const store = mountStore()
    await store.startTour('firstRun')
    await nextTick()

    store.skip()

    expect(signal?.aborted).toBe(true)
  })
})
