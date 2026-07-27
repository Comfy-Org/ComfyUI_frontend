import { z } from 'zod'

import { api } from '@/scripts/api'

const partnerNodePolicyResponseSchema = z.object({
  enforcement_enabled: z.boolean(),
  nodes: z.record(z.string(), z.boolean())
})

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
