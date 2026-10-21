import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import type { DeploymentCompatibilityMark } from '@/platform/workspace/composables/useDeploymentCompatibility'

/** The compatibility check's mark for a deployment, or for Comfy Cloud given null; null before an answer. */
export type MarkFor = (
  deploymentId: string | null
) => DeploymentCompatibilityMark | null

/** A deployment with the compatibility check's mark for the open workflow; null when the answer leaves it out. */
export interface DeploymentChoice {
  deployment: WorkspaceDeployment
  mark: DeploymentCompatibilityMark | null
}

type WorkflowDeploymentOffer =
  | { kind: 'switch'; choices: DeploymentChoice[] }
  | { kind: 'noneRunIt' }
  | { kind: 'unchecked' }

/** Whether the check's answer is for a workflow with these missing nodes: it finds Comfy Cloud lacking every one. */
export function answersForMissingNodes(
  markFor: MarkFor,
  missingNodeTypes: readonly string[]
): boolean {
  const cloud = markFor(null)
  return (
    cloud?.kind === 'missing' &&
    missingNodeTypes.every((nodeType) => cloud.nodeTypes.includes(nodeType))
  )
}

/** What the dialog for a workflow Comfy Cloud lacks nodes for offers, from the compatibility check's answer; a switch lists the deployments that run it first. */
export function workflowDeploymentOffer(
  deployments: readonly WorkspaceDeployment[],
  markFor: MarkFor,
  missingNodeTypes: readonly string[]
): WorkflowDeploymentOffer {
  if (!answersForMissingNodes(markFor, missingNodeTypes)) {
    return { kind: 'unchecked' }
  }
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
