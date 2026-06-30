import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import { useAppModeStore } from '@/stores/appModeStore'

import type { EntryPath } from './onboardingTours'

/**
 * Each tour's auto-open condition, paired with its entry path. Adding an
 * auto-opening tour means adding an entry here, not editing the engine.
 */
export function useTourTriggers(): [EntryPath, ComputedRef<boolean>][] {
  const { mode } = useAppMode()
  const appModeStore = useAppModeStore()
  return [
    ['appMode', computed(() => mode.value === 'app' && appModeStore.hasOutputs)]
  ]
}
