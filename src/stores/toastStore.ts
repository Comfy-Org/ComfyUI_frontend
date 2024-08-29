// Within Vue component context, you can directly call useToast().add()
// instead of going through the store.
// The store is useful when you need to call it from outside the Vue component context.
import { defineStore } from 'pinia'
import type { ToastMessageOptions } from 'primevue/toast'

export const useToastStore = defineStore('toast', {
  state: () => ({
    messagesToAdd: [] as ToastMessageOptions[],
    messagesToRemove: [] as ToastMessageOptions[],
    removeAllRequested: false
  }),

  actions: {
    add(message: ToastMessageOptions) {
      this.messagesToAdd = [...this.messagesToAdd, message]
    },
    remove(message: ToastMessageOptions) {
      this.messagesToRemove = [...this.messagesToRemove, message]
    },
    removeAll() {
      this.removeAllRequested = true
    }
  }
})
