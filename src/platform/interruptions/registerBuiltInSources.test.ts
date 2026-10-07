import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { Ref } from 'vue'

import { useOnboardingOverlayStore } from '@/platform/onboarding/onboardingOverlayStore'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useDialogStore } from '@/stores/dialogStore'

import { useInterruptionStore } from './interruptionStore'
import { registerBuiltInInterruptionSources } from './registerBuiltInSources'

describe('registerBuiltInInterruptionSources', () => {
  let activeTour: Ref<ReturnType<typeof useOnboardingTourStore>['activeTour']>
  let overlayActive: Ref<boolean>
  let stopSources: () => void

  beforeEach(() => {
    activeTour = ref(null)
    overlayActive = ref(false)
    vi.spyOn(useOnboardingTourStore(), 'activeTour', 'get').mockImplementation(
      () => activeTour.value
    )
    vi.spyOn(useOnboardingOverlayStore(), 'active', 'get').mockImplementation(
      () => overlayActive.value
    )
    stopSources = registerBuiltInInterruptionSources()
  })

  it('shows an announcement when the screen is clear', () => {
    expect(useInterruptionStore().decideFor('whatsNewPopup')).toEqual({
      kind: 'show'
    })
  })

  it('defers while a dialog is open and releases when it closes', () => {
    const store = useInterruptionStore()
    const dialogStore = useDialogStore()

    dialogStore.showDialog({ key: 'settings', component: {} })
    expect(store.decideFor('whatsNewPopup')).toEqual({
      kind: 'defer',
      reason: 'outranked',
      by: 'dialog'
    })

    dialogStore.closeDialog({ key: 'settings' })
    expect(store.decideFor('whatsNewPopup')).toEqual({ kind: 'show' })
  })

  it('defers while node selection mode is active', () => {
    useCanvasStore().isPickingNodes = true

    expect(useInterruptionStore().decideFor('releaseToast')).toMatchObject({
      kind: 'defer',
      by: 'nodeSelection'
    })
  })

  it('defers while an onboarding overlay is active', () => {
    overlayActive.value = true

    expect(useInterruptionStore().decideFor('whatsNewPopup')).toMatchObject({
      kind: 'defer',
      by: 'onboardingOverlay'
    })
  })

  it('defers while the first-run tour is on screen', () => {
    activeTour.value = 'firstRun'

    expect(useInterruptionStore().decideFor('whatsNewPopup')).toMatchObject({
      kind: 'defer',
      by: 'firstRunTour'
    })
  })

  it('does not defer to a tour that does not overlap announcements', () => {
    activeTour.value = 'appMode'

    expect(useInterruptionStore().decideFor('whatsNewPopup')).toEqual({
      kind: 'show'
    })
  })

  it('does not hold back a research surface for a lower-tier blocker', () => {
    expect(useInterruptionStore().decideFor('featureSurvey')).toEqual({
      kind: 'show'
    })
    useDialogStore().showDialog({ key: 'settings', component: {} })
    expect(useInterruptionStore().decideFor('featureSurvey')).toMatchObject({
      kind: 'defer',
      by: 'dialog'
    })
  })

  it('removes every source it registered when stopped', () => {
    useCanvasStore().isPickingNodes = true
    overlayActive.value = true
    activeTour.value = 'firstRun'
    useDialogStore().showDialog({ key: 'settings', component: {} })
    expect(useInterruptionStore().decideFor('whatsNewPopup').kind).toBe('defer')

    stopSources()

    expect(useInterruptionStore().decideFor('whatsNewPopup')).toEqual({
      kind: 'show'
    })
  })
})
