import axios from 'axios'

import { attachUnifiedRemintInterceptor } from '@/platform/auth/unified/remintRetry'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'

/** A partner (paid-API) node the workspace can allow or block. */
export interface PartnerNode {
  id: string
  name: string
  partner: string
  /** ISO date of the last governance change, or null if never modified. */
  last_modified: string | null
  enabled: boolean
}

export interface PartnerNodesResponse {
  partner_nodes: PartnerNode[]
  /** Workspace default applied to newly added partner nodes. */
  auto_enable_new: boolean
}

interface SetEnabledPayload {
  enabled: boolean
}

interface BulkSetEnabledPayload {
  node_ids: string[]
  enabled: boolean
}

interface SetAutoEnablePayload {
  auto_enable_new: boolean
}

const partnerNodesApiClient = axios.create({
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
})
attachUnifiedRemintInterceptor(partnerNodesApiClient)

async function authHeader() {
  return useAuthStore().getAuthHeaderOrThrow()
}

export const partnerNodesApi = {
  /** GET /api/workspace/partner-nodes */
  async list(): Promise<PartnerNodesResponse> {
    const headers = await authHeader()
    const response = await partnerNodesApiClient.get<PartnerNodesResponse>(
      api.apiURL('/workspace/partner-nodes'),
      { headers }
    )
    return response.data
  },

  /** PATCH /api/workspace/partner-nodes/:id */
  async setEnabled(nodeId: string, enabled: boolean): Promise<void> {
    const headers = await authHeader()
    const payload: SetEnabledPayload = { enabled }
    await partnerNodesApiClient.patch(
      api.apiURL(`/workspace/partner-nodes/${nodeId}`),
      payload,
      { headers }
    )
  },

  /** PATCH /api/workspace/partner-nodes (bulk) */
  async setEnabledBulk(nodeIds: string[], enabled: boolean): Promise<void> {
    const headers = await authHeader()
    const payload: BulkSetEnabledPayload = { node_ids: nodeIds, enabled }
    await partnerNodesApiClient.patch(
      api.apiURL('/workspace/partner-nodes'),
      payload,
      { headers }
    )
  },

  /** PUT /api/workspace/partner-nodes/settings */
  async setAutoEnableNew(autoEnableNew: boolean): Promise<void> {
    const headers = await authHeader()
    const payload: SetAutoEnablePayload = { auto_enable_new: autoEnableNew }
    await partnerNodesApiClient.put(
      api.apiURL('/workspace/partner-nodes/settings'),
      payload,
      { headers }
    )
  }
}
