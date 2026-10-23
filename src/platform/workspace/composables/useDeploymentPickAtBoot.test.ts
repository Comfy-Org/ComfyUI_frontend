import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkspaceDeploymentList } from '@/platform/workspace/api/workspaceApi'

import { useToast } from '@/components/ui/toast/toastStore'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { reloadForDeploymentSwitch } from '@/platform/workspace/deploymentSwitchReload'
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
  beforeEach(() => {
    sessionStorage.clear()
    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn(), origin: 'http://localhost' },
      writable: true,
      configurable: true
    })
  })

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
          'This browser now runs on Comfy Cloud. Pick a deployment again to use one.',
        duration: 10000
      })
    ])
  })

  it('tells the person their pick is gone when a newer listing answers before the boot listing that said so', async () => {
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    let answerBoot: (reply: WorkspaceDeploymentList) => void = () => {}
    vi.mocked(workspaceApi.listDeployments)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          answerBoot = resolve
        })
      )
      .mockResolvedValue(listing)

    const booting = useDeploymentPickAtBoot()
    await useDeploymentPickStore().load()
    answerBoot({ ...listing, gone_picked_deployment_id: 'dep-gone' })
    await booting

    expect(useDeploymentPickStore().goneDeployment).toBe('pick')
    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'warning',
        title: 'The deployment you picked no longer exists.'
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

  it.for([
    {
      lands: 'the picked deployment',
      reply: { picked_deployment_id: 'dep-1', pick_source: 'browser' },
      title: 'Running on Studio Build · dep-1'
    },
    { lands: 'Comfy Cloud', reply: {}, title: 'Running on Comfy Cloud' }
  ] satisfies {
    lands: string
    reply: Partial<WorkspaceDeploymentList>
    title: string
  }[])('says once that a switch landed on $lands', async ({ reply, title }) => {
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    vi.mocked(workspaceApi.listDeployments).mockResolvedValue({
      ...listing,
      ...reply
    })
    reloadForDeploymentSwitch(() => {})

    await useDeploymentPickAtBoot()
    await useDeploymentPickAtBoot()

    await vi.waitFor(() =>
      expect(useToast().toasts).toEqual([
        expect.objectContaining({ kind: 'success', title })
      ])
    )
  })

  it('says where a switch landed once a later listing answers, when the boot listing failed', async () => {
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    vi.mocked(workspaceApi.listDeployments)
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValue(listing)
    reloadForDeploymentSwitch(() => {})

    await useDeploymentPickAtBoot()
    expect(useToast().toasts).toEqual([])
    await useDeploymentPickStore().load()

    await vi.waitFor(() =>
      expect(useToast().toasts).toEqual([
        expect.objectContaining({
          kind: 'success',
          title: 'Running on Comfy Cloud'
        })
      ])
    )
  })
})
