import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import type { DeploymentCompatibilityMark } from '@/platform/workspace/composables/useDeploymentCompatibility'

/** A deployment with the compatibility check's mark for the open workflow; null when the answer leaves it out. */
export interface DeploymentChoice {
  deployment: WorkspaceDeployment
  mark: DeploymentCompatibilityMark | null
}

type WorkflowDeploymentOffer =
  | { kind: 'switch'; choices: DeploymentChoice[] }
  | { kind: 'noneRunIt' }
  | { kind: 'unchecked' }

/** What the dialog for a workflow Comfy Cloud lacks nodes for offers, from the compatibility check's answer; a switch lists the deployments that run it first. */
export function workflowDeploymentOffer(
  deployments: readonly WorkspaceDeployment[],
  markFor: (deploymentId: string) => DeploymentCompatibilityMark | null
): WorkflowDeploymentOffer {
  const choices = deployments.map((deployment) => ({
    deployment,
    mark: markFor(deployment.deployment_id)
  }))
  const runs = (choice: DeploymentChoice) => choice.mark?.kind === 'runs'
  if (choices.some(runs)) {
    return {
      kind: 'switch',
      choices: [
        ...choices.filter(runs),
        ...choices.filter((choice) => !runs(choice))
      ]
    }
  }
  const eachLacksNodes =
    choices.length > 0 && choices.every(({ mark }) => mark?.kind === 'missing')
  return eachLacksNodes ? { kind: 'noneRunIt' } : { kind: 'unchecked' }
}
