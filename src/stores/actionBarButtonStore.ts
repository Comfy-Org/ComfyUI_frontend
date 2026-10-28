import { defineStore } from 'pinia'
import { computed } from 'vue'

import type { ActionBarButton } from '@/types/comfy'

import { useCustomNodeStore } from '@/platform/customNodes/stores/customNodeStore'

export const useActionBarButtonStore = defineStore('actionBarButton', () => {
  const customNodeStore = useCustomNodeStore()

  const buttons = computed<ActionBarButton[]>(() =>
    customNodeStore.extensions.flatMap((e) => e.actionBarButtons ?? [])
  )

  return {
    buttons
  }
})
