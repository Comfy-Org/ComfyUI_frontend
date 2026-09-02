import type {
  WorkflowIntent,
  WorkflowMediaType,
  WorkflowPlan
} from '../../schemas/workflowPlanSchema'

export type WorkflowRouteAvailability =
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
  maxWorkUnits: number
  maxDurationSeconds?: number
  executionMode: 'local' | 'cloud'
  isPaid: boolean
  taskFitScore: number
  qualityScore: number
  speedScore: number
  availability: WorkflowRouteAvailability
}

export type RunnableWorkflowRouteSelection =
  | { status: 'ready'; route: WorkflowRouteCandidate }
  | { status: 'approval-required'; route: WorkflowRouteCandidate }

export type WorkflowRouteSelection =
  | { status: 'needs-input' }
  | { status: 'no-match' }
  | RunnableWorkflowRouteSelection
  | {
      status: 'setup-required'
      route: WorkflowRouteCandidate
      fallback?: RunnableWorkflowRouteSelection
    }

export function selectWorkflowRoute(
  plan: WorkflowPlan,
  candidates: readonly WorkflowRouteCandidate[]
): WorkflowRouteSelection {
  if (plan.clarification.status === 'needs-input')
    return { status: 'needs-input' }
  const ranked = candidates
    .filter((candidate) => isEligible(candidate, plan))
    .sort((left, right) => compareRoutes(left, right, plan.qualityGoal))
  const route = ranked[0]
  if (route === undefined) return { status: 'no-match' }

  if (route.availability.status === 'setup-required') {
    const fallbackRoute = ranked.find(
      (candidate) => candidate.availability.status === 'ready'
    )
    return {
      status: 'setup-required',
      route,
      ...(fallbackRoute === undefined
        ? {}
        : { fallback: selectRunnableRoute(fallbackRoute) })
    }
  }

  return selectRunnableRoute(route)
}

function selectRunnableRoute(
  route: WorkflowRouteCandidate
): RunnableWorkflowRouteSelection {
  return route.isPaid
    ? { status: 'approval-required', route }
    : { status: 'ready', route }
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
  if (requiredWorkUnits(plan) > candidate.maxWorkUnits) return false
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

function requiredWorkUnits(plan: WorkflowPlan): number {
  if (plan.structure.kind === 'batch') return plan.structure.unitCount
  if (plan.structure.kind === 'sequence') return plan.structure.units.length
  return 1
}

function requestedDurationSeconds(plan: WorkflowPlan): number | undefined {
  let structureDurationSeconds: number | undefined
  if (plan.structure.kind === 'batch') {
    const durations = plan.structure.units?.flatMap((unit) =>
      unit.durationSeconds === undefined ? [] : [unit.durationSeconds]
    )
    structureDurationSeconds =
      durations === undefined || durations.length === 0
        ? undefined
        : Math.max(...durations)
  } else if (plan.structure.kind === 'sequence') {
    const durations = plan.structure.units.map((unit) => unit.durationSeconds)
    if (!durations.some((duration) => duration === undefined)) {
      structureDurationSeconds = 0
      for (const duration of durations)
        structureDurationSeconds += duration ?? 0
    }
  }
  if (plan.targetDurationSeconds === undefined) return structureDurationSeconds
  if (structureDurationSeconds === undefined) return plan.targetDurationSeconds
  return Math.max(plan.targetDurationSeconds, structureDurationSeconds)
}

function compareRoutes(
  left: WorkflowRouteCandidate,
  right: WorkflowRouteCandidate,
  qualityGoal: WorkflowPlan['qualityGoal']
): number {
  const taskFitDifference = right.taskFitScore - left.taskFitScore
  if (taskFitDifference !== 0) return taskFitDifference
  const experienceDifference = compareExperience(left, right, qualityGoal)
  if (experienceDifference !== 0) return experienceDifference
  const availabilityDifference =
    Number(left.availability.status !== 'ready') -
    Number(right.availability.status !== 'ready')
  if (availabilityDifference !== 0) return availabilityDifference
  if (!left.isPaid && right.isPaid) return -1
  if (!right.isPaid && left.isPaid) return 1
  if (left.executionMode === 'local' && right.executionMode !== 'local')
    return -1
  if (right.executionMode === 'local' && left.executionMode !== 'local')
    return 1
  if (left.id === right.id) return 0
  return left.id < right.id ? -1 : 1
}

function compareExperience(
  left: WorkflowRouteCandidate,
  right: WorkflowRouteCandidate,
  qualityGoal: WorkflowPlan['qualityGoal']
): number {
  if (qualityGoal === 'best') {
    const qualityDifference = right.qualityScore - left.qualityScore
    return qualityDifference === 0
      ? right.speedScore - left.speedScore
      : qualityDifference
  }
  if (qualityGoal === 'draft') {
    const speedDifference = right.speedScore - left.speedScore
    return speedDifference === 0
      ? right.qualityScore - left.qualityScore
      : speedDifference
  }
  return (
    right.qualityScore + right.speedScore - left.qualityScore - left.speedScore
  )
}
