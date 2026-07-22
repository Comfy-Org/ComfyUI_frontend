import { z } from 'zod'

import { api } from '@/scripts/api'

const partnerProviderSchema = z.object({
  provider_id: z.string(),
  display_name: z.string(),
  node_categories: z.array(z.string())
})

const partnerProviderCatalogResponseSchema = z.object({
  providers: z.array(partnerProviderSchema)
})

const partnerNodePolicyResponseSchema = z.object({
  enforcement_enabled: z.boolean(),
  nodes: z.record(z.string(), z.boolean())
})

export interface PartnerProvider {
  id: string
  displayName: string
  nodeCategories: readonly string[]
}

export interface PartnerNodePolicy {
  enforcementEnabled: boolean
  nodes: Readonly<Record<string, boolean>>
}

export class PartnerNodePolicyApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'PartnerNodePolicyApiError'
  }
}

export async function getPartnerProviders(): Promise<PartnerProvider[]> {
  const response = await api.fetchApi('/providers', { cache: 'no-store' })
  if (!response.ok) {
    throw new PartnerNodePolicyApiError(response.status, response.statusText)
  }

  const data = partnerProviderCatalogResponseSchema.parse(await response.json())
  return data.providers.map(
    ({ provider_id, display_name, node_categories }) => ({
      id: provider_id,
      displayName: display_name,
      nodeCategories: node_categories
    })
  )
}

export async function getPartnerNodePolicy(): Promise<PartnerNodePolicy | null> {
  const response = await api.fetchApi('/workspace/partner-node-policy', {
    cache: 'no-store'
  })
  if (response.status === 404) return null
  if (!response.ok) {
    throw new PartnerNodePolicyApiError(response.status, response.statusText)
  }

  const data = partnerNodePolicyResponseSchema.parse(await response.json())
  return {
    enforcementEnabled: data.enforcement_enabled,
    nodes: data.nodes
  }
}
