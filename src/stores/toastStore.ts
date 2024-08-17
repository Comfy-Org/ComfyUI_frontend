// Within Vue component context, you can directly call useToast().add()
// instead of going through the store.
// The store is useful when you need to call it from outside the Vue component context.
import { defineStore } from 'pinia'
import type { ToastMessageOptions } from 'primevue/toast'

export const useToastStore = defineStore('toast', {
  state: () => ({
    messages: [] as ToastMessageOptions[]
  }),

  actions: {
    add(message: ToastMessageOptions) {
      this.messages = [...this.messages, message]
    },
    remove(message: ToastMessageOptions) {
      this.messages = this.messages.filter((msg) => msg !== message)
    },
    removeAll() {
      this.messages = []
    }
  }
})
