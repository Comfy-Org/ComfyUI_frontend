import type { MissingNodeType } from '@/platform/nodeReplacement/types'
import { workflowNodeTypes } from '@/platform/workspace/composables/useDeploymentCompatibility'
import { missingNodeTypeName } from '@/platform/workspace/missingForDeployment'
import type { CheckedWorkflow } from '@/platform/workspace/workflowDeploymentOffer'
import { app, sanitizeNodeName } from '@/scripts/app'

/** The open workflow as the compatibility check names its nodes: the types it sends, and these missing ones as the graph spells them. */
export function openWorkflowForCheck(
  missingNodes: readonly MissingNodeType[]
): CheckedWorkflow {
  return {
    nodeTypes: app.isGraphReady ? workflowNodeTypes(app.rootGraph) : [],
    missingNodeTypes: missingNodes.map((node) =>
      sanitizeNodeName(missingNodeTypeName(node))
    )
  }
}
