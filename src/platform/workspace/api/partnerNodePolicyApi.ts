import { z } from 'zod'

import { api } from '@/scripts/api'

const PARTNER_NODE_POLICY_PATH = '/workspace/partner-node-policy'

const partnerNodePolicyResponseSchema = z.object({
  enforcement_enabled: z.boolean(),
  nodes: z.record(z.string(), z.boolean())
})

export type PartnerNodePolicyResponse = z.infer<
  typeof partnerNodePolicyResponseSchema
>

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

function parsePartnerNodePolicy(data: unknown): PartnerNodePolicy {
  const policy = partnerNodePolicyResponseSchema.parse(data)
  return {
    enforcementEnabled: policy.enforcement_enabled,
    nodes: policy.nodes
  }
}

function throwResponseError(response: Response): never {
  throw new PartnerNodePolicyApiError(response.status, response.statusText)
}

export async function getPartnerNodePolicy(): Promise<PartnerNodePolicy | null> {
  const response = await api.fetchApi(PARTNER_NODE_POLICY_PATH, {
    cache: 'no-store'
  })
  if (response.status === 404) return null
  if (!response.ok) throwResponseError(response)

  return parsePartnerNodePolicy(await response.json())
}

export async function updatePartnerNodePolicy(
  policy: PartnerNodePolicy
): Promise<PartnerNodePolicy> {
  const response = await api.fetchApi(PARTNER_NODE_POLICY_PATH, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enforcement_enabled: policy.enforcementEnabled,
      nodes: policy.nodes
    })
  })
  if (!response.ok) throwResponseError(response)

  return parsePartnerNodePolicy(await response.json())
}
