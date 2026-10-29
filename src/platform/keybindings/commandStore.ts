import { defineCommandStore } from '@comfyorg/keybindings/commandStore'

import { useErrorHandling } from '@/composables/useErrorHandling'

export const useCommandStore = defineCommandStore(
  () => useErrorHandling().toastErrorHandler
)
