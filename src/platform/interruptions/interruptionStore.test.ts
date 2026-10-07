import { describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { useOnboardingOverlayStore } from '@/platform/onboarding/onboardingOverlayStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useDialogStore } from '@/stores/dialogStore'

import { useInterruptionStore } from './interruptionStore'
import { useGatedSurface } from './useGatedSurface'

const Stub = {}

describe('useInterruptionStore built-in sources', () => {
  it('shows an announcement when the screen is clear', () => {
    expect(useInterruptionStore().decideFor('whatsNewPopup')).toEqual({
      kind: 'show'
    })
  })

  it('defers while a dialog is open and releases when it closes', () => {
    const store = useInterruptionStore()
    const dialogStore = useDialogStore()

    dialogStore.showDialog({ key: 'settings', component: Stub })
    expect(store.decideFor('whatsNewPopup')).toEqual({
      kind: 'defer',
      reason: 'outranked',
      by: 'dialog'
    })

    dialogStore.closeDialog({ key: 'settings' })
    expect(store.decideFor('whatsNewPopup')).toEqual({ kind: 'show' })
  })

  it('defers while node selection mode is active', () => {
    const store = useInterruptionStore()
    useAgentNodeSelectionStore().isActive = true

    expect(store.decideFor('releaseToast')).toMatchObject({
      kind: 'defer',
      by: 'nodeSelection'
    })
  })

  it('defers while an onboarding overlay is active', () => {
    const store = useInterruptionStore()
    const running = ref(true)
    useOnboardingOverlayStore().registerSource(() => running.value)

    expect(store.decideFor('whatsNewPopup')).toMatchObject({
      kind: 'defer',
      by: 'onboardingOverlay'
    })
    running.value = false
    expect(store.decideFor('whatsNewPopup')).toEqual({ kind: 'show' })
  })
})

describe('useInterruptionStore.registerSource', () => {
  it('drops a source with its owning scope', () => {
    const store = useInterruptionStore()
    const scope = effectScope()
    scope.run(() =>
      store.registerSource({
        id: 'scoped',
        tier: 'blocking',
        order: 9,
        isActive: () => true
      })
    )
    expect(store.decideFor('whatsNewPopup')).toMatchObject({ by: 'scoped' })

    scope.stop()
    expect(store.decideFor('whatsNewPopup')).toEqual({ kind: 'show' })
  })

  it('stops a source by hand', () => {
    const store = useInterruptionStore()
    const stop = store.registerSource({
      id: 'manual',
      tier: 'blocking',
      order: 9,
      isActive: () => true
    })
    stop()

    expect(store.decideFor('whatsNewPopup')).toEqual({ kind: 'show' })
  })
})

describe('useGatedSurface', () => {
  it('follows eligibility and the gate together', () => {
    const wanted = ref(false)
    const dialogStore = useDialogStore()
    const scope = effectScope()
    const { shouldShow } = scope.run(() =>
      useGatedSurface('whatsNewPopup', () => wanted.value)
    )!

    expect(shouldShow.value).toBe(false)
    wanted.value = true
    expect(shouldShow.value).toBe(true)
    dialogStore.showDialog({ key: 'settings', component: Stub })
    expect(shouldShow.value).toBe(false)
    dialogStore.closeDialog({ key: 'settings' })
    expect(shouldShow.value).toBe(true)
    scope.stop()
  })

  it('logs each change of outcome once, with the blocker', async () => {
    const store = useInterruptionStore()
    const dialogStore = useDialogStore()
    const wanted = ref(true)
    const scope = effectScope()
    scope.run(() => useGatedSurface('whatsNewPopup', () => wanted.value))

    await nextTick()
    dialogStore.showDialog({ key: 'settings', component: Stub })
    await nextTick()
    dialogStore.closeDialog({ key: 'settings' })
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
    scope.stop()
  })

  it('logs nothing for a surface that was never wanted', () => {
    const store = useInterruptionStore()
    const scope = effectScope()
    scope.run(() => useGatedSurface('whatsNewPopup', () => false))

    expect(store.exposures).toEqual([])
    scope.stop()
  })

  it('lets a lower-order announcement hold back a higher-order one', () => {
    const scope = effectScope()
    const { toast, popup } = scope.run(() => ({
      toast: useGatedSurface('releaseToast', () => true).shouldShow,
      popup: useGatedSurface('whatsNewPopup', () => true).shouldShow
    }))!

    expect(toast.value).toBe(true)
    expect(popup.value).toBe(false)
    scope.stop()
  })

  it('keeps the exposure log bounded', () => {
    const store = useInterruptionStore()
    for (let i = 0; i < 250; i++)
      store.record({
        surface: 'releaseToast',
        tier: 'announcement',
        outcome: 'shown'
      })

    expect(store.exposures).toHaveLength(200)
  })
})
