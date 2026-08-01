import { createPinia, disposePinia, setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import type { AppMode } from '@/utils/appMode'

import { clearCoachmarks } from './coachmarkRegistry'
import { TOUR_SEEN_SETTING, registerTour } from './onboardingTours'
import type { SpotlightStep } from './onboardingTours'
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

function step(
  name: string,
  overrides: Partial<SpotlightStep> = {}
): SpotlightStep {
  return { kind: 'spotlight', name, placement: 'center', ...overrides }
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
    expect(
      stages(),
      'a pin set covering no real traffic has to be tellable apart from nobody qualifying'
    ).toContain('not_started')
  })

  it('tells a repeat user apart from a coverage failure', async () => {
    settings.store.set(TOUR_SEEN_SETTING, ['firstRun'])
    registerTour('firstRun', () => Promise.resolve([]))
    const store = mountStore()

    await expect(store.startTour('firstRun')).resolves.toBe(false)
    expect(
      telemetry.track,
      'counted as a plain no-start, a repeat user reads as a tour that failed to open'
    ).toHaveBeenCalledWith(
      'not_started',
      expect.objectContaining({ not_started_reason: 'already_seen' })
    )
  })

  it('says nothing about a tour that did start', async () => {
    registerTour('firstRun', () => Promise.resolve([step('run')]))
    const store = mountStore()

    await expect(store.startTour('firstRun')).resolves.toBe(true)
    expect(stages()).not.toContain('not_started')
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

  it('ends a running tour once the context it registered with goes', async () => {
    const holds = ref(true)
    registerTour('firstRun', () => Promise.resolve([step('run')]), holds)
    const store = mountStore()
    await store.startTour('firstRun')

    holds.value = false
    await nextTick()

    expect(
      store.activeTour,
      'a tour whose targets are no longer laid out points at nothing'
    ).toBeNull()
    expect(telemetry.track).toHaveBeenCalledWith(
      'skipped',
      expect.objectContaining({ skip_reason: 'trigger_lost' })
    )
    await expect(
      store.startTour('firstRun'),
      'the context went, not the user, so the tour is still owed'
    ).resolves.toBe(true)
  })

  it('starts a tour whose context is already unmet, and ends it only on losing it', async () => {
    const holds = ref(false)
    registerTour('firstRun', () => Promise.resolve([step('run')]), holds)
    const store = mountStore()

    await expect(
      store.startTour('firstRun'),
      'startTour decides whether a tour may begin; holds only ends one'
    ).resolves.toBe(true)
    await nextTick()
    expect(store.activeTour).toBe('firstRun')

    holds.value = true
    await nextTick()
    holds.value = false
    await nextTick()
    expect(store.activeTour).toBeNull()
  })

  it('ends the tour as completed once its last step is advanced past', async () => {
    registerTour('firstRun', () => Promise.resolve([step('run')]))
    const store = mountStore()
    await store.startTour('firstRun')
    await nextTick()

    store.next()

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
