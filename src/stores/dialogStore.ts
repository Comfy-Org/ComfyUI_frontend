// We should consider moving to https://primevue.org/dynamicdialog/ once everything is in Vue.
// Currently we need to bridge between legacy app code and Vue app with a Pinia store.
import { merge } from 'es-toolkit/compat'
import { defineStore } from 'pinia'
import type { DialogPassThroughOptions } from 'primevue/dialog'
import { markRaw, ref } from 'vue'
import type { Component } from 'vue'

import type GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import type { ComponentAttrs } from 'vue-component-type-helpers'

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
  closeOnEscape?: boolean
  dismissableMask?: boolean
  unstyled?: boolean
  headless?: boolean
}

export type DialogComponentProps = ComponentAttrs<typeof GlobalDialog> &
  CustomDialogComponentProps

interface DialogInstance<
  H extends Component = Component,
  B extends Component = Component,
  F extends Component = Component
> {
  key: string
  visible: boolean
  title?: string
  headerComponent?: H
  headerProps?: ComponentAttrs<H>
  component: B
  contentProps: ComponentAttrs<B>
  footerComponent?: F
  footerProps?: ComponentAttrs<F>
  dialogComponentProps: DialogComponentProps
  priority: number
}

export interface ShowDialogOptions<
  H extends Component = Component,
  B extends Component = Component,
  F extends Component = Component
> {
  key?: string
  title?: string
  headerComponent?: H
  footerComponent?: F
  component: B
  props?: ComponentAttrs<B>
  headerProps?: ComponentAttrs<H>
  footerProps?: ComponentAttrs<F>
  dialogComponentProps?: DialogComponentProps
  /**
   * Optional priority for dialog stacking.
   * A dialog will never be shown above a dialog with a higher priority.
   * @default 1
   */
  priority?: number
}

export const useDialogStore = defineStore('dialog', () => {
  const dialogStack = ref<DialogInstance[]>([])

  /**
   * The key of the currently active (top-most) dialog.
   * Only the active dialog can be closed with the ESC key.
   */
  const activeKey = ref<string | null>(null)

  const genDialogKey = () => `dialog-${Math.random().toString(36).slice(2, 9)}`

  /**
   * Inserts a dialog into the stack at the correct position based on priority.
   * Higher priority dialogs are placed before lower priority ones.
   */
  function insertDialogByPriority(dialog: DialogInstance) {
    const insertIndex = dialogStack.value.findIndex(
      (d) => d.priority <= dialog.priority
    )

    dialogStack.value.splice(
      insertIndex === -1 ? dialogStack.value.length : insertIndex,
      0,
      dialog
    )
  }

  function riseDialog(options: { key: string }) {
    const dialogKey = options.key

    const index = dialogStack.value.findIndex((d) => d.key === dialogKey)
    if (index !== -1) {
      const [dialog] = dialogStack.value.splice(index, 1)
      insertDialogByPriority(dialog)
      activeKey.value = dialogKey
      updateCloseOnEscapeStates()
    }
  }

  /**
   * Closes the dialog identified by the given key or the currently active dialog when no key is provided.
   *
   * Invokes the dialog's `onClose` callback if present, removes the dialog from the stack, updates the active dialog key, and adjusts close-on-Escape handling. If no matching dialog is found this function is a no-op.
   *
   * @param options - Optional object with a `key` specifying which dialog to close; when omitted the active dialog is closed.
   */
  function closeDialog(options?: { key: string }) {
    const targetDialog = options
      ? dialogStack.value.find((d) => d.key === options.key)
      : dialogStack.value.find((d) => d.key === activeKey.value)
    if (!targetDialog) return

    targetDialog.dialogComponentProps?.onClose?.()
    const index = dialogStack.value.indexOf(targetDialog)
    dialogStack.value.splice(index, 1)

    activeKey.value =
      dialogStack.value.length > 0
        ? dialogStack.value[dialogStack.value.length - 1].key
        : null

    updateCloseOnEscapeStates()
  }

  /**
   * Create and register a dialog instance from the given options and push it into the dialog stack.
   *
   * @param options - Configuration for the dialog. Must include a unique `key`. Other fields configure the component to render (`component`), optional `title`, optional `headerComponent`/`footerComponent` and their props, additional `props` for the content component, `dialogComponentProps` for dialog behavior, and an optional numeric `priority`.
   * @returns The created dialog instance that was inserted into the store's stack.
   *
   * Side effects: enforces a maximum stack size of 10 by removing the oldest dialog when necessary, inserts the new dialog according to its priority, sets the dialog as the active one, and updates close-on-escape handling for the stack.
   */
  function createDialog<
    H extends Component = Component,
    B extends Component = Component,
    F extends Component = Component
  >(options: ShowDialogOptions<H, B, F> & { key: string }) {
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
      headerProps: { ...options.headerProps },
      contentProps: { ...options.props },
      footerProps: { ...options.footerProps },
      priority: options.priority ?? 1,
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

    insertDialogByPriority(dialog)
    activeKey.value = options.key
    updateCloseOnEscapeStates()

    return dialog
  }

  /**
   * Ensures only the top-most dialog in the stack can be closed with the Escape key.
   * This is necessary because PrimeVue Dialogs do not handle `closeOnEscape` prop
   * correctly when multiple dialogs are open.
   */
  function updateCloseOnEscapeStates() {
    const topDialog = dialogStack.value.find((d) => d.key === activeKey.value)
    const topClosable = topDialog?.dialogComponentProps.closable

    dialogStack.value.forEach((dialog) => {
      dialog.dialogComponentProps = {
        ...dialog.dialogComponentProps,
        closeOnEscape: dialog === topDialog && !!topClosable
      }
    })
  }

  /**
   * Opens the dialog described by `options` and ensures it is the active (top-most) dialog, creating a new dialog if one with the same key does not exist.
   *
   * @param options - Configuration for the dialog to show; may include a `key` to target an existing dialog or omit it to generate a new key
   * @returns The dialog instance that was shown or created
   */
  function showDialog<
    H extends Component = Component,
    B extends Component = Component,
    F extends Component = Component
  >(options: ShowDialogOptions<H, B, F>) {
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
    isDialogOpen,
    activeKey
  }
})
