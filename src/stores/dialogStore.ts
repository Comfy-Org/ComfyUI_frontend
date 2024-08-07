// We should consider moving to https://primevue.org/dynamicdialog/ once everything is in Vue.
// Currently we need to bridge between legacy app code and Vue app with a Pinia store.

import { defineStore } from 'pinia'
import { type Component, markRaw } from 'vue'

interface DialogState {
  isVisible: boolean
  title: string
  component: Component | null
  props: Record<string, any>
}

export const useDialogStore = defineStore('dialog', {
  state: (): DialogState => ({
    isVisible: false,
    title: '',
    component: null,
    props: {}
  }),

  actions: {
    showDialog(options: {
      title?: string
      component: Component
      props?: Record<string, any>
    }) {
      this.title = options.title
      this.component = markRaw(options.component)
      this.props = options.props || {}
      this.isVisible = true
    },

    closeDialog() {
      this.isVisible = false
    }
  }
})
