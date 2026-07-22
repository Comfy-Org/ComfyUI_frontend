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
export type PartnerProviderCatalogResponse = z.infer<
  typeof partnerProviderCatalogResponseSchema
>

const partnerProviderPolicyEntrySchema = z.object({
  provider_id: z.string(),
  enabled: z.boolean()
})

const partnerNodePolicyResponseSchema = z.object({
  enforcement_enabled: z.boolean(),
  providers: z.array(partnerProviderPolicyEntrySchema)
})
export type PartnerNodePolicyResponse = z.infer<
  typeof partnerNodePolicyResponseSchema
>

export interface PartnerProvider {
  id: string
  displayName: string
  nodeCategories: readonly string[]
}

export interface PartnerProviderPolicyEntry {
  providerId: string
  enabled: boolean
}

export interface PartnerNodePolicy {
  enforcementEnabled: boolean
  providers: readonly PartnerProviderPolicyEntry[]
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

function normalizePolicy(
  data: z.infer<typeof partnerNodePolicyResponseSchema>
): PartnerNodePolicy {
  return {
    enforcementEnabled: data.enforcement_enabled,
    providers: data.providers.map(({ provider_id, enabled }) => ({
      providerId: provider_id,
      enabled
    }))
  }
}

function throwResponseError(response: Response): never {
  throw new PartnerNodePolicyApiError(response.status, response.statusText)
}

export async function getPartnerProviders(): Promise<PartnerProvider[]> {
  const response = await api.fetchApi('/providers', { cache: 'no-store' })
  if (!response.ok) throwResponseError(response)

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
  const response = await api.fetchApi('/workspace/provider-policy', {
    cache: 'no-store'
  })
  if (response.status === 404) return null
  if (!response.ok) throwResponseError(response)

  return normalizePolicy(
    partnerNodePolicyResponseSchema.parse(await response.json())
  )
}

export async function updatePartnerNodePolicy(
  policy: PartnerNodePolicy
): Promise<PartnerNodePolicy> {
  const response = await api.fetchApi('/workspace/provider-policy', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enforcement_enabled: policy.enforcementEnabled,
      providers: policy.providers.map(({ providerId, enabled }) => ({
        provider_id: providerId,
        enabled
      }))
    })
  })
  if (!response.ok) throwResponseError(response)

  return normalizePolicy(
    partnerNodePolicyResponseSchema.parse(await response.json())
  )
}
