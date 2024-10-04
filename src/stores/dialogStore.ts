// We should consider moving to https://primevue.org/dynamicdialog/ once everything is in Vue.
// Currently we need to bridge between legacy app code and Vue app with a Pinia store.

import { defineStore } from 'pinia'
import { type Component, markRaw } from 'vue'

interface DialogState {
  isVisible: boolean
  title: string
  headerComponent: Component | null
  component: Component | null
  // Props passing to the component
  props: Record<string, any>
  // Props passing to the Dialog component
  dialogComponentProps: DialogComponentProps
}

interface DialogComponentProps {
  maximizable?: boolean
  onClose?: () => void
}

export const useDialogStore = defineStore('dialog', {
  state: (): DialogState => ({
    isVisible: false,
    title: '',
    headerComponent: null,
    component: null,
    props: {},
    dialogComponentProps: {}
  }),

  actions: {
    showDialog(options: {
      title?: string
      headerComponent?: Component
      component: Component
      props?: Record<string, any>
      dialogComponentProps?: DialogComponentProps
    }) {
      this.title = options.title
      this.headerComponent = markRaw(options.headerComponent)
      this.component = markRaw(options.component)
      this.props = options.props || {}
      this.dialogComponentProps = options.dialogComponentProps || {}
      this.isVisible = true
    },

    closeDialog() {
      if (this.dialogComponentProps.onClose) {
        this.dialogComponentProps.onClose()
      }
      this.isVisible = false
    }
  }
})
