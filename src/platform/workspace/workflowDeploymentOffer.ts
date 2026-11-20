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

function nodesCloudLacks(markFor: MarkFor): readonly string[] | null {
  const cloud = markFor(null)
  if (cloud === null || cloud.kind === 'unknown') return null
  return cloud.kind === 'missing' ? cloud.nodeTypes : []
}

/** Whether the check's answer is about this workflow: every node it finds Comfy Cloud lacking is one the workflow runs, and it finds Cloud lacking every missing node the workflow runs. */
export function answersForWorkflow(
  markFor: MarkFor,
  workflow: CheckedWorkflow
): boolean {
  const cloudLacks = nodesCloudLacks(markFor)
  if (cloudLacks === null) return false
  const runsNode = (nodeType: string) => workflow.nodeTypes.includes(nodeType)
  return (
    cloudLacks.every(runsNode) &&
    workflow.missingNodeTypes
      .filter(runsNode)
      .every((nodeType) => cloudLacks.includes(nodeType))
  )
}

function runs(choice: DeploymentChoice): boolean {
  return choice.mark?.kind === 'runs'
}

/** Whether Switch may pick this deployment: it runs the workflow and is ready. */
export function canSwitchTo(choice: DeploymentChoice): boolean {
  return runs(choice) && choice.deployment.status === 'ready'
}

/** What the dialog for a workflow Comfy Cloud lacks nodes for offers, from the compatibility check's answer; a switch lists the deployments it can pick first. */
export function workflowDeploymentOffer(
  deployments: readonly WorkspaceDeployment[],
  markFor: MarkFor,
  workflow: CheckedWorkflow
): WorkflowDeploymentOffer {
  if (
    !answersForWorkflow(markFor, workflow) ||
    markFor(null)?.kind !== 'missing'
  ) {
    return { kind: 'unchecked' }
  }
  const choices = deployments.map((deployment) => ({
    deployment,
    mark: markFor(deployment.deployment_id)
  }))
  if (choices.some(canSwitchTo)) {
    return {
      kind: 'switch',
      choices: [
        ...choices.filter(canSwitchTo),
        ...choices.filter((choice) => runs(choice) && !canSwitchTo(choice)),
        ...choices.filter((choice) => !runs(choice))
      ]
    }
  }
  if (choices.some(runs)) return { kind: 'unchecked' }
  const eachLacksNodes =
    choices.length > 0 && choices.every(({ mark }) => mark?.kind === 'missing')
  return eachLacksNodes ? { kind: 'noneRunIt' } : { kind: 'unchecked' }
}
