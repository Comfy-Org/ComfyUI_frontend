import type { ComponentAttrs } from 'vue-component-type-helpers'

import MissingModelsWarning from '@/components/dialog/content/MissingModelsWarning.vue'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-missing-models-warning'

export function useMissingModelsDialog() {
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show(props: ComponentAttrs<typeof MissingModelsWarning>) {
    dialogStore.showDialog({
      key: DIALOG_KEY,
      component: MissingModelsWarning,
      props
    })
  }

  return { show, hide }
}
