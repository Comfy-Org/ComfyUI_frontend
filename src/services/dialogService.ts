import { useDialogStore } from '@/stores/dialogStore'
import LoadWorkflowWarning from '@/components/dialog/content/LoadWorkflowWarning.vue'
import { markRaw } from 'vue'

export function showLoadWorkflowWarning(
  missingNodeTypes: any[],
  hasAddedNodes: boolean
) {
  const dialogStore = useDialogStore()
  dialogStore.showDialog({
    component: markRaw(LoadWorkflowWarning),
    props: {
      missingNodeTypes,
      hasAddedNodes
    }
  })
}
