import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type {
  WorkspaceDeployment,
  WorkspaceDeploymentList
} from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { useUnreadyDeploymentRun } from './useUnreadyDeploymentRun'

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@comfyorg/telemetry/reportError'), { spy: true })

const distribution = vi.hoisted(() => ({ isCloud: true }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  },
  isDesktop: false,
  isNightly: false
}))

const PICKED = 'dep-a1a1a1a1-0000-4000-8000-000000000001'

function listingWith(
  status: WorkspaceDeployment['status'],
  pickedDeploymentId: string | null = PICKED
): WorkspaceDeploymentList {
  return {
    builds_visible: true,
    ...(pickedDeploymentId === null
      ? {}
      : { picked_deployment_id: pickedDeploymentId }),
    items: [
      {
        deployment_id: PICKED,
        release_id: 'r-1',
        status,
        can_start: status !== 'ready',
        created_at: '2026-10-01T00:00:00Z'
      }
    ]
  }
}

function answerListingWith(listing: WorkspaceDeploymentList) {
  return vi.spyOn(workspaceApi, 'listDeployments').mockResolvedValue(listing)
}

async function loadListing(listing: WorkspaceDeploymentList) {
  answerListingWith(listing)
  await useDeploymentPickStore().load()
}

describe('useUnreadyDeploymentRun', () => {
  beforeEach(() => {
    distribution.isCloud = true
    Object.assign(useCurrentUser(), { isApiKeyLogin: computed(() => false) })
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    useDeploymentPickStore().switcherMounts = 1
    vi.spyOn(workspaceApi, 'getReleaseUnsupportedPacks').mockResolvedValue({
      release_id: 'r-1',
      packs: []
    })
  })

  it.for<{ status: WorkspaceDeployment['status']; reason: string }>([
    { status: 'stopped', reason: 'stopped' },
    { status: 'stopping', reason: 'notReady' },
    { status: 'failed', reason: 'failed' },
    { status: 'queued', reason: 'starting' },
    { status: 'starting', reason: 'starting' },
    { status: 'provisioning', reason: 'starting' }
  ])(
    'opens the Run on menu in place of a Run when the picked deployment is $status',
    async ({ status, reason }) => {
      await loadListing(listingWith(status))
      const { unreadyReason, openSwitcherInsteadOfRun } =
        useUnreadyDeploymentRun()
      const asksBefore = useDeploymentPickStore().switcherOpenAsks

      expect(unreadyReason.value).toBe(reason)
      expect(await openSwitcherInsteadOfRun()).toBe(true)
      expect(useDeploymentPickStore().switcherOpenAsks).toBe(asksBefore + 1)
    }
  )

  it.for<{ when: string; arrange: () => Promise<void> }>([
    {
      when: 'the picked deployment is ready',
      arrange: () => loadListing(listingWith('ready'))
    },
    {
      when: 'the editor runs on Comfy Cloud',
      arrange: () => loadListing(listingWith('stopped', null))
    },
    {
      when: 'the listing has not answered',
      arrange: async () => {}
    },
    {
      when: 'App mode hides the Run on menu',
      arrange: async () => {
        await loadListing(listingWith('stopped'))
        useWorkflowStore().activeWorkflow = fromPartial<
          NonNullable<ReturnType<typeof useWorkflowStore>['activeWorkflow']>
        >({ activeMode: 'app' })
      }
    },
    {
      when: 'no Run on menu is mounted to open',
      arrange: async () => {
        await loadListing(listingWith('stopped'))
        useDeploymentPickStore().switcherMounts = 0
      }
    },
    {
      when: 'the editor is not Comfy Cloud',
      arrange: async () => {
        await loadListing(listingWith('stopped'))
        distribution.isCloud = false
      }
    },
    {
      when: 'the person signed in with an API key',
      arrange: async () => {
        await loadListing(listingWith('stopped'))
        Object.assign(useCurrentUser(), {
          isApiKeyLogin: computed(() => true)
        })
      }
    }
  ])('lets Run go ahead when $when', async ({ arrange }) => {
    await arrange()
    const { unreadyReason, openSwitcherInsteadOfRun } =
      useUnreadyDeploymentRun()
    const asksBefore = useDeploymentPickStore().switcherOpenAsks

    expect(unreadyReason.value).toBeNull()
    expect(await openSwitcherInsteadOfRun()).toBe(false)
    expect(useDeploymentPickStore().switcherOpenAsks).toBe(asksBefore)
  })

  it('reads the listing again before refusing a starting deployment, and lets Run go ahead once it is ready', async () => {
    await loadListing(listingWith('starting'))
    const { openSwitcherInsteadOfRun } = useUnreadyDeploymentRun()
    const listDeployments = answerListingWith(listingWith('ready'))
    listDeployments.mockClear()
    const asksBefore = useDeploymentPickStore().switcherOpenAsks

    expect(await openSwitcherInsteadOfRun()).toBe(false)

    expect(listDeployments).toHaveBeenCalledOnce()
    expect(useDeploymentPickStore().switcherOpenAsks).toBe(asksBefore)
  })

  it('refuses a stopped deployment without reading the listing again', async () => {
    await loadListing(listingWith('stopped'))
    const { openSwitcherInsteadOfRun } = useUnreadyDeploymentRun()
    const listDeployments = answerListingWith(listingWith('stopped'))
    listDeployments.mockClear()

    expect(await openSwitcherInsteadOfRun()).toBe(true)

    expect(listDeployments).not.toHaveBeenCalled()
  })
})
