import { useAppMode } from '@/composables/useAppMode'
import { useAppModeStore } from '@/stores/appModeStore'

import { useEmptyWorkflowDialog } from './useEmptyWorkflowDialog'

export function useEnterBuilder() {
  const appModeStore = useAppModeStore()
  const { setMode } = useAppMode()
  const emptyWorkflowDialog = useEmptyWorkflowDialog()

  function enterBuilder() {
    if (!appModeStore.hasNodes) {
      emptyWorkflowDialog.show({
        onEnterBuilder: enterBuilder,
        onDismiss: () => setMode('graph')
      })
      return
    }
    appModeStore.enterBuilder()
  }

  return { enterBuilder }
}
