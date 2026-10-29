import { defineStore } from 'pinia'
import { computed } from 'vue'

import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import type { ActionBarButton } from '@/types/comfy'

export const useActionBarButtonStore = defineStore('actionBarButton', () => {
  const extensionStore = useExtensionStore()

  const buttons = computed<ActionBarButton[]>(() =>
    extensionStore.extensions.flatMap((e) => e.actionBarButtons ?? [])
  )

  return {
    buttons
  }
})
