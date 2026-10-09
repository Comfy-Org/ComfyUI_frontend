import { describe, expect, it, vi } from 'vitest'

import type { WorkspaceDeploymentList } from '@/platform/workspace/api/workspaceApi'

import { useToast } from '@/components/ui/toast/toastStore'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { useDeploymentPickAtBoot } from './useDeploymentPickAtBoot'

vi.mock(import('@/platform/workspace/api/workspaceApi'))

const listing: WorkspaceDeploymentList = {
  builds_visible: true,
  items: [
    {
      deployment_id: 'dep-1',
      release_id: 'r-1',
      build_name: 'Studio Build',
      release_version: 1,
      status: 'ready',
      created_at: '2026-10-01T00:00:00Z'
    }
  ]
}

describe('useDeploymentPickAtBoot', () => {
  it('tells the person once that the deployment they picked is gone and the browser runs on Comfy Cloud', async () => {
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    vi.mocked(workspaceApi.listDeployments).mockResolvedValue({
      ...listing,
      gone_picked_deployment_id: 'dep-gone'
    })

    await useDeploymentPickAtBoot()

    expect(useDeploymentPickStore().bootDeployment).toBeNull()
    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'warning',
        title: 'The deployment you picked no longer exists.',
        description:
          'This browser now runs on Comfy Cloud. Pick a deployment again from the account menu to use one.',
        duration: 10000
      })
    ])
  })

  it.for([
    {
      when: 'its pick is listed',
      reply: { picked_deployment_id: 'dep-1', pick_source: 'browser' }
    },
    { when: 'it has no pick', reply: {} },
    {
      when: 'only the workspace default it follows is gone',
      reply: { gone_default_deployment_id: 'dep-gone' }
    }
  ] satisfies { when: string; reply: Partial<WorkspaceDeploymentList> }[])(
    'says nothing when $when',
    async ({ reply }) => {
      Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
      vi.mocked(workspaceApi.listDeployments).mockResolvedValue({
        ...listing,
        ...reply
      })

      await useDeploymentPickAtBoot()

      expect(useDeploymentPickStore().isVisible).toBe(true)
      expect(useToast().toasts).toEqual([])
    }
  )
})
