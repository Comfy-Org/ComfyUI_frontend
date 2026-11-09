import type { Component } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { useDialogStore } from '@/stores/dialogStore'

function cardOf(module: { default?: Component } | undefined): Component {
  if (!module?.default)
    throw new TypeError('Failed to fetch dynamically imported module')
  return module.default
}

/** Lazily opens a headless deployment card; a failed load shows a toast and resolves false. */
export async function openCardDialog(
  key: string,
  load: () => Promise<{ default?: Component } | undefined>,
  props: Record<string, unknown>,
  isStillWanted: () => boolean = () => true
): Promise<boolean> {
  const card = await load()
    .then(cardOf)
    .catch((error: unknown) => {
      useErrorHandling().toastErrorHandler(error)
      return null
    })
  if (card === null || !isStillWanted()) return false
  const dialogStore = useDialogStore()
  const hide = () => dialogStore.closeDialog({ key })
  dialogStore.showDialog({
    key,
    component: card,
    props: { ...props, onDone: hide, onDismiss: hide },
    dialogComponentProps: {
      dismissOnPointerDownOutside: true,
      headless: true
    }
  })
  return true
}
