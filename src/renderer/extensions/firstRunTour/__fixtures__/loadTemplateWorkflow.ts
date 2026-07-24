import fs from 'node:fs'
import path from 'node:path'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  zComfyWorkflow,
  zComfyWorkflow1
} from '@/platform/workflow/validation/schemas/workflowSchema'

import type { CuratedTemplateId } from '../roleResolver'

const TEMPLATES_DIR = path.join(import.meta.dirname, 'templates')

/** Loads a curated template's real workflow, validated so a bad fixture fails loudly. */
export function loadTemplateWorkflow(id: CuratedTemplateId): ComfyWorkflowJSON {
  const file = path.join(TEMPLATES_DIR, `${id}.json`)
  const data: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'))
  const schema =
    (data as { version?: number }).version === 1
      ? zComfyWorkflow1
      : zComfyWorkflow
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new Error(`Invalid template fixture "${id}": ${result.error.message}`)
  }
  return result.data
}
