import type { LGraphNode } from '@comfyorg/graph-model/entityRegistry'

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
  const auxId =
    typeof properties?.aux_id === 'string' ? properties.aux_id : undefined
  return getRegistryCnrId(properties) ?? auxId
}

/** The registry pack a node was saved from, ignoring the GitHub `aux_id`. */
export function getRegistryCnrId(
  properties: Record<string, unknown> | undefined | null
): string | undefined {
  return typeof properties?.cnr_id === 'string' && properties.cnr_id.length > 0
    ? properties.cnr_id
    : undefined
}

/**
 * Extracts the custom node registry ID (cnr_id or aux_id) from a node's properties.
 * Returns undefined if neither property is present.
 *
 * @param node - The graph node to inspect
 * @returns The cnrId string, or undefined if not found
 */
export function getCnrIdFromNode(node: LGraphNode): string | undefined {
  return getCnrIdFromProperties(node.properties)
}
