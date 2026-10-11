import { useFocusNode } from '@/composables/canvas/useFocusNode'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

import { useAgentWorkflowTabBindingStore } from '../../stores/agent/agentWorkflowTabBindingStore'
import { createTargetAwareAgentNavigation } from '../../services/agent/targetAwareAgentNavigation'

export function useAgentTargetNavigation() {
  const bindingStore = useAgentWorkflowTabBindingStore()
  const workflowStore = useWorkflowStore()
  const workflowService = useWorkflowService()
  const { focusNodeInstance } = useFocusNode()

  return createTargetAwareAgentNavigation<ComfyWorkflow, LGraphNode>({
    tabForWorkflow: (workflowId) => {
      const path = bindingStore.tabPathFor(workflowId)
      return path === undefined
        ? undefined
        : (workflowStore.getWorkflowByPath(path) ?? undefined)
    },
    isOpen: (tab) => workflowStore.openWorkflows.includes(tab),
    activate: (tab) => workflowService.openWorkflow(tab),
    activeTab: () => workflowStore.activeWorkflow ?? undefined,
    resolveIn: (tab, locatorId) =>
      workflowStore.activeWorkflow === tab
        ? (getNodeByLocatorId(app.rootGraph, locatorId) ?? undefined)
        : undefined,
    focus: focusNodeInstance
  })
}
