import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import type { MarkFor } from '@/platform/workspace/workflowDeploymentOffer'

/**
 * Where to switch when the picked deployment cannot run jobs: Comfy Cloud
 * (null), unless it lacks the workflow's nodes and another ready deployment runs it.
 */
export function recommendedDeploymentId(
  deployments: readonly WorkspaceDeployment[],
  markFor: MarkFor,
  pickedDeploymentId: string | null
): string | null {
  if (markFor(null)?.kind !== 'missing') return null
  const readyAndRunsIt = deployments.find(
    (deployment) =>
      deployment.deployment_id !== pickedDeploymentId &&
      deployment.status === 'ready' &&
      markFor(deployment.deployment_id)?.kind === 'runs'
  )
  return readyAndRunsIt?.deployment_id ?? null
}
