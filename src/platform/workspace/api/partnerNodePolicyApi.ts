import { z } from 'zod'

import { api } from '@/scripts/api'

const PROVIDERS_PATH = '/providers'
const PROVIDER_POLICY_PATH = '/workspace/provider-policy'

const providerCatalogResponseSchema = z.object({
  providers: z.array(
    z.object({
      provider_id: z.string(),
      display_name: z.string(),
      node_categories: z.array(z.string())
    })
  )
})

const providerPolicyResponseSchema = z.object({
  enforcement_enabled: z.boolean(),
  providers: z.array(
    z.object({
      provider_id: z.string(),
      enabled: z.boolean()
    })
  )
})

export interface PartnerProvider {
  id: string
  displayName: string
  nodeCategories: readonly string[]
}

export interface PartnerProviderPolicyEntry {
  providerId: string
  enabled: boolean
}

export interface PartnerProviderPolicy {
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

function parseProviderPolicy(data: unknown): PartnerProviderPolicy {
  const policy = providerPolicyResponseSchema.parse(data)
  return {
    enforcementEnabled: policy.enforcement_enabled,
    providers: policy.providers.map((provider) => ({
      providerId: provider.provider_id,
      enabled: provider.enabled
    }))
  }
}

function throwResponseError(response: Response): never {
  throw new PartnerNodePolicyApiError(response.status, response.statusText)
}

export async function getPartnerProviders(): Promise<PartnerProvider[]> {
  const response = await api.fetchApi(PROVIDERS_PATH, { cache: 'no-store' })
  if (!response.ok) throwResponseError(response)

  const catalog = providerCatalogResponseSchema.parse(await response.json())
  return catalog.providers.map((provider) => ({
    id: provider.provider_id,
    displayName: provider.display_name,
    nodeCategories: provider.node_categories
  }))
}

export async function getPartnerNodePolicy(): Promise<PartnerProviderPolicy | null> {
  const response = await api.fetchApi(PROVIDER_POLICY_PATH, {
    cache: 'no-store'
  })
  if (response.status === 404) return null
  if (!response.ok) throwResponseError(response)

  return parseProviderPolicy(await response.json())
}

export async function updatePartnerNodePolicy(
  policy: PartnerProviderPolicy
): Promise<PartnerProviderPolicy> {
  const response = await api.fetchApi(PROVIDER_POLICY_PATH, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enforcement_enabled: policy.enforcementEnabled,
      providers: policy.providers.map((provider) => ({
        provider_id: provider.providerId,
        enabled: provider.enabled
      }))
    })
  })
  if (!response.ok) throwResponseError(response)

  return parseProviderPolicy(await response.json())
}
