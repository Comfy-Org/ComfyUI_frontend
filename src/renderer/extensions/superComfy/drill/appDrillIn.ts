import { once } from 'es-toolkit'

import { useToast } from '@/components/ui/toast/toastStore'
import { useAppMode } from '@/composables/useAppMode'
import { t } from '@/i18n'
import { registerEscapeOverride } from '@/platform/keybindings/escapeOverride'
import { useSuperComfyNavigationStore } from '@/platform/superComfy/stores/superComfyNavigationStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { NodeId } from '@/renderer/extensions/superComfy/engine/documentSchema'

function returnToSuperComfyFromAppRoot(): boolean {
  const navigation = useSuperComfyNavigationStore()
  if (!navigation.parentCrumbVisible || useCanvasStore().isInSubgraph)
    return false
  navigation.returnToSuperComfy()
  return true
}

const returnOnEscapeAtAppRoot = once(() =>
  registerEscapeOverride(returnToSuperComfyFromAppRoot)
)

function showRootGraph() {
  const canvasStore = useCanvasStore()
  if (!canvasStore.isInSubgraph) return
  const canvas = canvasStore.getCanvas()
  if (canvas.graph) canvas.setGraph(canvas.graph.rootGraph)
}

/** Opens an App node's saved workflow at its root graph and leaves SuperComfy; false when it cannot open. */
export async function drillIntoApp(
  appPath: string,
  nodeId: NodeId
): Promise<boolean> {
  const workflowStore = useWorkflowStore()
  await workflowStore.loadWorkflows()
  const workflow = workflowStore.getWorkflowByPath(appPath)
  if (!workflow) {
    useToast().error(t('superComfy.app.notFound'))
    return false
  }
  const opened = await useWorkflowService().openWorkflow(workflow, {
    initiator: 'user'
  })
  if (!opened) return false
  useAppMode().setMode('graph')
  showRootGraph()
  useSuperComfyNavigationStore().markDrilledInto({
    workflowPath: workflow.path,
    appNodeId: nodeId
  })
  returnOnEscapeAtAppRoot()
  return true
}
