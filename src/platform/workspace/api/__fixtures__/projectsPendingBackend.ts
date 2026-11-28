import type {
  ListAccessEventsResponse,
  UsageTimeSeries,
  WorkspaceDeployment
} from '@comfyorg/ingest-types'

import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'

const NOW = '2026-01-01T00:00:00Z'

type PendingBackendDeployment = WorkspaceDeployment & {
  project_id: string
}

type PendingBackendUsage = UsageTimeSeries & {
  project_id: string
}

export const pendingBackendMocks = {
  listWorkspaceAccessEvents: async (): Promise<ListAccessEventsResponse> => {
    throw new WorkspaceApiError(
      'Not Found',
      404,
      'not_found',
      undefined,
      'listWorkspaceAccessEvents'
    )
  },
  checkM2mAuthz: async (_input: {
    action: string
    resource: string
  }): Promise<{ allowed: boolean }> => {
    return { allowed: false }
  },
  listDeploymentsByProjectId: async (
    projectId: string
  ): Promise<PendingBackendDeployment[]> => {
    return [
      {
        can_start: false,
        created_at: NOW,
        deployment_id: 'dep-1',
        release_id: 'rel-1',
        status: 'ready',
        project_id: projectId
      }
    ]
  },
  listUsageByProject: async (
    projectId: string
  ): Promise<PendingBackendUsage> => {
    return {
      project_id: projectId,
      breakdown: [],
      buckets: [],
      ending_before: NOW,
      granularity: 'day',
      group_by: 'product_line',
      groups: [],
      starting_on: NOW,
      summary: { spend_micros: 0 },
      not_available: { reason: 'no_attribution_source' }
    }
  }
}
