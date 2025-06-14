// We should consider moving to https://primevue.org/dynamicdialog/ once everything is in Vue.
// Currently we need to bridge between legacy app code and Vue app with a Pinia store.
import { merge } from 'lodash'
import { defineStore } from 'pinia'
import type { DialogPassThroughOptions } from 'primevue/dialog'
import { type Component, markRaw, ref } from 'vue'

import type GlobalDialog from '@/components/dialog/GlobalDialog.vue'

type DialogPosition =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'topleft'
  | 'topright'
  | 'bottomleft'
  | 'bottomright'

interface CustomDialogComponentProps {
  maximizable?: boolean
  maximized?: boolean
  onClose?: () => void
  closable?: boolean
  modal?: boolean
  position?: DialogPosition
  pt?: DialogPassThroughOptions
}

type DialogComponentProps = InstanceType<typeof GlobalDialog>['$props'] &
  CustomDialogComponentProps

interface DialogInstance {
  key: string
  visible: boolean
  title?: string
  headerComponent?: Component
  component: Component
  contentProps: Record<string, any>
  footerComponent?: Component
  dialogComponentProps: DialogComponentProps
}

export interface ShowDialogOptions {
  key?: string
  title?: string
  headerComponent?: Component
  footerComponent?: Component
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
    const targetDialog = options
      ? dialogStack.value.find((d) => d.key === options.key)
      : dialogStack.value[0]
    if (!targetDialog) return

    targetDialog.dialogComponentProps?.onClose?.()
    dialogStack.value.splice(dialogStack.value.indexOf(targetDialog), 1)
  }

  function createDialog(options: {
    key: string
    title?: string
    headerComponent?: Component
    footerComponent?: Component
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
      footerComponent: options.footerComponent
        ? markRaw(options.footerComponent)
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
          closeDialog(dialog)
        },
        pt: merge(options.dialogComponentProps?.pt || {}, {
          root: {
            onMousedown: () => {
              riseDialog(dialog)
            }
          }
        })
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

  /**
   * Shows a dialog from a third party extension.
   * Explicitly keys extension dialogs with `extension-` prefix,
   * to avoid conflicts & prevent use of internal dialogs (available via `dialogService`).
   */
  function showExtensionDialog(options: ShowDialogOptions & { key: string }) {
    const { key } = options
    if (!key) {
      console.error('Extension dialog key is required')
      return
    }

    const extKey = key.startsWith('extension-') ? key : `extension-${key}`

    const dialog = dialogStack.value.find((d) => d.key === extKey)
    if (!dialog) return createDialog({ ...options, key: extKey })

    dialog.visible = true
    riseDialog(dialog)
    return dialog
  }

  function isDialogOpen(key: string) {
    return dialogStack.value.some((d) => d.key === key)
  }

  return {
    dialogStack,
    riseDialog,
    showDialog,
    closeDialog,
    showExtensionDialog,
    isDialogOpen
  }
})
