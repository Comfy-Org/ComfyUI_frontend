export interface ApiNodeCost {
  name: string
  cost: number
}

/**
 * Information about an API node's cost and pricing details
 */
export interface ApiNodeCostData {
  /** The vendor/company providing the API service (e.g., 'OpenAI', 'Stability') */
  vendor: string
  /** The human-readable name of the node as displayed in the UI */
  nodeName: string
  /** Parameters that affect pricing (e.g., 'size | quality', 'duration', '-' if none) */
  pricingParams: string
  /** The price range per run (e.g., '$0.05', '$0.04 x n', 'dynamic') */
  pricePerRunRange: string
  /** Formatted price string for display in the UI */
  displayPrice: string
  /** URL to the vendor's pricing documentation page */
  rateDocumentationUrl?: string
}

export type ApiNodeCostRecord = Record<string, ApiNodeCostData>
