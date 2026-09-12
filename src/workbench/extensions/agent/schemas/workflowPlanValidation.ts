import { sumBy } from 'es-toolkit'
import { z } from 'zod'

import type {
  WorkflowIntent,
  WorkflowMediaType,
  WorkflowPlan
} from './workflowPlanSchema'

type PipelineStage = NonNullable<WorkflowPlan['pipeline']>['stages'][number]

const OUTPUT_MEDIA_BY_INTENT: Record<WorkflowIntent, WorkflowMediaType> = {
  'text-to-image': 'image',
  'image-edit': 'image',
  'image-upscale': 'image',
  'text-to-video': 'video',
  'image-to-video': 'video',
  'video-edit': 'video',
  'text-to-audio': 'audio',
  'audio-edit': 'audio',
  'text-to-3d': '3d',
  'image-to-3d': '3d'
}

const INPUT_MEDIA_BY_INTENT: Partial<
  Record<WorkflowIntent, WorkflowMediaType>
> = {
  'image-edit': 'image',
  'image-upscale': 'image',
  'image-to-video': 'image',
  'video-edit': 'video',
  'audio-edit': 'audio',
  'image-to-3d': 'image'
}

export function addWorkflowPlanIssues(
  plan: WorkflowPlan,
  context: z.RefinementCtx
): void {
  addDuplicateIssue(
    plan.inputs.map((input) => input.id),
    ['inputs'],
    context
  )
  if (plan.clarification.status === 'needs-input') return

  addIntentCompatibilityIssues(
    plan.intent,
    plan.inputs.map((input) => input.mediaType),
    plan.outputMediaType,
    ['inputs'],
    ['outputMediaType'],
    context
  )
  addStructureIssues(plan, context)
  if (plan.pipeline !== undefined) addPipelineIssues(plan, context)
}

function addStructureIssues(
  plan: WorkflowPlan,
  context: z.RefinementCtx
): void {
  if (plan.structure.kind === 'batch') {
    const { units, unitCount } = plan.structure
    if (units !== undefined && units.length !== unitCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Batch unitCount must match the number of units',
        path: ['structure', 'units']
      })
    }
    if (units !== undefined)
      addDuplicateIssue(
        units.map((unit) => unit.id),
        ['structure', 'units'],
        context
      )
  }
  if (plan.structure.kind !== 'sequence') return
  addDuplicateIssue(
    plan.structure.units.map((unit) => unit.id),
    ['structure', 'units'],
    context
  )
  addSequenceDurationIssues(plan, context)
}

function addSequenceDurationIssues(
  plan: WorkflowPlan,
  context: z.RefinementCtx
): void {
  if (plan.structure.kind !== 'sequence') return
  const durations = plan.structure.units.map((unit) => unit.durationSeconds)
  const hasDuration = durations.some((duration) => duration !== undefined)
  const hasMissingDuration = durations.some(
    (duration) => duration === undefined
  )
  if (plan.targetDurationSeconds === undefined) {
    if (hasDuration && hasMissingDuration) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'A partially timed sequence requires a duration for every unit',
        path: ['structure', 'units']
      })
    }
    if (!hasMissingDuration && sumDurations(durations) > 3_600) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Sequence duration must not exceed 3600 seconds',
        path: ['structure', 'units']
      })
    }
    return
  }
  if (hasMissingDuration) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A timed sequence requires a duration for every unit',
      path: ['structure', 'units']
    })
    return
  }
  const totalDuration = sumDurations(durations)
  if (Math.abs(totalDuration - plan.targetDurationSeconds) < 0.001) return
  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: 'Sequence unit durations must equal the target duration',
    path: ['structure', 'units']
  })
}

function sumDurations(durations: readonly (number | undefined)[]): number {
  return sumBy(durations, (duration) => duration ?? 0)
}

function addPipelineIssues(plan: WorkflowPlan, context: z.RefinementCtx): void {
  const stages = plan.pipeline?.stages
  if (stages === undefined) return
  addDuplicateIssue(
    stages.map((stage) => stage.id),
    ['pipeline', 'stages'],
    context
  )
  stages.forEach((stage, index) => {
    addDuplicateIssue(
      stage.dependsOnStageIds,
      ['pipeline', 'stages', index, 'dependsOnStageIds'],
      context
    )
    addDuplicateIssue(
      stage.inputMediaTypes,
      ['pipeline', 'stages', index, 'inputMediaTypes'],
      context
    )
    addIntentCompatibilityIssues(
      stage.intent,
      stage.inputMediaTypes,
      stage.outputMediaType,
      ['pipeline', 'stages', index, 'inputMediaTypes'],
      ['pipeline', 'stages', index, 'outputMediaType'],
      context
    )
    addStageDependencyIssues(stages, index, plan.inputs, context)
  })
  if (stages.at(-1)?.outputMediaType !== plan.outputMediaType) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'The final pipeline stage must produce the planned output',
      path: ['pipeline', 'stages']
    })
  }
  addOrphanStageIssues(stages, context)
}

function addStageDependencyIssues(
  stages: readonly PipelineStage[],
  stageIndex: number,
  inputs: WorkflowPlan['inputs'],
  context: z.RefinementCtx
): void {
  const stage = stages[stageIndex]
  if (stage === undefined) return
  const priorStages = new Map(
    stages
      .slice(0, stageIndex)
      .map((candidate) => [candidate.id, candidate] as const)
  )
  const dependencyOutputs: WorkflowMediaType[] = []
  for (const dependencyId of stage.dependsOnStageIds) {
    const dependency = priorStages.get(dependencyId)
    if (dependency === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pipeline stages may depend only on earlier stages',
        path: ['pipeline', 'stages', stageIndex, 'dependsOnStageIds']
      })
      continue
    }
    dependencyOutputs.push(dependency.outputMediaType)
    if (!stage.inputMediaTypes.includes(dependency.outputMediaType)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A stage dependency output must be declared as an input',
        path: ['pipeline', 'stages', stageIndex, 'inputMediaTypes']
      })
    }
  }

  const availableInputs = new Set<WorkflowMediaType>([
    ...inputs.map((input) => input.mediaType),
    ...dependencyOutputs
  ])
  for (const mediaType of stage.inputMediaTypes) {
    if (availableInputs.has(mediaType)) continue
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Pipeline stage input ${mediaType} has no source`,
      path: ['pipeline', 'stages', stageIndex, 'inputMediaTypes']
    })
  }
}

function addOrphanStageIssues(
  stages: readonly PipelineStage[],
  context: z.RefinementCtx
): void {
  const finalStage = stages.at(-1)
  if (finalStage === undefined) return
  const stagesById = new Map(stages.map((stage) => [stage.id, stage] as const))
  const contributingStageIds = new Set<string>()
  const pendingIds = [...finalStage.dependsOnStageIds]
  while (pendingIds.length > 0) {
    const stageId = pendingIds.pop()
    if (stageId === undefined || contributingStageIds.has(stageId)) continue
    const stage = stagesById.get(stageId)
    if (stage === undefined) continue
    contributingStageIds.add(stageId)
    pendingIds.push(...stage.dependsOnStageIds)
  }
  stages.slice(0, -1).forEach((stage, index) => {
    if (contributingStageIds.has(stage.id)) return
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Every pipeline stage must contribute to the final output',
      path: ['pipeline', 'stages', index]
    })
  })
}

function addDuplicateIssue(
  values: readonly string[],
  path: Array<string | number>,
  context: z.RefinementCtx
): void {
  if (new Set(values).size === values.length) return
  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: 'Values must be unique',
    path
  })
}

function addIntentCompatibilityIssues(
  intent: WorkflowIntent,
  inputMediaTypes: readonly WorkflowMediaType[],
  outputMediaType: WorkflowMediaType,
  inputPath: Array<string | number>,
  outputPath: Array<string | number>,
  context: z.RefinementCtx
): void {
  const requiredInput = INPUT_MEDIA_BY_INTENT[intent]
  if (requiredInput !== undefined && !inputMediaTypes.includes(requiredInput)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${intent} requires ${requiredInput} input`,
      path: inputPath
    })
  }
  const expectedOutput = OUTPUT_MEDIA_BY_INTENT[intent]
  if (outputMediaType === expectedOutput) return
  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: `${intent} must produce ${expectedOutput}`,
    path: outputPath
  })
}
