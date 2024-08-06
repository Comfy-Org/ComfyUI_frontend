import { useDialogStore } from '@/stores/dialogStore'
import LoadWorkflowWarning from '@/components/dialog/content/LoadWorkflowWarning.vue'
import { markRaw } from 'vue'

export function showLoadWorkflowWarning(props: {
  missingNodeTypes: any[]
  hasAddedNodes: boolean
  [key: string]: any
}) {
  const dialogStore = useDialogStore()
  dialogStore.showDialog({
    component: markRaw(LoadWorkflowWarning),
    props
  })
}
