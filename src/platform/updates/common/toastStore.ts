// Within Vue component context, you can directly call useToast().add()
// instead of going through the store.
// The store is useful when you need to call it from outside the Vue component context.
import { defineStore } from 'pinia'
import type { ToastMessageOptions } from 'primevue/toast'
import { ref } from 'vue'

// Coalesce identical toasts fired within this window so a single action can't
// stack the same message repeatedly.
const TOAST_DEDUP_WINDOW_MS = 3000

export const useToastStore = defineStore('toast', () => {
  const messagesToAdd = ref<ToastMessageOptions[]>([])
  const messagesToRemove = ref<ToastMessageOptions[]>([])
  const removeAllRequested = ref(false)

  const recentlyAdded = new Map<string, number>()

  function add(message: ToastMessageOptions) {
    const key = `${String(message.severity ?? '')}|${String(message.summary ?? '')}|${String(message.detail ?? '')}`
    const now = Date.now()
    for (const [k, ts] of recentlyAdded) {
      if (now - ts > TOAST_DEDUP_WINDOW_MS) recentlyAdded.delete(k)
    }
    if (recentlyAdded.has(key)) return
    recentlyAdded.set(key, now)
    messagesToAdd.value = [...messagesToAdd.value, message]
  }

  function remove(message: ToastMessageOptions) {
    messagesToRemove.value = [...messagesToRemove.value, message]
  }

  function removeAll() {
    removeAllRequested.value = true
  }

  function addAlert(message: string) {
    add({ severity: 'warn', summary: 'Alert', detail: message })
  }

  return {
    messagesToAdd,
    messagesToRemove,
    removeAllRequested,

    add,
    remove,
    removeAll,
    addAlert
  }
})
