import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { toSlug } from '../cli/slug'

export const WORKFLOW_ASSET_EXPLANATION =
  'This workflow is copied into shared test assets so automated runs on other machines can use it. Personal files that are not added this way will not work there.'

export type WorkflowValidationResult =
  | { ok: true }
  | { ok: false; reason: string }

export function validateWorkflowJson(raw: string): WorkflowValidationResult {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'not valid JSON' }
  }

  if (
    typeof value !== 'object' ||
    value === null ||
    !('nodes' in value) ||
    !Array.isArray(value.nodes)
  ) {
    return {
      ok: false,
      reason: 'missing nodes array — is this a ComfyUI workflow export?'
    }
  }

  return { ok: true }
}

export function deriveWorkflowName(
  filePath: string,
  explicit?: string
): string {
  const sourceName = explicit ?? basename(filePath).replace(/\.json$/i, '')
  return toSlug(sourceName)
}

export function addWorkflow(
  sourcePath: string,
  projectRoot: string,
  name?: string
): { destRelPath: string } {
  const workflowName = deriveWorkflowName(sourcePath, name)
  if (!workflowName) {
    throw new Error('Workflow name must contain letters or numbers.')
  }

  const raw = readFileSync(sourcePath, 'utf-8')
  const validation = validateWorkflowJson(raw)
  if (!validation.ok) {
    throw new Error(`Cannot add workflow: ${validation.reason}`)
  }

  const assetsDir = join(projectRoot, 'browser_tests', 'assets')
  const destination = join(assetsDir, `${workflowName}.json`)
  if (existsSync(destination)) {
    throw new Error(
      `Workflow already exists at ${destination}. Choose another name.`
    )
  }

  mkdirSync(assetsDir, { recursive: true })
  writeFileSync(destination, raw)
  return { destRelPath: workflowName }
}
