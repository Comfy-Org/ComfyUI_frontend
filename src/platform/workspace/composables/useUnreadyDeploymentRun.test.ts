import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
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

const runStands = () => true

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

async function loadListing(listing: WorkspaceDeploymentList) {
  vi.spyOn(workspaceApi, 'listDeployments').mockResolvedValue(listing)
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
      expect(await openSwitcherInsteadOfRun(runStands)).toBe(true)
      expect(useDeploymentPickStore().switcherOpenAsks).toBe(asksBefore + 1)
    }
  )

  it('lets the original Run go ahead when a fresh listing says the same deployment is ready', async () => {
    await loadListing(listingWith('stopped'))
    const { openSwitcherInsteadOfRun } = useUnreadyDeploymentRun()
    const listDeployments = vi
      .spyOn(workspaceApi, 'listDeployments')
      .mockResolvedValue(listingWith('ready'))
    listDeployments.mockClear()
    const asksBefore = useDeploymentPickStore().switcherOpenAsks

    expect(await openSwitcherInsteadOfRun(runStands)).toBe(false)

    expect(listDeployments).toHaveBeenCalledOnce()
    expect(useDeploymentPickStore().switcherOpenAsks).toBe(asksBefore)
  })

  it('drops a second Run made while the listing is being read again', async () => {
    await loadListing(listingWith('stopped'))
    const { openSwitcherInsteadOfRun } = useUnreadyDeploymentRun()
    const listDeployments = vi
      .spyOn(workspaceApi, 'listDeployments')
      .mockResolvedValue(listingWith('ready'))
    listDeployments.mockClear()

    const firstRun = openSwitcherInsteadOfRun(runStands)
    const secondRun = openSwitcherInsteadOfRun(runStands)

    expect(await secondRun).toBe(true)
    expect(await firstRun).toBe(false)
    expect(listDeployments).toHaveBeenCalledOnce()
  })

  it('drops a second Run when another refresh turns the deployment ready while the first Run still waits', async () => {
    await loadListing(listingWith('stopped'))
    const { openSwitcherInsteadOfRun } = useUnreadyDeploymentRun()
    let answerFirstRead: () => void = () => {}
    vi.spyOn(workspaceApi, 'listDeployments')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            answerFirstRead = () => resolve(listingWith('ready'))
          })
      )
      .mockResolvedValue(listingWith('ready'))

    const firstRun = openSwitcherInsteadOfRun(runStands)
    await useDeploymentPickStore().load()
    const secondRun = openSwitcherInsteadOfRun(runStands)
    answerFirstRead()

    expect(await secondRun).toBe(true)
    expect(await firstRun).toBe(false)
  })

  it.for<{ status: WorkspaceDeployment['status'] }>([
    { status: 'stopped' },
    { status: 'ready' }
  ])(
    'drops the Run without opening the menu when it no longer stands after a fresh listing says $status',
    async ({ status }) => {
      await loadListing(listingWith('stopped'))
      const { openSwitcherInsteadOfRun } = useUnreadyDeploymentRun()
      vi.spyOn(workspaceApi, 'listDeployments').mockResolvedValue(
        listingWith(status)
      )
      const asksBefore = useDeploymentPickStore().switcherOpenAsks

      expect(await openSwitcherInsteadOfRun(() => false)).toBe(true)

      expect(useDeploymentPickStore().switcherOpenAsks).toBe(asksBefore)
    }
  )

  it.for<{ status: WorkspaceDeployment['status'] }>([
    { status: 'stopped' },
    { status: 'ready' }
  ])(
    'drops the Run without opening the menu when App mode is entered while a fresh listing that says $status is read',
    async ({ status }) => {
      await loadListing(listingWith('stopped'))
      const { openSwitcherInsteadOfRun } = useUnreadyDeploymentRun()
      vi.spyOn(workspaceApi, 'listDeployments').mockResolvedValue(
        listingWith(status)
      )
      const asksBefore = useDeploymentPickStore().switcherOpenAsks

      const run = openSwitcherInsteadOfRun(runStands)
      useWorkflowStore().activeWorkflow = fromPartial<
        NonNullable<ReturnType<typeof useWorkflowStore>['activeWorkflow']>
      >({ activeMode: 'app' })

      expect(await run).toBe(true)
      expect(useDeploymentPickStore().switcherOpenAsks).toBe(asksBefore)
    }
  )

  it.for<{ status: WorkspaceDeployment['status'] }>([
    { status: 'stopped' },
    { status: 'ready' }
  ])(
    'drops the Run without opening the menu when App mode is entered and left again while a fresh listing that says $status is read',
    async ({ status }) => {
      await loadListing(listingWith('stopped'))
      const { openSwitcherInsteadOfRun } = useUnreadyDeploymentRun()
      vi.spyOn(workspaceApi, 'listDeployments').mockResolvedValue(
        listingWith(status)
      )
      const asksBefore = useDeploymentPickStore().switcherOpenAsks
      const graphWorkflow = useWorkflowStore().activeWorkflow

      const run = openSwitcherInsteadOfRun(runStands)
      useWorkflowStore().activeWorkflow = fromPartial<
        NonNullable<ReturnType<typeof useWorkflowStore>['activeWorkflow']>
      >({ activeMode: 'app' })
      useWorkflowStore().activeWorkflow = graphWorkflow

      expect(await run).toBe(true)
      expect(useDeploymentPickStore().switcherOpenAsks).toBe(asksBefore)
    }
  )

  it('lets a Run in App mode go ahead while a Run from the graph is still being checked', async () => {
    await loadListing(listingWith('stopped'))
    const { openSwitcherInsteadOfRun } = useUnreadyDeploymentRun()
    vi.spyOn(workspaceApi, 'listDeployments').mockResolvedValue(
      listingWith('stopped')
    )

    const graphRun = openSwitcherInsteadOfRun(runStands)
    useWorkflowStore().activeWorkflow = fromPartial<
      NonNullable<ReturnType<typeof useWorkflowStore>['activeWorkflow']>
    >({ activeMode: 'app' })

    expect(await openSwitcherInsteadOfRun(runStands)).toBe(false)
    expect(await graphRun).toBe(true)
  })

  it('opens the Run on menu when the fresh listing does not answer in time', async () => {
    await loadListing(listingWith('stopped'))
    const { openSwitcherInsteadOfRun } = useUnreadyDeploymentRun()
    vi.spyOn(workspaceApi, 'listDeployments').mockReturnValue(
      new Promise(() => {})
    )
    const asksBefore = useDeploymentPickStore().switcherOpenAsks
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })

    const run = openSwitcherInsteadOfRun(runStands)
    await vi.advanceTimersByTimeAsync(3000)

    expect(await run).toBe(true)
    expect(useDeploymentPickStore().switcherOpenAsks).toBe(asksBefore + 1)
  })

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
    expect(await openSwitcherInsteadOfRun(runStands)).toBe(false)
    expect(useDeploymentPickStore().switcherOpenAsks).toBe(asksBefore)
  })
})
