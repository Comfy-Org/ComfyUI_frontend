export interface ApiNodeCost {
  name: string
  cost: number
}

export interface ApiNodeCostData {
  vendor: string
  nodeName: string
  pricingParams: string
  pricePerRunRange: string
  displayPrice: string
  rateDocumentation?: string
}

export type ApiNodeCostRecord = Record<string, ApiNodeCostData>
