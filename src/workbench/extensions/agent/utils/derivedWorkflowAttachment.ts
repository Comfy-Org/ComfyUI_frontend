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

export function canCarryEmbeddedWorkflow(file: File): boolean {
  return (
    WORKFLOW_BEARING_IMAGE.test(file.name) &&
    (file.type === '' ||
      file.type === 'application/octet-stream' ||
      /^image\/(png|webp|avif)$/.test(file.type))
  )
}

function looksLikeEditorWorkflow(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const nodes = (value as { nodes?: unknown }).nodes
  return Array.isArray(nodes) && nodes.length > 0
}

function parseWorkflow(raw: string | object): unknown {
  return typeof raw === 'string' ? parseJsonWithNonFinite(raw) : raw
}

export async function deriveWorkflowFile(
  file: File
): Promise<File | undefined> {
  if (!canCarryEmbeddedWorkflow(file)) return undefined

  const parserFile =
    file.type === '' || file.type === 'application/octet-stream'
      ? new File([file], file.name, {
          type: `image/${file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase()}`,
          lastModified: file.lastModified
        })
      : file

  let metadata
  try {
    metadata = await getWorkflowDataFromFile(parserFile)
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
