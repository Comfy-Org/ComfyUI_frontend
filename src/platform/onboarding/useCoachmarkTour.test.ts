import { createTestingPinia } from '@pinia/testing'
import { cleanup, render } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import type { Ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { AppMode } from '@/utils/appMode'

import { requestTour } from './coachmarkController'
import { clearCoachmarks, registerCoachmark } from './coachmarkRegistry'
import type { CoachId } from './onboardingTours'
import { useCoachmarkTour } from './useCoachmarkTour'

const SEEN_SETTING = 'Comfy.OnboardingCoachmarks.Seen'

// In-memory setting store so seen-state reads/writes don't touch the real
// settings API; seeded empty and reset per test.
const settings = vi.hoisted(() => ({ seen: [] as string[] }))
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) => (key === SEEN_SETTING ? settings.seen : undefined),
    set: (key: string, value: unknown) => {
      if (key === SEEN_SETTING) settings.seen = value as string[]
      return Promise.resolve()
    }
  })
}))

const telemetry = vi.hoisted(() => ({ track: vi.fn() }))
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackOnboardingTour: telemetry.track })
}))

// `mode` + `hasOutputs` drive the auto-open watcher; hoisted so tests can flip
// them to simulate entering a populated vs empty app.
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
  'assets-button',
  'assets-panel'
]

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

const flush = () => new Promise((resolve) => setTimeout(resolve))

function mountTour() {
  let api!: ReturnType<typeof useCoachmarkTour>
  render(
    defineComponent({
      setup() {
        api = useCoachmarkTour()
        return () => null
      }
    }),
    { global: { plugins: [i18n, createTestingPinia({ stubActions: false })] } }
  )
  return { api }
}

function startedCount() {
  return telemetry.track.mock.calls.filter(([stage]) => stage === 'started')
    .length
}

describe('useCoachmarkTour', () => {
  // Tracks every element mountTarget appends, so teardown removes them even when
  // a test throws before its own cleanup would run.
  const appendedTargets: HTMLElement[] = []

  afterEach(() => {
    cleanup()
    clearCoachmarks()
    appendedTargets.forEach((el) => el.remove())
    appendedTargets.length = 0
    settings.seen = []
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
    mountTour()
    enterApp('app', true)
    await flush()
    expect(startedCount()).toBe(1)
  })

  it('auto-opens when mounted into an already-populated app', async () => {
    enterApp('app', true)
    mountTour()
    await flush()
    expect(startedCount()).toBe(1)
  })

  it('does not auto-open in an empty app with no linear controls', async () => {
    mountTour()
    enterApp('app', false)
    await flush()
    expect(startedCount()).toBe(0)
  })

  it('does not auto-open in arrange (builder) mode', async () => {
    mountTour()
    enterApp('builder:arrange', true)
    await flush()
    expect(startedCount()).toBe(0)
  })

  it('does not auto-open a populated app once the tour has been dismissed', async () => {
    settings.seen = ['appMode']
    mountTour()
    enterApp('app', true)
    await flush()
    expect(startedCount()).toBe(0)
  })

  it('replays a seen tour when explicitly requested', async () => {
    settings.seen = ['appMode']
    mountTour()
    void requestTour('appMode')
    await flush()
    expect(startedCount()).toBe(1)
  })

  it('marks the tour seen when it ends normally', async () => {
    const { api } = mountTour()
    void requestTour('appMode')
    await flush()
    api.end('skipped')
    expect(settings.seen).toContain('appMode')
  })

  it('does not mark the tour seen when a deferred target never appears', async () => {
    vi.useFakeTimers()
    const { api } = mountTour()
    void requestTour('appMode')
    // Flush startTour + the opening landing step.
    await vi.advanceTimersByTimeAsync(0)
    // Advance past the landing into the first deferred-target step.
    api.next()
    // The deferred target (inputs list) is never registered; exhaust the wait.
    await vi.advanceTimersByTimeAsync(8000)
    expect(settings.seen).not.toContain('appMode')

    // The skipped event reports the timed-out step, not the prior landing.
    const skipped = telemetry.track.mock.calls.find(
      ([stage]) => stage === 'skipped'
    )
    expect(skipped?.[1]).toMatchObject({
      step_number: 1,
      coach_id: 'inputs-list'
    })
  })

  it('ignores a second concurrent request while the first tour is resolving', async () => {
    mountTour()
    // Both fire synchronously; the first resolves steps before the second runs,
    // so the steps guard drops the second.
    void requestTour('appMode')
    void requestTour('appMode')
    await flush()
    expect(startedCount()).toBe(1)
  })

  it('advances through every step to completion and marks the tour seen', async () => {
    // Register every app-mode target so each step resolves immediately as the
    // user advances (spotlight steps defer their targets). The assets panel is
    // mounted, so the assets-button step is skipped — the tour still completes.
    registerAppModeTargets()
    const { api } = mountTour()
    void requestTour('appMode')
    await flush()

    // Advance until the tour completes (count-agnostic; extra presses after the
    // final step are no-ops), capped so a stuck tour fails instead of hangs.
    for (let i = 0; i < 12 && !settings.seen.includes('appMode'); i++) {
      api.next()
      await flush()
    }

    expect(settings.seen).toContain('appMode')
    const completed = telemetry.track.mock.calls.some(
      ([stage]) => stage === 'completed'
    )
    expect(completed).toBe(true)
  })

  it('resolves the deferred assets panel after the click-to-advance step', async () => {
    // Every target except the assets panel — it's still closed, so the
    // assets-button click step is shown (all five spotlight steps run).
    registerAppModeTargets(
      APP_MODE_TARGETS.filter((id) => id !== 'assets-panel')
    )
    const { api } = mountTour()
    void requestTour('appMode')
    await flush()

    expect(api.countedSteps.value.length).toBe(5)
    for (let i = 0; i < 4; i++) {
      api.next()
      await flush()
    }
    // The assets-button step advances only on a target click (Next is hidden);
    // TourSpotlight emits `advance`, which next() handles — drive it directly.
    expect(api.step.value?.advanceOnTargetClick).toBe(true)

    // The panel mounts when the button is clicked; advancing then spotlights it.
    mountTarget('assets-panel')
    api.next()
    await flush()

    expect(api.step.value?.coachId).toBe('assets-panel')
  })

  it('drops the assets-button step (count 4) when the panel is already open', async () => {
    // The panel is registered up front, so the step that only exists to open it
    // is dropped at tour start — the indicator counts four steps, not five.
    registerAppModeTargets()
    const { api } = mountTour()
    void requestTour('appMode')
    await flush()

    expect(api.countedSteps.value.length).toBe(4)

    // landing → inputs → run → outputs → assets-panel (no assets-button step)
    for (let i = 0; i < 4; i++) {
      api.next()
      await flush()
    }
    expect(api.step.value?.coachId).toBe('assets-panel')
  })

  it('reports step index 0 while no tour is active', () => {
    const { api } = mountTour()
    expect(api.countedStepIdx.value).toBe(0)
  })

  it('labels the buttons from the step, falling back to Next then Done', async () => {
    registerAppModeTargets()
    const { api } = mountTour()
    void requestTour('appMode')
    await flush()

    // The landing step overrides both labels.
    expect(api.step.value?.landing).toBe(true)
    expect(api.primaryLabel.value).toBe(
      'onboardingCoachmarks.appMode.landing.start'
    )
    expect(api.skipLabel.value).toBe(
      'onboardingCoachmarks.appMode.landing.skip'
    )

    // Every target is mounted, so the tour is a landing plus four spotlight steps.
    expect(api.countedSteps.value.length).toBe(4)

    // Landing → first spotlight: labels fall back to the generic Next/Skip.
    api.next()
    await flush()
    expect(api.primaryLabel.value).toBe('onboardingCoachmarks.next')
    expect(api.skipLabel.value).toBe('onboardingCoachmarks.skip')

    // Three more advances reach the final step, whose primary action reads Done.
    for (let i = 0; i < 3; i++) {
      api.next()
      await flush()
    }
    expect(api.isLast.value).toBe(true)
    expect(api.primaryLabel.value).toBe('onboardingCoachmarks.done')
  })

  it('reports the user-visible step numbering, omitting it for the landing', async () => {
    registerAppModeTargets()
    const { api } = mountTour()
    void requestTour('appMode')
    await flush()

    // The count matches the "of M" the card shows: the landing isn't numbered
    // (and the assets-button step is dropped — its panel is already mounted).
    const started = telemetry.track.mock.calls.find(
      ([stage]) => stage === 'started'
    )
    expect(started?.[1]).toEqual({ tour: 'appMode', step_count: 4 })

    // The landing's step_shown carries no step number or coach id.
    const landingShown = telemetry.track.mock.calls.find(
      ([stage]) => stage === 'step_shown'
    )
    expect(landingShown?.[1]).toEqual({ tour: 'appMode', step_count: 4 })

    // Advancing off the landing shows "Step 1 of 4", and the event agrees.
    api.next()
    await flush()
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
    const { api } = mountTour()
    void requestTour('appMode')
    await flush()
    expect(api.step.value?.landing).toBe(true)

    api.next()
    await flush()

    expect(api.step.value?.landing).toBeFalsy()
    const skipped = telemetry.track.mock.calls.some(
      ([stage]) => stage === 'skipped'
    )
    expect(skipped).toBe(false)
  })
})
