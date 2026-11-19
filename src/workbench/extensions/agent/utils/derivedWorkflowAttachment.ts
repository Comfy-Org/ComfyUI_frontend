import { getWorkflowDataFromFile } from '@/scripts/metadata/parser'
import { parseJsonWithNonFinite } from '@/utils/jsonUtil'

const DERIVED_SUFFIX = '.workflow.json'

/** Marks a staged attachment as one lifted out of another attachment. */
export const DERIVED_WORKFLOW_SOURCE_PREFIX = 'derived-workflow:'

function stripExtension(name: string): string {
  return name.replace(/\.[^./\\]+$/, '') || name
}

/** Names the workflow lifted out of `sourceName` after it. */
export function derivedWorkflowName(sourceName: string): string {
  return `${stripExtension(sourceName)}${DERIVED_SUFFIX}`
}

const WORKFLOW_BEARING_IMAGE = /\.(png|webp|avif)$/i

/** Whether `file` is an image container that can carry a workflow at all. */
export function canCarryEmbeddedWorkflow(file: File): boolean {
  return WORKFLOW_BEARING_IMAGE.test(file.name)
}

function looksLikeEditorWorkflow(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const nodes = (value as { nodes?: unknown }).nodes
  return Array.isArray(nodes) && nodes.length > 0
}

function parseWorkflow(raw: string | object): unknown {
  return typeof raw === 'string' ? parseJsonWithNonFinite(raw) : raw
}

/** Lifts an embedded editor workflow out of `file`, or undefined if there is none. */
export async function deriveWorkflowFile(
  file: File
): Promise<File | undefined> {
  if (!canCarryEmbeddedWorkflow(file)) return undefined

  let metadata
  try {
    metadata = await getWorkflowDataFromFile(file)
  } catch {
    return undefined
  }

  const raw = metadata?.workflow
  if (!raw) return undefined

  let workflow: unknown
  try {
    workflow = parseWorkflow(raw)
  } catch {
    return undefined
  }
  if (!looksLikeEditorWorkflow(workflow)) return undefined

  let serialized: string
  try {
    serialized = JSON.stringify(workflow)
  } catch {
    return undefined
  }

  return new File([serialized], derivedWorkflowName(file.name), {
    type: 'application/json'
  })
}
