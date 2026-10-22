import { z } from 'astro/zod'

import { WorkshopWorkflowError } from './workshop-workflow-api'
import {
  WORKFLOW_CONTROL_BYTES,
  workflowInputsSchema,
  workflowIdSchema,
  workflowRequestSchema,
  workflowRunIdSchema
} from './workshop-workflow-response'

const base = z.object({
  version: z.literal(2),
  cancelRequested: z.boolean()
})
const savedWorkflowSchema = z.discriminatedUnion('stage', [
  base
    .extend({
      stage: z.literal('intent'),
      attempt: z
        .object({
          request: workflowRequestSchema
        })
        .strict()
    })
    .strict(),
  base
    .extend({
      stage: z.literal('run'),
      runId: workflowRunIdSchema,
      workflowId: workflowIdSchema,
      definitionVersion: z.string().min(1).max(64),
      appInputs: workflowInputsSchema.optional()
    })
    .strict()
])

export type SavedWorkflow = z.infer<typeof savedWorkflowSchema>

export function savedWorkflowId(record: SavedWorkflow): string {
  return record.stage === 'intent'
    ? record.attempt.request.workflowId
    : record.workflowId
}

export function savedWorkflowRunId(
  record: SavedWorkflow | undefined
): string | undefined {
  return record?.stage === 'run' ? record.runId : undefined
}

export function workflowStorage(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  scope: string,
  workflowId: string
) {
  const key = `comfy-cloud-workflow-run:${JSON.stringify([scope, workflowId])}`
  return {
    clear() {
      try {
        storage.removeItem(key)
      } catch {
        throw new WorkshopWorkflowError('persistence')
      }
    },
    read(): SavedWorkflow | undefined {
      try {
        const raw = storage.getItem(key)
        if (!raw || raw.length > WORKFLOW_CONTROL_BYTES + 8192) return
        const parsed = savedWorkflowSchema.safeParse(JSON.parse(raw))
        if (parsed.success && savedWorkflowId(parsed.data) === workflowId)
          return parsed.data
        return
      } catch {
        return
      }
    },
    write(record: SavedWorkflow) {
      try {
        if (savedWorkflowId(record) !== workflowId)
          throw new Error('Invalid workflow')
        storage.setItem(key, JSON.stringify(savedWorkflowSchema.parse(record)))
      } catch {
        throw new WorkshopWorkflowError('persistence')
      }
    }
  }
}

export type WorkflowStorage = ReturnType<typeof workflowStorage>
