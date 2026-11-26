import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyMetadata } from '@/types/metadataTypes'
import { parseJsonWithNonFinite } from '@/utils/jsonUtil'

type LegacyCommentBlob = {
  workflow?: ComfyWorkflowJSON | string
  prompt?: ComfyApiWorkflow | string
}

type JsonValue =
  | LegacyCommentBlob
  | unknown[]
  | string
  | number
  | boolean
  | null

const parseBlob = (comment: string): LegacyCommentBlob | null => {
  try {
    const parsed = parseJsonWithNonFinite<JsonValue>(comment)
    if (typeof parsed !== 'object' || parsed === null) return null
    return Array.isArray(parsed) ? null : parsed
  } catch {
    return null
  }
}

/** Old VHS stored `prompt` as a JSON string inside the JSON comment. */
const readField = <T extends object>(
  value: T | string | undefined
): T | undefined => {
  if (typeof value !== 'string') return value
  try {
    const parsed = parseJsonWithNonFinite<T | string | number | boolean | null>(
      value
    )
    return typeof parsed === 'object' && parsed !== null ? parsed : undefined
  } catch {
    return undefined
  }
}

/**
 * Reads the workflow and prompt out of a `comment` tag that holds the whole
 * metadata dict as one JSON object, as VideoHelperSuite's Video Combine wrote
 * MP4/WebM/MKV outputs before January 2026.
 */
export function getFromLegacyComment(comment: string): ComfyMetadata {
  const blob = parseBlob(comment)
  if (!blob) return {}

  const metadata: ComfyMetadata = {}
  const workflow = readField(blob.workflow)
  if (workflow) metadata.workflow = workflow
  const prompt = readField(blob.prompt)
  if (prompt) metadata.prompt = prompt
  return metadata
}

/**
 * Fills `workflow`/`prompt` from a legacy JSON `comment` when the file has
 * neither under its own key. Files that do carry the keys are left alone.
 */
export function withLegacyCommentFallback(
  metadata: ComfyMetadata,
  comment: unknown
): ComfyMetadata {
  if (metadata.workflow || metadata.prompt) return metadata
  if (typeof comment !== 'string') return metadata
  return { ...metadata, ...getFromLegacyComment(comment) }
}
