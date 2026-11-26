import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'
import { reportError } from '@comfyorg/telemetry/reportError'
import { workflowNodeTypes } from '@/platform/workspace/composables/useDeploymentCompatibility'
import { missingNodeTypeName } from '@/platform/workspace/missingForDeployment'
import type { CheckedWorkflow } from '@/platform/workspace/workflowDeploymentOffer'
import { sanitizeNodeName } from '@/scripts/app'
import { useApp } from '@/scripts/appInstance'

function graphNodeTypes(): string[] {
  if (!useFeatureFlags().flags.deploymentCompatibilityMarksEnabled) return []
  if (!useApp().isGraphReady) return []
  try {
    return workflowNodeTypes(useApp().rootGraph)
  } catch (error) {
    reportError(error, {
      errorType: 'error_reading_workflow_node_types',
      surface: 'workspace',
      level: 'warning'
    })
    return []
  }
}

/** The open workflow as the compatibility check names its nodes: the types it sends, none while the check is off or the graph cannot be read, and these missing ones as the graph spells them. */
export function openWorkflowForCheck(
  missingNodes: readonly MissingNodeType[]
): CheckedWorkflow {
  return {
    nodeTypes: graphNodeTypes(),
    missingNodeTypes: missingNodes.map((node) =>
      sanitizeNodeName(missingNodeTypeName(node))
    )
  }
}
