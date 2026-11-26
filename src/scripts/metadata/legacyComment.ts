import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@comfyorg/graph-model/workflowSchema'
import type { ComfyMetadata } from '@/types/metadataTypes'
import { parseJsonWithNonFinite } from '@/utils/jsonUtil'

type LegacyCommentBlob = {
  workflow?: ComfyWorkflowJSON | string
  prompt?: ComfyApiWorkflow | string
}

const tryParseObject = <T extends object>(text: string): T | null => {
  try {
    const parsed = parseJsonWithNonFinite<T>(text)
    return typeof parsed === 'object' && parsed !== null ? parsed : null
  } catch {
    return null
  }
}

const readField = <T extends object>(
  value: T | string | undefined
): T | null => {
  if (typeof value === 'string') return tryParseObject<T>(value)
  return typeof value === 'object' && value !== null ? value : null
}

/**
 * Reads the workflow and prompt out of a `comment` tag that holds the whole
 * metadata dict as one JSON object, as VideoHelperSuite's Video Combine wrote
 * MP4/WebM/MKV outputs before January 2026. In those files `prompt` is
 * itself a JSON string, so string values are parsed a second time.
 */
export function getFromLegacyComment(comment: string): ComfyMetadata {
  const blob = tryParseObject<LegacyCommentBlob>(comment)
  if (!blob || Array.isArray(blob)) return {}

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
