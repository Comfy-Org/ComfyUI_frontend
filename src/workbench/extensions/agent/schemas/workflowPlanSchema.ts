import { z } from 'zod'

import { addWorkflowPlanIssues } from './workflowPlanValidation'

const zWorkflowMediaType = z.enum(['image', 'video', 'audio', '3d'])
export type WorkflowMediaType = z.infer<typeof zWorkflowMediaType>

const zWorkflowIntent = z.enum([
  'text-to-image',
  'image-edit',
  'image-upscale',
  'text-to-video',
  'image-to-video',
  'video-edit',
  'text-to-audio',
  'audio-edit',
  'text-to-3d',
  'image-to-3d'
])
export type WorkflowIntent = z.infer<typeof zWorkflowIntent>

const zRequiredText = z.string().trim().min(1)
const zIdentifier = zRequiredText.max(80)

const zWorkUnit = z
  .object({
    id: zIdentifier,
    label: zRequiredText.max(120),
    instruction: zRequiredText.max(4_000),
    durationSeconds: z.number().positive().max(600).optional()
  })
  .strict()

const zInputRequirement = z
  .object({
    id: zIdentifier,
    mediaType: zWorkflowMediaType,
    quantity: z.number().int().min(1).max(64),
    purpose: zRequiredText.max(500)
  })
  .strict()

const zPipelineStage = z
  .object({
    id: zIdentifier,
    intent: zWorkflowIntent,
    dependsOnStageIds: z.array(zIdentifier).max(16),
    inputMediaTypes: z.array(zWorkflowMediaType).max(4),
    outputMediaType: zWorkflowMediaType,
    instruction: zRequiredText.max(4_000)
  })
  .strict()

const zExecutionStructure = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('single') }).strict(),
  z
    .object({
      kind: z.literal('batch'),
      unitCount: z.number().int().min(2).max(64),
      units: z.array(zWorkUnit).min(2).max(64).optional()
    })
    .strict(),
  z
    .object({
      kind: z.literal('sequence'),
      units: z.array(zWorkUnit).min(2).max(64),
      continuityConstraints: z.array(zRequiredText.max(500)).min(1).max(16)
    })
    .strict()
])

const zPipeline = z
  .object({
    stages: z.array(zPipelineStage).min(2).max(16)
  })
  .strict()

const zClarification = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ready') }).strict(),
  z
    .object({
      status: z.literal('needs-input'),
      question: zRequiredText.max(500)
    })
    .strict()
])

const zWorkflowPlanShape = z
  .object({
    version: z.literal(1),
    brief: zRequiredText.max(8_000),
    summary: zRequiredText.max(500),
    intent: zWorkflowIntent,
    inputs: z.array(zInputRequirement).max(16),
    outputMediaType: zWorkflowMediaType,
    qualityGoal: z.enum(['draft', 'balanced', 'best']),
    executionPreference: z.enum(['auto', 'local-only', 'cloud-allowed']),
    constraints: z.array(zRequiredText.max(500)).max(32),
    targetDurationSeconds: z.number().positive().max(3_600).optional(),
    structure: zExecutionStructure,
    pipeline: zPipeline.optional(),
    clarification: zClarification
  })
  .strict()

export type WorkflowPlan = z.infer<typeof zWorkflowPlanShape>

export const zWorkflowPlan = zWorkflowPlanShape.superRefine(
  addWorkflowPlanIssues
)
