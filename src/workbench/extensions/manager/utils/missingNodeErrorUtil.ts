import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { MissingNodeType } from '@/types/comfy'

import type { MissingNodeTypeExtraInfo } from '../types/missingNodeErrorTypes'

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

  if (hint) {
    return {
      type: classType,
      ...(extraInfo.node_id ? { nodeId: extraInfo.node_id } : {}),
      ...(hint ? { hint } : {})
    }
  }
  return classType
}

/**
 * Extracts the custom node registry ID (cnr_id or aux_id) from a raw
 * properties bag.
 *
 * @param properties - The properties object to inspect
 * @returns The cnrId string, or undefined if not found
 */
export function getCnrIdFromProperties(
  properties: Record<string, unknown> | undefined | null
): string | undefined {
  if (typeof properties?.cnr_id === 'string') return properties.cnr_id
  if (typeof properties?.aux_id === 'string') return properties.aux_id
  return undefined
}

/**
 * Extracts the custom node registry ID (cnr_id or aux_id) from a node's properties.
 * Returns undefined if neither property is present.
 *
 * @param node - The graph node to inspect
 * @returns The cnrId string, or undefined if not found
 */
export function getCnrIdFromNode(node: LGraphNode): string | undefined {
  return getCnrIdFromProperties(node.properties as Record<string, unknown>)
}
