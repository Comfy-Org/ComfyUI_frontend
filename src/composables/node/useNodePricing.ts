import type { LGraphNode } from '@comfyorg/litegraph'

import { getNodeDisplayPrice } from '@/composables/node/apiNodeCosts'

/**
 * Simple utility function to get the price for a node
 * Returns a formatted price string or empty string if no pricing info available
 */
export function getNodePrice(node: LGraphNode): string {
  if (!node.constructor.nodeData?.api_node) {
    return ''
  }
  return getNodeDisplayPrice(node.constructor.name)
}

/**
 * Composable to get node pricing information for API nodes
 */
export const useNodePricing = () => {
  /**
   * Get the price display for a node
   */
  const getNodePriceDisplay = (node: LGraphNode): string => {
    if (!node.constructor.nodeData?.api_node) {
      return ''
    }
    return getNodeDisplayPrice(node.constructor.name)
  }

  return {
    getNodePriceDisplay
  }
}
