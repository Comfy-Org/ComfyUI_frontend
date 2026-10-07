import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { useInterruptionStore } from './interruptionStore'
import { useGatedAction, useGatedSurface } from './useGatedSurface'

function blocker(active = ref(false)) {
  useInterruptionStore().registerSource({
    id: 'dialog',
    tier: 'blocking',
    order: 0,
    isActive: () => active.value
  })
  return active
}

function inScope<T>(fn: () => T) {
  const scope = effectScope()
  return { value: scope.run(fn)!, stop: () => scope.stop() }
}

describe('useGatedSurface', () => {
  it('follows eligibility and the gate together', () => {
    const blocked = blocker()
    const wanted = ref(false)
    const { value, stop } = inScope(() =>
      useGatedSurface('whatsNewPopup', () => wanted.value)
    )

    expect(value.shouldShow.value).toBe(false)
    wanted.value = true
    expect(value.shouldShow.value).toBe(true)
    blocked.value = true
    expect(value.shouldShow.value).toBe(false)
    blocked.value = false
    expect(value.shouldShow.value).toBe(true)
    stop()
  })

  it('logs each change of outcome once, with the blocker', async () => {
    const store = useInterruptionStore()
    const blocked = blocker()
    const wanted = ref(true)
    const { value, stop } = inScope(() =>
      useGatedSurface('whatsNewPopup', () => wanted.value)
    )

    expect(value.shouldShow.value).toBe(true)
    await nextTick()
    blocked.value = true
    await nextTick()
    blocked.value = false
    await nextTick()
    wanted.value = false
    await nextTick()

    expect(
      store.exposures.map(({ surface, outcome, by }) => ({
        surface,
        outcome,
        by
      }))
    ).toEqual([
      { surface: 'whatsNewPopup', outcome: 'shown', by: undefined },
      { surface: 'whatsNewPopup', outcome: 'deferred', by: 'dialog' },
      { surface: 'whatsNewPopup', outcome: 'shown', by: undefined },
      { surface: 'whatsNewPopup', outcome: 'withdrawn', by: undefined }
    ])
    stop()
  })

  it('does not evaluate eligibility until the surface is read', async () => {
    const eligible = vi.fn(() => true)
    const { value, stop } = inScope(() =>
      useGatedSurface('whatsNewPopup', eligible)
    )
    await nextTick()

    expect(eligible).not.toHaveBeenCalled()
    expect(value.shouldShow.value).toBe(true)
    stop()
  })

  it('logs nothing for a surface that was never wanted', async () => {
    const store = useInterruptionStore()
    const { stop } = inScope(() =>
      useGatedSurface('whatsNewPopup', () => false)
    )
    await nextTick()

    expect(store.exposures).toEqual([])
    stop()
  })

  it('lets a lower-order announcement hold back a higher-order one', () => {
    const { value, stop } = inScope(() => ({
      toast: useGatedSurface('releaseToast', () => true).shouldShow,
      popup: useGatedSurface('whatsNewPopup', () => true).shouldShow
    }))

    expect(value.toast.value).toBe(true)
    expect(value.popup.value).toBe(false)
    stop()
  })

  it('lets a visible announcement hold back a survey until it goes', () => {
    const toastWanted = ref(true)
    const { value, stop } = inScope(() => ({
      toast: useGatedSurface('releaseToast', () => toastWanted.value)
        .shouldShow,
      survey: useGatedSurface('featureSurvey', () => true).shouldShow
    }))

    expect(value.survey.value).toBe(false)
    toastWanted.value = false
    expect(value.survey.value).toBe(true)
    stop()
  })

  it('stops holding others back once its scope ends', () => {
    const toast = inScope(() => useGatedSurface('releaseToast', () => true))
    const popup = inScope(() => useGatedSurface('whatsNewPopup', () => true))
    expect(popup.value.shouldShow.value).toBe(false)

    toast.stop()
    expect(popup.value.shouldShow.value).toBe(true)
    popup.stop()
  })
})

describe('useGatedAction', () => {
  it('runs once the screen is clear', async () => {
    const run = vi.fn()
    const { stop } = inScope(() =>
      useGatedAction('desktopCloudDialog', () => true, run)
    )

    expect(run).toHaveBeenCalledTimes(1)
    await nextTick()
    expect(run).toHaveBeenCalledTimes(1)
    stop()
  })

  it('does not run while held back, then runs when the blocker leaves', async () => {
    const run = vi.fn()
    const blocked = blocker(ref(true))
    const { value, stop } = inScope(() =>
      useGatedAction('desktopCloudDialog', () => true, run)
    )

    await nextTick()
    expect(run).not.toHaveBeenCalled()
    expect(value.started.value).toBe(false)

    blocked.value = false
    await nextTick()
    expect(run).toHaveBeenCalledTimes(1)
    expect(value.started.value).toBe(true)
    stop()
  })

  it('never runs again after it has run, even if the blocker comes and goes', async () => {
    const run = vi.fn()
    const blocked = blocker()
    const { stop } = inScope(() =>
      useGatedAction('desktopCloudDialog', () => true, run)
    )

    blocked.value = true
    await nextTick()
    blocked.value = false
    await nextTick()

    expect(run).toHaveBeenCalledTimes(1)
    stop()
  })

  it('waits for eligibility', async () => {
    const run = vi.fn()
    const wanted = ref(false)
    const { stop } = inScope(() =>
      useGatedAction('desktopCloudDialog', () => wanted.value, run)
    )

    await nextTick()
    expect(run).not.toHaveBeenCalled()
    wanted.value = true
    await nextTick()
    expect(run).toHaveBeenCalledTimes(1)
    stop()
  })

  it('stops holding lower-ranked surfaces back once it has run', async () => {
    const popup = inScope(() => useGatedSurface('whatsNewPopup', () => true))
    const { stop } = inScope(() =>
      useGatedAction('desktopCloudDialog', () => true, vi.fn())
    )
    await nextTick()

    expect(popup.value.shouldShow.value).toBe(true)
    stop()
    popup.stop()
  })
})
