// We should consider moving to https://primevue.org/dynamicdialog/ once everything is in Vue.
// Currently we need to bridge between legacy app code and Vue app with a Pinia store.

import { defineStore } from 'pinia'
import { ref, type Component, markRaw } from 'vue'

interface DialogComponentProps {
  maximizable?: boolean
  onClose?: () => void
}

interface DialogInstance {
  key: string
  visible: boolean
  title?: string
  headerComponent?: Component
  component: Component
  contentProps: Record<string, any>
  dialogComponentProps: Record<string, any>
}

export interface ShowDialogOptions {
  key?: string
  title?: string
  headerComponent?: Component
  component: Component
  props?: Record<string, any>
  dialogComponentProps?: DialogComponentProps
}

export const useDialogStore = defineStore('dialog', () => {
  const dialogStack = ref<DialogInstance[]>([])

  const genDialogKey = () => `dialog-${Math.random().toString(36).slice(2, 9)}`

  function riseDialog(options: { key: string }) {
    const dialogKey = options.key

    const index = dialogStack.value.findIndex((d) => d.key === dialogKey)
    if (index !== -1) {
      const dialogs = dialogStack.value.splice(index, 1)
      dialogStack.value.push(...dialogs)
    }
  }

  function closeDialog(options?: { key: string }) {
    if (!options) {
      dialogStack.value.pop()
      return
    }

    const dialogKey = options.key

    const index = dialogStack.value.findIndex((d) => d.key === dialogKey)
    if (index === -1) {
      return
    }
    dialogStack.value.splice(index, 1)
  }

  function createDialog(options: {
    key: string
    title?: string
    headerComponent?: Component
    component: Component
    props?: Record<string, any>
    dialogComponentProps?: DialogComponentProps
  }) {
    if (dialogStack.value.length >= 10) {
      dialogStack.value.shift()
    }

    const dialog = {
      key: options.key,
      visible: true,
      title: options.title,
      headerComponent: options.headerComponent
        ? markRaw(options.headerComponent)
        : undefined,
      component: markRaw(options.component),
      contentProps: { ...options.props },
      dialogComponentProps: {
        maximizable: false,
        modal: true,
        closable: true,
        closeOnEscape: true,
        dismissableMask: true,
        ...options.dialogComponentProps,
        maximized: false,
        onMaximize: () => {
          dialog.dialogComponentProps.maximized = true
        },
        onUnmaximize: () => {
          dialog.dialogComponentProps.maximized = false
        },
        onAfterHide: () => {
          options.dialogComponentProps?.onClose?.()
          closeDialog(dialog)
        },
        pt: {
          root: {
            onMousedown: () => {
              riseDialog(dialog)
            }
          }
        }
      }
    }
    dialogStack.value.push(dialog)

    return dialog
  }

  function showDialog(options: ShowDialogOptions) {
    const dialogKey = options.key || genDialogKey()

    let dialog = dialogStack.value.find((d) => d.key === dialogKey)

    if (dialog) {
      dialog.visible = true
      riseDialog(dialog)
    } else {
      dialog = createDialog({ ...options, key: dialogKey })
    }
    return dialog
  }

  return {
    dialogStack,
    riseDialog,
    showDialog,
    closeDialog
  }
})
