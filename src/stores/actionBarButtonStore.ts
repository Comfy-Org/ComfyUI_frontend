import { defineStore } from 'pinia'
import { computed } from 'vue'

import type { ActionBarButton } from '@/types/comfy'

import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import { useComfyApiStore } from '@/platform/nodeApi/v4/comfyApiStore'

export const useActionBarButtonStore = defineStore('actionBarButton', () => {
  const extensionStore = useExtensionStore()

  const buttons = computed<ActionBarButton[]>(() =>
    extensionStore.extensions
      .filter((e) => extensionStore.contributes(e.name))
      .flatMap((e) => e.actionBarButtons ?? [])
      .concat(useComfyApiStore().actionBarButtons)
  )

  return {
    buttons
  }
})
