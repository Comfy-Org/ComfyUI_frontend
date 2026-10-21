import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import type { DeploymentCompatibilityMark } from '@/platform/workspace/composables/useDeploymentCompatibility'

/** The compatibility check's mark for a deployment, or for Comfy Cloud given null; null before an answer. */
export type MarkFor = (
  deploymentId: string | null
) => DeploymentCompatibilityMark | null

/** The open workflow's node types, and the ones the editor found missing, as the check names them. */
export interface CheckedWorkflow {
  nodeTypes: readonly string[]
  missingNodeTypes: readonly string[]
}

/** A deployment with the compatibility check's mark for the open workflow; null when the answer leaves it out. */
export interface DeploymentChoice {
  deployment: WorkspaceDeployment
  mark: DeploymentCompatibilityMark | null
}

type WorkflowDeploymentOffer =
  | { kind: 'switch'; choices: DeploymentChoice[] }
  | { kind: 'noneRunIt' }
  | { kind: 'unchecked' }

/** Whether the check's answer is about this workflow: every node it finds Comfy Cloud lacking is one the workflow uses, and it finds Cloud lacking every node the editor found missing. */
export function answersForWorkflow(
  markFor: MarkFor,
  workflow: CheckedWorkflow
): boolean {
  const cloud = markFor(null)
  return (
    cloud?.kind === 'missing' &&
    cloud.nodeTypes.every((nodeType) =>
      workflow.nodeTypes.includes(nodeType)
    ) &&
    workflow.missingNodeTypes.every((nodeType) =>
      cloud.nodeTypes.includes(nodeType)
    )
  )
}

function runs(choice: DeploymentChoice): boolean {
  return choice.mark?.kind === 'runs'
}

function isReady(choice: DeploymentChoice): boolean {
  return choice.deployment.status === 'ready'
}

/** What the dialog for a workflow Comfy Cloud lacks nodes for offers, from the compatibility check's answer; a switch lists the ready deployments that run it first. */
export function workflowDeploymentOffer(
  deployments: readonly WorkspaceDeployment[],
  markFor: MarkFor,
  workflow: CheckedWorkflow
): WorkflowDeploymentOffer {
  if (!answersForWorkflow(markFor, workflow)) return { kind: 'unchecked' }
  const choices = deployments.map((deployment) => ({
    deployment,
    mark: markFor(deployment.deployment_id)
  }))
  if (choices.some(runs)) {
    return {
      kind: 'switch',
      choices: [
        ...choices.filter((choice) => runs(choice) && isReady(choice)),
        ...choices.filter((choice) => runs(choice) && !isReady(choice)),
        ...choices.filter((choice) => !runs(choice))
      ]
    }
  }
  const eachLacksNodes =
    choices.length > 0 && choices.every(({ mark }) => mark?.kind === 'missing')
  return eachLacksNodes ? { kind: 'noneRunIt' } : { kind: 'unchecked' }
}
