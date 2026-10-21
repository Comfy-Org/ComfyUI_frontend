import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import type { DeploymentCompatibilityMark } from '@/platform/workspace/composables/useDeploymentCompatibility'

type WorkflowDeploymentOffer =
  | { kind: 'switch'; deployments: WorkspaceDeployment[] }
  | { kind: 'noneRunIt' }
  | { kind: 'unchecked' }

/** What the dialog for a workflow Comfy Cloud lacks nodes for offers, from the compatibility check's answer. */
export function workflowDeploymentOffer(
  deployments: readonly WorkspaceDeployment[],
  markFor: (deploymentId: string) => DeploymentCompatibilityMark | null
): WorkflowDeploymentOffer {
  const marked = deployments.map((deployment) => ({
    deployment,
    mark: markFor(deployment.deployment_id)
  }))
  const runIt = marked.filter(({ mark }) => mark?.kind === 'runs')
  if (runIt.length > 0) {
    return {
      kind: 'switch',
      deployments: runIt.map(({ deployment }) => deployment)
    }
  }
  const eachLacksNodes =
    marked.length > 0 && marked.every(({ mark }) => mark?.kind === 'missing')
  return eachLacksNodes ? { kind: 'noneRunIt' } : { kind: 'unchecked' }
}
