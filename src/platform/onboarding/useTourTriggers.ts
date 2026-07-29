import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useAppModeStore } from '@/stores/appModeStore'

import type { EntryPath } from './onboardingTours'

export interface TourTrigger {
  holds: ComputedRef<boolean>
  autoOpen: ComputedRef<boolean>
}

/** Each tour's auto-open condition, paired with its entry path. */
export function useTourTriggers(): [EntryPath, TourTrigger][] {
  const { mode } = useAppMode()
  const appModeStore = useAppModeStore()
  const settingStore = useSettingStore()
  const desktopLayout = useBreakpoints(breakpointsTailwind).greaterOrEqual('md')
  const inAppMode = computed(() => desktopLayout.value && mode.value === 'app')

  const inGraphMode = computed(() => mode.value === 'graph')
  return [
    [
      'appMode',
      {
        holds: inAppMode,
        autoOpen: computed(() => inAppMode.value && appModeStore.hasOutputs)
      }
    ],
    [
      'graph',
      {
        holds: inGraphMode,
        autoOpen: computed(
          () => !settingStore.get('Comfy.TutorialCompleted') || true
        )
      }
    ]
  ]
}
