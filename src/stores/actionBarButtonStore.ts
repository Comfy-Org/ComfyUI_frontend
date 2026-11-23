import { defineStore } from 'pinia'
import { computed } from 'vue'

import type { ActionBarButton } from '@/types/comfy'

import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import { useNodeApiHost } from '@/platform/nodeApi/nodeApiHost'

export const useActionBarButtonStore = defineStore('actionBarButton', () => {
  const extensionStore = useExtensionStore()

  const buttons = computed<ActionBarButton[]>(() =>
    extensionStore.extensions
      .filter((e) => extensionStore.contributes(e.name))
      .flatMap((e) => e.actionBarButtons ?? [])
      .concat(useNodeApiHost().actionBarButtons)
  )

  return {
    buttons
  }
})
