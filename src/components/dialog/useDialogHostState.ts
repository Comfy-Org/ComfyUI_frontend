import { computed } from 'vue'

import { useDialogStore } from '@/stores/dialogStore'

export function useDialogHostState() {
  const dialogStore = useDialogStore()

  return {
    hasOpenDialog: computed(() => dialogStore.dialogStack.length > 0)
  }
}
