import { defineStore } from 'pinia'
import { Component } from 'vue'

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
      title: string
      component: Component
      props?: Record<string, any>
    }) {
      this.title = options.title
      this.component = options.component
      this.props = options.props || {}
      this.isVisible = true
    },

    closeDialog() {
      this.isVisible = false
    }
  }
})
