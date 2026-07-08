import type { DetachedWindowAPI } from 'happy-dom'
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { Ref } from 'vue'

import { useToastStore } from '@/platform/updates/common/toastStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import type { AppMode } from '@/utils/appMode'

import { clearCoachmarks, registerCoachmark } from './coachmarkRegistry'
import { TOUR_SEEN_SETTING } from './onboardingTours'
import type { CoachId } from './onboardingTours'
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

const appModeMock = vi.hoisted(
  () =>
    ({ mode: null, hasOutputs: null }) as {
      mode: Ref<AppMode> | null
      hasOutputs: Ref<boolean> | null
    }
)
vi.mock('@/composables/useAppMode', async () => {
  const { ref: r } = await import('vue')
  appModeMock.mode = r<AppMode>('graph')
  return { useAppMode: () => ({ mode: appModeMock.mode }) }
})
vi.mock('@/stores/appModeStore', async () => {
  const { ref: r } = await import('vue')
  appModeMock.hasOutputs = r(false)
  const hasOutputs = appModeMock.hasOutputs
  return {
    useAppModeStore: () => ({
      get hasOutputs() {
        return hasOutputs.value
      }
    })
  }
})
const APP_MODE_TARGETS: CoachId[] = [
  'inputs-list',
  'app-run-button',
  'outputs',
  'assets-panel'
]

function seenTours(): string[] {
  return (settings.store.get(TOUR_SEEN_SETTING) as string[] | undefined) ?? []
}

function setViewport(viewport: { width: number; height: number }) {
  const happyDOM = (window as unknown as { happyDOM?: DetachedWindowAPI })
    .happyDOM
  if (!happyDOM) {
    throw new Error('window.happyDOM is unavailable to set viewport')
  }
  happyDOM.setViewport(viewport)
}

let pinia: Pinia | undefined

function mountStore() {
  pinia = createPinia()
  setActivePinia(pinia)
  return useOnboardingTourStore()
}

function startedCount() {
  return telemetry.track.mock.calls.filter(([stage]) => stage === 'started')
    .length
}

describe('onboardingTourStore', () => {
  // Removed in teardown even when a test throws before its own cleanup.
  const appendedTargets: HTMLElement[] = []

  afterEach(() => {
    if (pinia) disposePinia(pinia)
    pinia = undefined
    clearCoachmarks()
    appendedTargets.forEach((el) => el.remove())
    appendedTargets.length = 0
    settings.store.clear()
    setViewport({ width: 1024, height: 768 })
    if (appModeMock.mode) appModeMock.mode.value = 'graph'
    if (appModeMock.hasOutputs) appModeMock.hasOutputs.value = false
    telemetry.track.mockClear()
    vi.useRealTimers()
  })

  /** Register one laid-out element for a coach id, so its step resolves at once. */
  function mountTarget(id: CoachId): HTMLElement {
    const el = document.createElement('div')
    el.getBoundingClientRect = () => new DOMRect(0, 0, 100, 100)
    document.body.appendChild(el)
    appendedTargets.push(el)
    registerCoachmark(id, el)
    return el
  }

  function registerAppModeTargets(
    ids: CoachId[] = APP_MODE_TARGETS
  ): Map<CoachId, HTMLElement> {
    return new Map(ids.map((id) => [id, mountTarget(id)]))
  }

  function enterApp(mode: AppMode, hasOutputs: boolean) {
    const modeRef = appModeMock.mode
    const outputsRef = appModeMock.hasOutputs
    if (!modeRef || !outputsRef)
      throw new Error('app mode mock not initialised')
    modeRef.value = mode
    outputsRef.value = hasOutputs
  }

  it('auto-opens when entering a populated app it has not seen', async () => {
    mountStore()
    enterApp('app', true)
    await nextTick()
    expect(startedCount()).toBe(1)
  })

  it('auto-opens when instantiated in an already-populated app', async () => {
    enterApp('app', true)
    mountStore()
    await nextTick()
    expect(startedCount()).toBe(1)
  })

  it('does not auto-open in an empty app with no linear controls', async () => {
    mountStore()
    enterApp('app', false)
    await nextTick()
    expect(startedCount()).toBe(0)
  })

  it('does not auto-open in arrange (builder) mode', async () => {
    mountStore()
    enterApp('builder:arrange', true)
    await nextTick()
    expect(startedCount()).toBe(0)
  })

  it('does not auto-open on a mobile-width viewport', async () => {
    setViewport({ width: 500, height: 800 })
    enterApp('app', true)
    mountStore()
    await nextTick()
    expect(startedCount()).toBe(0)
  })

  it('does not auto-open a populated app once the tour has been dismissed', async () => {
    settings.store.set(TOUR_SEEN_SETTING, ['appMode'])
    mountStore()
    enterApp('app', true)
    await nextTick()
    expect(startedCount()).toBe(0)
  })

  it('replays a seen tour when explicitly requested', async () => {
    settings.store.set(TOUR_SEEN_SETTING, ['appMode'])
    const store = mountStore()
    store.replayTour('appMode')
    await nextTick()
    expect(startedCount()).toBe(1)
  })

  it('dismisses a replayed tour without the seen-flag when the user leaves its mode', async () => {
    settings.store.set(TOUR_SEEN_SETTING, ['appMode'])
    const store = mountStore()
    enterApp('app', false)
    await nextTick()
    store.replayTour('appMode')
    await nextTick()
    expect(store.step?.name).toBe('landing')

    enterApp('graph', false)
    await nextTick()

    expect(store.step).toBeNull()
    const skipped = telemetry.track.mock.calls.find(
      ([stage]) => stage === 'skipped'
    )
    expect(skipped?.[1]).toMatchObject({ skip_reason: 'trigger_lost' })
  })

  it('keeps the tour running when outputs disappear but the mode still holds', async () => {
    registerAppModeTargets()
    const store = mountStore()
    enterApp('app', true)
    await nextTick()
    expect(startedCount()).toBe(1)

    enterApp('app', false)
    await nextTick()

    expect(store.step).not.toBeNull()
  })

  it('marks the tour seen when it ends normally', async () => {
    const store = mountStore()
    store.replayTour('appMode')
    await nextTick()
    store.skip()
    expect(seenTours()).toContain('appMode')

    // A deliberate dismissal reports the user as the skip reason.
    const skipped = telemetry.track.mock.calls.find(
      ([stage]) => stage === 'skipped'
    )
    expect(skipped?.[1]).toMatchObject({ skip_reason: 'user' })
  })

  it('skips without the seen-flag and toasts when a deferred target never appears', async () => {
    vi.useFakeTimers()
    const store = mountStore()
    store.replayTour('appMode')
    await vi.advanceTimersByTimeAsync(0)
    store.next()
    expect(store.waitingForTarget).toBe(true)
    // The deferred target (inputs list) is never registered; exhaust the wait.
    await vi.advanceTimersByTimeAsync(8000)
    expect(seenTours()).not.toContain('appMode')

    // The skipped event reports the timed-out step, not the prior landing,
    // and attributes the skip to the timeout rather than the user.
    const skipped = telemetry.track.mock.calls.find(
      ([stage]) => stage === 'skipped'
    )
    expect(skipped?.[1]).toMatchObject({
      step_number: 1,
      coach_id: 'inputs-list',
      skip_reason: 'target_timeout'
    })

    expect(useToastStore().messagesToAdd).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        detail: 'Something went wrong showing this tour'
      })
    )
  })

  it('advances once a deferred target mounts during the wait', async () => {
    const store = mountStore()
    store.replayTour('appMode')
    await nextTick()
    store.next()
    expect(store.waitingForTarget).toBe(true)

    mountTarget('inputs-list')
    await nextTick()

    expect(store.waitingForTarget).toBe(false)
    expect(store.step?.coachId).toBe('inputs-list')
  })

  it('keeps the original deadline when advance is requested again mid-wait', async () => {
    vi.useFakeTimers()
    const store = mountStore()
    store.replayTour('appMode')
    await vi.advanceTimersByTimeAsync(0)
    store.next()
    expect(store.waitingForTarget).toBe(true)

    await vi.advanceTimersByTimeAsync(5000)
    store.next()
    await vi.advanceTimersByTimeAsync(3000)

    expect(useToastStore().messagesToAdd).toHaveLength(1)
  })

  it('does not toast or double-report when the user skips during a deferred wait', async () => {
    vi.useFakeTimers()
    const store = mountStore()
    store.replayTour('appMode')
    await vi.advanceTimersByTimeAsync(0)
    store.next()
    expect(store.waitingForTarget).toBe(true)

    store.skip()
    await vi.advanceTimersByTimeAsync(8000)

    const skipped = telemetry.track.mock.calls.filter(
      ([stage]) => stage === 'skipped'
    )
    expect(skipped).toHaveLength(1)
    expect(skipped[0]?.[1]).toMatchObject({ skip_reason: 'user' })
    expect(useToastStore().messagesToAdd).toHaveLength(0)
  })

  it('ends an active tour without the seen-flag when its trigger stops holding', async () => {
    registerAppModeTargets()
    const store = mountStore()
    enterApp('app', true)
    await nextTick()
    expect(startedCount()).toBe(1)

    enterApp('graph', true)
    await nextTick()

    expect(store.step).toBeNull()
    expect(seenTours()).not.toContain('appMode')
    const skipped = telemetry.track.mock.calls.find(
      ([stage]) => stage === 'skipped'
    )
    expect(skipped?.[1]).toMatchObject({ skip_reason: 'trigger_lost' })

    enterApp('app', true)
    await nextTick()
    expect(startedCount()).toBe(2)
  })

  it('aborts a pending deferred wait without a toast when the trigger stops holding', async () => {
    vi.useFakeTimers()
    const store = mountStore()
    enterApp('app', true)
    await vi.advanceTimersByTimeAsync(0)
    store.next()
    expect(store.waitingForTarget).toBe(true)

    enterApp('graph', true)
    await vi.advanceTimersByTimeAsync(8000)

    expect(useToastStore().messagesToAdd).toHaveLength(0)
    const skipReasons = telemetry.track.mock.calls
      .filter(([stage]) => stage === 'skipped')
      .map(([, meta]) => meta.skip_reason)
    expect(skipReasons).toEqual(['trigger_lost'])
  })

  it('ignores a second concurrent request while the first tour is resolving', async () => {
    const store = mountStore()
    store.replayTour('appMode')
    store.replayTour('appMode')
    await nextTick()
    expect(startedCount()).toBe(1)
  })

  it('advances through every step to completion and marks the tour seen', async () => {
    registerAppModeTargets()
    const store = mountStore()
    store.replayTour('appMode')
    await nextTick()

    // Capped so a stuck tour fails instead of hanging.
    for (let i = 0; i < 12 && !seenTours().includes('appMode'); i++) {
      store.next()
      await nextTick()
    }

    expect(seenTours()).toContain('appMode')
    const completed = telemetry.track.mock.calls.find(
      ([stage]) => stage === 'completed'
    )
    expect(completed).toBeTruthy()
    expect(completed?.[1]).not.toHaveProperty('skip_reason')
  })

  it('opens the assets sidebar tab and resolves its deferred panel on the assets step', async () => {
    registerAppModeTargets(
      APP_MODE_TARGETS.filter((id) => id !== 'assets-panel')
    )
    const store = mountStore()
    store.replayTour('appMode')
    await nextTick()

    expect(store.countedStepsTotal).toBe(4)
    // Advance landing -> inputs -> run -> outputs, then onto the assets step.
    for (let i = 0; i < 4; i++) {
      store.next()
      await nextTick()
    }
    // The assets step defers on its panel; the tab auto-opens while it waits.
    expect(store.waitingForTarget).toBe(true)
    expect(useSidebarTabStore().activeSidebarTabId).toBe('assets')

    mountTarget('assets-panel')
    await nextTick()

    expect(store.waitingForTarget).toBe(false)
    expect(store.step?.coachId).toBe('assets-panel')
  })

  it('leaves an already-open assets tab open when reaching the assets step', async () => {
    registerAppModeTargets()
    const store = mountStore()
    const sidebar = useSidebarTabStore()
    sidebar.toggleSidebarTab('assets')
    expect(sidebar.activeSidebarTabId).toBe('assets')

    store.replayTour('appMode')
    await nextTick()
    for (let i = 0; i < 4; i++) {
      store.next()
      await nextTick()
    }

    expect(store.step?.coachId).toBe('assets-panel')
    expect(sidebar.activeSidebarTabId).toBe('assets')
  })

  it('steps back to the previous step', async () => {
    registerAppModeTargets()
    const store = mountStore()
    store.replayTour('appMode')
    await nextTick()

    store.next()
    await nextTick()
    store.next()
    await nextTick()
    expect(store.step?.coachId).toBe('app-run-button')
    expect(store.canGoBack).toBe(true)

    store.back()
    await nextTick()
    expect(store.step?.coachId).toBe('inputs-list')
  })

  it('reports step index 0 while no tour is active', () => {
    const store = mountStore()
    expect(store.countedStepIdx).toBe(0)
  })

  it('labels the buttons from the step, falling back to Next then Done', async () => {
    registerAppModeTargets()
    const store = mountStore()
    store.replayTour('appMode')
    await nextTick()

    // The landing's `primary` entry overrides only the primary label.
    expect(store.step?.landing).toBe(true)
    expect(store.primaryLabel).toBe('Start tutorial')
    expect(store.skipLabel).toBe('Skip')

    expect(store.countedStepsTotal).toBe(4)

    store.next()
    await nextTick()
    expect(store.primaryLabel).toBe('Next')
    expect(store.skipLabel).toBe('Skip')

    for (let i = 0; i < 3; i++) {
      store.next()
      await nextTick()
    }
    expect(store.isLast).toBe(true)
    expect(store.primaryLabel).toBe('Done')
  })

  it('reports the user-visible step numbering, omitting it for the landing', async () => {
    registerAppModeTargets()
    const store = mountStore()
    store.replayTour('appMode')
    await nextTick()

    // The landing isn't numbered, so the four spotlight steps carry the count.
    const started = telemetry.track.mock.calls.find(
      ([stage]) => stage === 'started'
    )
    expect(started?.[1]).toEqual({ tour: 'appMode', step_count: 4 })

    const landingShown = telemetry.track.mock.calls.find(
      ([stage]) => stage === 'step_shown'
    )
    expect(landingShown?.[1]).toEqual({ tour: 'appMode', step_count: 4 })

    store.next()
    await nextTick()
    const shown = telemetry.track.mock.calls
      .filter(([stage]) => stage === 'step_shown')
      .at(-1)
    expect(shown?.[1]).toEqual({
      tour: 'appMode',
      step_count: 4,
      step_number: 1,
      coach_id: 'inputs-list'
    })
  })

  it('advancing off the landing does not mark the tour skipped', async () => {
    registerAppModeTargets()
    const store = mountStore()
    store.replayTour('appMode')
    await nextTick()
    expect(store.step?.landing).toBe(true)

    store.next()
    await nextTick()

    expect(store.step?.landing).toBeFalsy()
    const skipped = telemetry.track.mock.calls.some(
      ([stage]) => stage === 'skipped'
    )
    expect(skipped).toBe(false)
  })
})
