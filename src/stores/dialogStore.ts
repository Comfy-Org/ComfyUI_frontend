// We should consider moving to https://primevue.org/dynamicdialog/ once everything is in Vue.
// Currently we need to bridge between legacy app code and Vue app with a Pinia store.

import { defineStore } from 'pinia'
import { ref, shallowRef, type Component, markRaw } from 'vue'

interface DialogComponentProps {
  maximizable?: boolean
  onClose?: () => void
}

export const useDialogStore = defineStore('dialog', () => {
  const isVisible = ref(false)
  const title = ref('')
  const headerComponent = shallowRef<Component | null>(null)
  const component = shallowRef<Component | null>(null)
  const props = ref<Record<string, any>>({})
  const dialogComponentProps = ref<DialogComponentProps>({})

  function showDialog(options: {
    title?: string
    headerComponent?: Component
    component: Component
    props?: Record<string, any>
    dialogComponentProps?: DialogComponentProps
  }) {
    isVisible.value = true
    title.value = options.title ?? ''
    headerComponent.value = options.headerComponent
      ? markRaw(options.headerComponent)
      : null
    component.value = markRaw(options.component)
    props.value = options.props || {}
    dialogComponentProps.value = options.dialogComponentProps || {}
  }

  function closeDialog() {
    if (dialogComponentProps.value.onClose) {
      dialogComponentProps.value.onClose()
    }
    isVisible.value = false
  }

  return {
    isVisible,
    title,
    headerComponent,
    component,
    props,
    dialogComponentProps,
    showDialog,
    closeDialog
  }
})
