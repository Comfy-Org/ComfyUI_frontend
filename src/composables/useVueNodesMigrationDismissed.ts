import { createSharedComposable, useLocalStorage } from '@vueuse/core'

// Browser storage events don't fire in the same tab, so separate
// useLocalStorage() calls create isolated reactive refs. Use shared
// composable to ensure all components use the same ref instance.
export const useVueNodesMigrationDismissed = createSharedComposable(() =>
  useLocalStorage('comfy.vueNodesMigration.dismissed', false)
)
