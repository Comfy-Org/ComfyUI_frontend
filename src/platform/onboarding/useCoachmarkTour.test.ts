import { createTestingPinia } from '@pinia/testing'
import { cleanup, render } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

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

vi.mock('@/composables/useAppMode', async () => {
  const { ref: r } = await import('vue')
  return { useAppMode: () => ({ isAppMode: r(false) }) }
})
const templates = vi.hoisted(() => ({
  loadTemplates: vi.fn().mockResolvedValue(undefined),
  loadWorkflowTemplate: vi.fn().mockResolvedValue(undefined)
}))
vi.mock(
  '@/platform/workflow/templates/composables/useTemplateWorkflows',
  () => ({ useTemplateWorkflows: () => templates })
)

const errorHandling = vi.hoisted(() => ({ toastErrorHandler: vi.fn() }))
vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => errorHandling
}))
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
  afterEach(() => {
    cleanup()
    clearCoachmarks()
    settings.seen = []
    telemetry.track.mockClear()
    templates.loadTemplates.mockClear()
    templates.loadWorkflowTemplate.mockClear()
    errorHandling.toastErrorHandler.mockClear()
    vi.useRealTimers()
  })

  /** Register every app-mode target laid out, so deferred steps resolve at once. */
  function registerAppModeTargets(): HTMLElement[] {
    return APP_MODE_TARGETS.map((id) => {
      const el = document.createElement('div')
      el.getBoundingClientRect = () => new DOMRect(0, 0, 100, 100)
      document.body.appendChild(el)
      registerCoachmark(id, el)
      return el
    })
  }

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
    await api.onPrimary()
    // The deferred target (inputs list) is never registered; exhaust the wait.
    await vi.advanceTimersByTimeAsync(8000)
    expect(settings.seen).not.toContain('appMode')
  })

  it('surfaces an error and stays on the step when a primary action fails', async () => {
    const error = new Error('load failed')
    templates.loadWorkflowTemplate.mockRejectedValueOnce(error)
    const { api } = mountTour()
    void useCoachmarkController().requestTour('appMode')
    await flush()

    // The landing's primary action loads a template; if that rejects the tour
    // must report it and not advance off the landing.
    await api.onPrimary()
    await flush()

    expect(errorHandling.toastErrorHandler).toHaveBeenCalledWith(error)
    expect(api.step.value?.landing).toBe(true)
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
    // user advances (spotlight steps defer their targets).
    const targets = registerAppModeTargets()
    const { api } = mountTour()
    void useCoachmarkController().requestTour('appMode')
    await flush()

    // Advance until the tour completes (count-agnostic; extra presses after the
    // final step are no-ops), capped so a stuck tour fails instead of hangs.
    for (let i = 0; i < 12 && !settings.seen.includes('appMode'); i++) {
      await api.onPrimary()
      await flush()
    }

    expect(settings.seen).toContain('appMode')
    const completed = telemetry.track.mock.calls.some(
      ([stage]) => stage === 'completed'
    )
    expect(completed).toBe(true)
    targets.forEach((el) => el.remove())
  })

  it('advances a click-to-advance step when its spotlighted target is clicked', async () => {
    const targets = registerAppModeTargets()
    const { api } = mountTour()
    void useCoachmarkController().requestTour('appMode')
    await flush()

    // Advance off the landing and through the spotlight steps up to the assets
    // button, which advances only when its target is clicked (Next is hidden).
    for (let i = 0; i < 4; i++) {
      await api.onPrimary()
      await flush()
    }
    expect(api.step.value?.advanceOnTargetClick).toBe(true)

    const assetsButton = targets[APP_MODE_TARGETS.indexOf('assets-button')]
    assetsButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()

    expect(api.step.value?.coachId).toBe('assets-panel')
    targets.forEach((el) => el.remove())
  })

  it('advancing off the landing does not mark the tour skipped', async () => {
    const targets = registerAppModeTargets()
    const { api } = mountTour()
    void useCoachmarkController().requestTour('appMode')
    await flush()
    expect(api.step.value?.landing).toBe(true)

    await api.onPrimary()
    await flush()

    expect(api.step.value?.landing).toBeFalsy()
    const skipped = telemetry.track.mock.calls.some(
      ([stage]) => stage === 'skipped'
    )
    expect(skipped).toBe(false)
    targets.forEach((el) => el.remove())
  })
})
