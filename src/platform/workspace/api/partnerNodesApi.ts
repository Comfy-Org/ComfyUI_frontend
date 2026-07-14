import axios from 'axios'

import { attachUnifiedRemintInterceptor } from '@/platform/auth/unified/remintRetry'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'

/** A partner (paid-API) node the workspace can allow or block. */
export interface PartnerNode {
  /** Canonical Comfy node type ID; matches the /object_info object key. */
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
  /** Readable by every active workspace member. */
  async list(): Promise<PartnerNodesResponse> {
    const headers = await authHeader()
    const response = await partnerNodesApiClient.get<PartnerNodesResponse>(
      api.apiURL('/workspace/partner-nodes'),
      { headers }
    )
    return response.data
  },

  async setEnabled(nodeId: string, enabled: boolean): Promise<void> {
    await partnerNodesApi.setEnabledBulk([nodeId], enabled)
  },

  async setEnabledBulk(nodeIds: string[], enabled: boolean): Promise<void> {
    const headers = await authHeader()
    const payload: BulkSetEnabledPayload = { node_ids: nodeIds, enabled }
    await partnerNodesApiClient.patch(
      api.apiURL('/workspace/partner-nodes'),
      payload,
      { headers }
    )
  },

  async setAutoEnableNew(autoEnableNew: boolean): Promise<void> {
    const headers = await authHeader()
    const payload: SetAutoEnablePayload = { auto_enable_new: autoEnableNew }
    await partnerNodesApiClient.patch(
      api.apiURL('/workspace/partner-nodes'),
      payload,
      { headers }
    )
  }
}
