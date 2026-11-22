import { vi } from 'vitest'

import type { WorkspaceDeploymentList } from '@/platform/workspace/api/workspaceApi'

import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

vi.mock(import('@/platform/workspace/api/workspaceApi'))

export function mockDeploymentListing(
  listing: WorkspaceDeploymentList,
  workspaceId = 'ws-1'
) {
  Object.assign(useTeamWorkspaceStore(), { workspaceId })
  vi.mocked(workspaceApi.listDeployments).mockResolvedValue(listing)
}
