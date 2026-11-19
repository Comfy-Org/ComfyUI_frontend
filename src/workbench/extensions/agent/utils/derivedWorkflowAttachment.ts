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

function isWorkflowFile(file: File): boolean {
  return /\.json$/i.test(file.name)
}

function looksLikeEditorWorkflow(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const nodes = (value as { nodes?: unknown }).nodes
  return Array.isArray(nodes) && nodes.length > 0
}

function parseWorkflow(raw: string | object): unknown {
  return typeof raw === 'string' ? parseJsonWithNonFinite(raw) : raw
}

/**
 * Lifts an embedded editor workflow out of `file` as a `.json` File ready to
 * stage as its own attachment.
 *
 * Resolves undefined when there is nothing to lift, including an API-format
 * `prompt` with no editor graph, and on any read or parse failure.
 */
export async function deriveWorkflowFile(
  file: File
): Promise<File | undefined> {
  if (isWorkflowFile(file)) return undefined

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
