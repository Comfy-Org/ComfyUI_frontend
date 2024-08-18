// This module is mocked in tests-ui/
// Import vue components here to avoid tests-ui/ reporting errors
// about importing primevue components.
import { useDialogStore } from '@/stores/dialogStore'
import LoadWorkflowWarning from '@/components/dialog/content/LoadWorkflowWarning.vue'
import SettingDialogContent from '@/components/dialog/content/SettingDialogContent.vue'
import SettingDialogHeader from '@/components/dialog/header/SettingDialogHeader.vue'

export function showLoadWorkflowWarning(props: {
  missingNodeTypes: any[]
  hasAddedNodes: boolean
  [key: string]: any
}) {
  const dialogStore = useDialogStore()
  dialogStore.showDialog({
    component: LoadWorkflowWarning,
    props
  })
}

export function showSettingsDialog() {
  useDialogStore().showDialog({
    headerComponent: SettingDialogHeader,
    component: SettingDialogContent
  })
}
