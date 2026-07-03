import { createTestingPinia } from '@pinia/testing'
import { cleanup, render } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import type { Ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AppMode } from '@/utils/appMode'

import { requestTour } from './coachmarkController'
import { clearCoachmarks, registerCoachmark } from './coachmarkRegistry'
import type { CoachId } from './onboardingTours'
import { useCoachmarkTour } from './useCoachmarkTour'

const SEEN_SETTING = 'Comfy.OnboardingCoachmarks.Seen'

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

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

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
  // Removed in teardown even when a test throws before its own cleanup.
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
    await vi.advanceTimersByTimeAsync(0)
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
    void requestTour('appMode')
    void requestTour('appMode')
    await flush()
    expect(startedCount()).toBe(1)
  })

  it('advances through every step to completion and marks the tour seen', async () => {
    registerAppModeTargets()
    const { api } = mountTour()
    void requestTour('appMode')
    await flush()

    // Capped so a stuck tour fails instead of hanging.
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
    expect(api.step.value?.advanceOnTargetClick).toBe(true)

    mountTarget('assets-panel')
    api.next()
    await flush()

    expect(api.step.value?.coachId).toBe('assets-panel')
  })

  it('drops the assets-button step (count 4) when the panel is already open', async () => {
    registerAppModeTargets()
    const { api } = mountTour()
    void requestTour('appMode')
    await flush()

    expect(api.countedSteps.value.length).toBe(4)

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

    // The landing's `primary` entry overrides only the primary label.
    expect(api.step.value?.landing).toBe(true)
    expect(api.primaryLabel.value).toBe('Start tutorial')
    expect(api.skipLabel.value).toBe('Skip')

    expect(api.countedSteps.value.length).toBe(4)

    api.next()
    await flush()
    expect(api.primaryLabel.value).toBe('Next')
    expect(api.skipLabel.value).toBe('Skip')

    for (let i = 0; i < 3; i++) {
      api.next()
      await flush()
    }
    expect(api.isLast.value).toBe(true)
    expect(api.primaryLabel.value).toBe('Done')
  })

  it('reports the user-visible step numbering, omitting it for the landing', async () => {
    registerAppModeTargets()
    const { api } = mountTour()
    void requestTour('appMode')
    await flush()

    // The landing isn't numbered; the pre-open panel drops the assets-button step.
    const started = telemetry.track.mock.calls.find(
      ([stage]) => stage === 'started'
    )
    expect(started?.[1]).toEqual({ tour: 'appMode', step_count: 4 })

    const landingShown = telemetry.track.mock.calls.find(
      ([stage]) => stage === 'step_shown'
    )
    expect(landingShown?.[1]).toEqual({ tour: 'appMode', step_count: 4 })

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
