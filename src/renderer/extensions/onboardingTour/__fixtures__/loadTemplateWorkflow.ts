import fs from 'node:fs'
import path from 'node:path'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

/** Ids of the curated templates whose real JSON is committed alongside this file. */
export type CuratedTemplateId =
  | 'image_krea2_turbo_t2i'
  | 'image_z_image_turbo'
  | 'video_ltx2_3_i2v'
  | 'video_wan2_2_14B_i2v'
  | 'flux_kontext_dev_basic'

const TEMPLATES_DIR = path.join(import.meta.dirname, 'templates')

/**
 * Loads a curated template's real serialized workflow from the committed
 * fixtures. Used to prove the resolver's heuristics against ground truth.
 */
export function loadTemplateWorkflow(id: CuratedTemplateId): ComfyWorkflowJSON {
  const file = path.join(TEMPLATES_DIR, `${id}.json`)
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as ComfyWorkflowJSON
}
