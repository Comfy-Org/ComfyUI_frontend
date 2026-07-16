import fs from 'node:fs'
import path from 'node:path'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import type { CuratedTemplateId } from '../roleResolver'

const TEMPLATES_DIR = path.join(import.meta.dirname, 'templates')

/**
 * Loads a curated template's real serialized workflow from the committed
 * fixtures. Used to prove the resolver's heuristics against ground truth.
 */
export function loadTemplateWorkflow(id: CuratedTemplateId): ComfyWorkflowJSON {
  const file = path.join(TEMPLATES_DIR, `${id}.json`)
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as ComfyWorkflowJSON
}
