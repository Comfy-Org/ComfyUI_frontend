import type { Component } from 'vue'

import ModelBrowserDialog from '@/components/modelBrowser/ModelBrowserDialog.vue'
import { useDialogStore } from '@/stores/dialogStore'
import type { ComfyModelDef } from '@/stores/modelStore'
import type { ModelBrowserDialogOptions } from '@/types/modelBrowserTypes'

const DIALOG_KEY = 'global-model-browser'

/**
 * Composable for opening and managing the Model Browser dialog
 */
export function useModelBrowserDialog() {
  const dialogStore = useDialogStore()

  function show(options: ModelBrowserDialogOptions = {}) {
    const { initialModelType, onModelSelected, onClose } = options

    const handleModelSelected = (model: ComfyModelDef) => {
      onModelSelected?.(model)
      close()
    }

    const handleClose = () => {
      onClose?.()
      close()
    }

    dialogStore.showDialog({
      key: DIALOG_KEY,
      component: ModelBrowserDialog as Component,
      props: {
        initialModelType,
        onSelect: handleModelSelected,
        onClose: handleClose
      }
    })
  }

  function close() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  return {
    show,
    close
  }
}
