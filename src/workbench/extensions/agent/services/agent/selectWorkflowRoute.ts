import type {
  WorkflowIntent,
  WorkflowMediaType,
  WorkflowPlan
} from '../../schemas/workflowPlanSchema'

type WorkflowRouteAvailability =
  | { status: 'ready' }
  | {
      status: 'setup-required'
      missingModels: readonly string[]
      missingNodeTypes: readonly string[]
    }
  | { status: 'unavailable'; reason: string }

export interface WorkflowRouteCandidate {
  id: string
  title: string
  intents: readonly WorkflowIntent[]
  inputCapacity: Partial<Record<WorkflowMediaType, number>>
  outputMediaType: WorkflowMediaType
  supportedStructures: readonly WorkflowPlan['structure']['kind'][]
  supportedPipelineIntents: readonly WorkflowIntent[]
  maxOutputUnits: number
  maxDurationSeconds?: number
  executionMode: 'local' | 'cloud'
  isPaid: boolean
  taskFitScore: number
  qualityScore: number
  speedScore: number
  availability: WorkflowRouteAvailability
}

export type WorkflowRouteSelection =
  | { status: 'needs-input' }
  | { status: 'no-match' }
  | { status: 'ready'; route: WorkflowRouteCandidate }
  | { status: 'approval-required'; route: WorkflowRouteCandidate }
  | {
      status: 'setup-required'
      route: WorkflowRouteCandidate
      readyFallback?: WorkflowRouteCandidate
    }

export function selectWorkflowRoute(
  plan: WorkflowPlan,
  candidates: readonly WorkflowRouteCandidate[]
): WorkflowRouteSelection {
  if (plan.clarification.status === 'needs-input')
    return { status: 'needs-input' }
  const ranked = candidates
    .filter((candidate) => isEligible(candidate, plan))
    .toSorted((left, right) => compareRoutes(left, right, plan.qualityGoal))
  const route = ranked[0]
  if (route === undefined) return { status: 'no-match' }

  if (route.availability.status === 'setup-required') {
    const readyFallback = ranked.find(
      (candidate) => candidate.availability.status === 'ready'
    )
    return {
      status: 'setup-required',
      route,
      ...(readyFallback === undefined ? {} : { readyFallback })
    }
  }

  if (route.isPaid) return { status: 'approval-required', route }
  return { status: 'ready', route }
}

function isEligible(
  candidate: WorkflowRouteCandidate,
  plan: WorkflowPlan
): boolean {
  if (candidate.availability.status === 'unavailable') return false
  if (!candidate.intents.includes(plan.intent)) return false
  if (candidate.outputMediaType !== plan.outputMediaType) return false
  if (!candidate.supportedStructures.includes(plan.structure.kind)) return false
  if (
    plan.pipeline !== undefined &&
    !plan.pipeline.stages.every((stage) =>
      candidate.supportedPipelineIntents.includes(stage.intent)
    )
  )
    return false
  if (requiredOutputUnits(plan) > candidate.maxOutputUnits) return false
  const durationSeconds = requestedDurationSeconds(plan)
  if (
    durationSeconds !== undefined &&
    (candidate.maxDurationSeconds === undefined ||
      durationSeconds > candidate.maxDurationSeconds)
  )
    return false
  if (
    plan.executionPreference === 'local-only' &&
    candidate.executionMode !== 'local'
  )
    return false

  const inputTotals = new Map<WorkflowMediaType, number>()
  for (const input of plan.inputs) {
    inputTotals.set(
      input.mediaType,
      (inputTotals.get(input.mediaType) ?? 0) + input.quantity
    )
  }
  return [...inputTotals].every(
    ([mediaType, quantity]) =>
      quantity <= (candidate.inputCapacity[mediaType] ?? 0)
  )
}

function requiredOutputUnits(plan: WorkflowPlan): number {
  if (plan.structure.kind === 'batch') return plan.structure.unitCount
  if (plan.structure.kind === 'sequence') return plan.structure.units.length
  return 1
}

function requestedDurationSeconds(plan: WorkflowPlan): number | undefined {
  if (plan.targetDurationSeconds !== undefined)
    return plan.targetDurationSeconds
  if (plan.structure.kind !== 'sequence') return undefined
  const durations = plan.structure.units.map((unit) => unit.durationSeconds)
  if (durations.some((duration) => duration === undefined)) return undefined
  let totalDuration = 0
  for (const duration of durations) totalDuration += duration ?? 0
  return totalDuration
}

function compareRoutes(
  left: WorkflowRouteCandidate,
  right: WorkflowRouteCandidate,
  qualityGoal: WorkflowPlan['qualityGoal']
): number {
  const taskFitDifference = right.taskFitScore - left.taskFitScore
  if (taskFitDifference !== 0) return taskFitDifference
  const scoreDifference =
    scoreExperience(right, qualityGoal) - scoreExperience(left, qualityGoal)
  if (scoreDifference !== 0) return scoreDifference
  if (left.availability.status === 'ready') return -1
  if (right.availability.status === 'ready') return 1
  if (left.executionMode === 'local' && right.executionMode !== 'local')
    return -1
  if (right.executionMode === 'local' && left.executionMode !== 'local')
    return 1
  return left.id.localeCompare(right.id)
}

function scoreExperience(
  candidate: WorkflowRouteCandidate,
  qualityGoal: WorkflowPlan['qualityGoal']
): number {
  const qualityWeight = qualityGoal === 'best' ? 8 : 4
  const speedWeight =
    qualityGoal === 'draft' ? 8 : qualityGoal === 'best' ? 1 : 4
  return (
    candidate.qualityScore * qualityWeight + candidate.speedScore * speedWeight
  )
}
