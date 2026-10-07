import { useOnboardingOverlayStore } from '@/platform/onboarding/onboardingOverlayStore'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useDialogStore } from '@/stores/dialogStore'

import { useInterruptionStore } from './interruptionStore'

/**
 * Registers what the gate treats as already on screen. It lives apart from the
 * store so a surface importing the gate does not import every blocker's store
 * graph; the app root calls it once, before any gated surface mounts.
 */
export function registerBuiltInInterruptionSources(): () => void {
  const interruptionStore = useInterruptionStore()
  const dialogStore = useDialogStore()
  const tourStore = useOnboardingTourStore()
  const overlayStore = useOnboardingOverlayStore()
  const canvasStore = useCanvasStore()

  const stops = [
    interruptionStore.registerSource({
      id: 'dialog',
      tier: 'blocking',
      order: 0,
      isActive: () => dialogStore.dialogStack.length > 0
    }),
    interruptionStore.registerSource({
      id: 'firstRunTour',
      tier: 'blocking',
      order: 1,
      isActive: () => tourStore.activeTour === 'firstRun'
    }),
    interruptionStore.registerSource({
      id: 'onboardingOverlay',
      tier: 'blocking',
      order: 2,
      isActive: () => overlayStore.active
    }),
    interruptionStore.registerSource({
      id: 'nodeSelection',
      tier: 'blocking',
      order: 3,
      isActive: () => canvasStore.isPickingNodes
    })
  ]

  return () => stops.forEach((stop) => stop())
}
