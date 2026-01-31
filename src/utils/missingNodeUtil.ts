import type { MissingNodeType } from '@/types/comfy'

/**
 * Extra info returned by the backend for missing_node_type errors
 */
export interface MissingNodeTypeExtraInfo {
  class_type?: string | null
  node_title?: string | null
  node_id?: string
}

/**
 * Builds a hint string from missing node metadata.
 * Provides context about which node is missing (title, ID) when available.
 */
export function buildMissingNodeHint(
  nodeTitle: string | null | undefined,
  classType: string,
  nodeId: string | undefined
): string | undefined {
  const hasTitle = nodeTitle && nodeTitle !== classType
  if (hasTitle && nodeId) {
    return `"${nodeTitle}" (Node ID #${nodeId})`
  } else if (hasTitle) {
    return `"${nodeTitle}"`
  } else if (nodeId) {
    return `Node ID #${nodeId}`
  }
  return undefined
}

/**
 * Creates a MissingNodeType from backend error extra_info.
 * Used when the /prompt endpoint returns a missing_node_type error.
 */
export function createMissingNodeTypeFromError(
  extraInfo: MissingNodeTypeExtraInfo
): MissingNodeType {
  const classType = extraInfo.class_type ?? 'Unknown'
  const nodeTitle = extraInfo.node_title ?? classType
  const hint = buildMissingNodeHint(nodeTitle, classType, extraInfo.node_id)

  return hint ? { type: classType, hint } : classType
}
