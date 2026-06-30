import { createTestingPinia } from '@pinia/testing'
import { cleanup, render } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import type { Ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { AppMode } from '@/utils/appMode'

import { useCoachmarkController } from './coachmarkController'
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
vi.mock('@primeuix/utils/zindex', () => ({
  ZIndex: { set: vi.fn(), clear: vi.fn() }
}))

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
        const cardRef = ref<HTMLElement | null>(null)
        const overlayRef = ref<HTMLElement | null>(null)
        api = useCoachmarkTour({ cardRef, overlayRef })
        return { cardRef, overlayRef }
      },
      template: '<div ref="overlayRef"><div ref="cardRef"></div></div>'
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

  it('marks the tour seen when it ends normally', async () => {
    const { api } = mountTour()
    void useCoachmarkController().requestTour('appMode')
    await flush()
    api.end('skipped')
    expect(settings.seen).toContain('appMode')
  })

  it('does not mark the tour seen when a deferred target never appears', async () => {
    vi.useFakeTimers()
    const { api } = mountTour()
    void useCoachmarkController().requestTour('appMode')
    // Flush startTour + the opening landing step.
    await vi.advanceTimersByTimeAsync(0)
    // Advance past the landing into the first deferred-target step.
    api.next()
    // The deferred target (inputs list) is never registered; exhaust the wait.
    await vi.advanceTimersByTimeAsync(8000)
    expect(settings.seen).not.toContain('appMode')
  })

  it('ignores a second concurrent request while the first tour is resolving', async () => {
    mountTour()
    const { requestTour } = useCoachmarkController()
    // Both fire synchronously, before the first has finished resolving steps;
    // the `starting` guard must drop the second.
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
    void useCoachmarkController().requestTour('appMode')
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

  it('advances a click-to-advance step when its spotlighted target is clicked', async () => {
    // Every target except the assets panel — it's still closed, so the
    // assets-button click step is shown rather than skipped.
    const targets = registerAppModeTargets(
      APP_MODE_TARGETS.filter((id) => id !== 'assets-panel')
    )
    const { api } = mountTour()
    void useCoachmarkController().requestTour('appMode')
    await flush()

    // Advance off the landing and through the spotlight steps up to the assets
    // button, which advances only when its target is clicked (Next is hidden).
    // All five spotlight steps run when the panel starts closed.
    expect(api.countedSteps.value.length).toBe(5)
    for (let i = 0; i < 4; i++) {
      api.next()
      await flush()
    }
    expect(api.step.value?.advanceOnTargetClick).toBe(true)

    // Clicking the button opens the panel and advances to spotlight it.
    mountTarget('assets-panel')
    const assetsButton = targets.get('assets-button')!
    assetsButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()

    expect(api.step.value?.coachId).toBe('assets-panel')
  })

  it('drops the assets-button step (count 4) when the panel is already open', async () => {
    // The panel is registered up front, so the step that only exists to open it
    // is dropped at tour start — the indicator counts four steps, not five.
    registerAppModeTargets()
    const { api } = mountTour()
    void useCoachmarkController().requestTour('appMode')
    await flush()

    expect(api.countedSteps.value.length).toBe(4)

    // landing → inputs → run → outputs → assets-panel (no assets-button step)
    for (let i = 0; i < 4; i++) {
      api.next()
      await flush()
    }
    expect(api.step.value?.coachId).toBe('assets-panel')
  })

  it('advancing off the landing does not mark the tour skipped', async () => {
    registerAppModeTargets()
    const { api } = mountTour()
    void useCoachmarkController().requestTour('appMode')
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
