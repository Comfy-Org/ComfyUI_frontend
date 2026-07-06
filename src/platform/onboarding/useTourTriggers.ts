import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import { useAppModeStore } from '@/stores/appModeStore'

import type { EntryPath } from './onboardingTours'

/** Each tour's auto-open condition, paired with its entry path. */
export function useTourTriggers(): [EntryPath, ComputedRef<boolean>][] {
  const { mode } = useAppMode()
  const appModeStore = useAppModeStore()
  const desktopLayout = useBreakpoints(breakpointsTailwind).greaterOrEqual('md')
  return [
    [
      'appMode',
      computed(
        () =>
          desktopLayout.value && mode.value === 'app' && appModeStore.hasOutputs
      )
    ]
  ]
}
