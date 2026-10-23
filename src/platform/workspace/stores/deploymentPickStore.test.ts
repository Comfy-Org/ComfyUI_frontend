import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'

import type { WorkspaceDeploymentList } from '@/platform/workspace/api/workspaceApi'

import { DEPLOYMENT_LISTING_BACKSTOP_MS } from '@/platform/workspace/api/deploymentListingTimeouts'

import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'

import {
  readDeploymentHint,
  setDeploymentHint,
  setUnconfirmedCloudHint
} from '@/platform/workspace/deploymentHint'

import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { useDeploymentPickStore } from './deploymentPickStore'

const mockWorkspaceApi = vi.hoisted(() => ({
  listDeployments: vi.fn(),
  pickDeployment: vi.fn(),
  clearDeployment: vi.fn(),
  setDefaultDeployment: vi.fn(),
  clearDefaultDeployment: vi.fn()
}))

vi.mock<unknown>(import('@/platform/workspace/api/workspaceApi'), async () => {
  class WorkspaceApiError extends Error {
    constructor(
      message: string,
      public readonly status?: number,
      public readonly code?: string
    ) {
      super(message)
      this.name = 'WorkspaceApiError'
    }
  }
  return { workspaceApi: mockWorkspaceApi, WorkspaceApiError }
})

vi.mock(import('@/platform/telemetry/reportError'), { spy: true })

const listing: WorkspaceDeploymentList = {
  builds_visible: true,
  picked_deployment_id: 'dep-2',
  pick_source: 'browser',
  items: [
    {
      deployment_id: 'dep-2',
      release_id: 'r-2',
      build_id: 'b-1',
      build_name: 'Studio Build',
      release_version: 2,
      status: 'ready',
      created_at: '2026-10-01T00:00:00Z'
    },
    {
      deployment_id: 'dep-1',
      release_id: 'r-1',
      build_id: 'b-1',
      build_name: 'Studio Build',
      release_version: 1,
      status: 'stopped',
      created_at: '2026-09-20T00:00:00Z'
    }
  ]
}

describe('useDeploymentPickStore', () => {
  const reload = vi.fn()

  beforeEach(() => {
    vi.mocked(reportError).mockImplementation(() => undefined)
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    Object.defineProperty(window, 'location', {
      value: { reload, origin: 'http://localhost' },
      writable: true,
      configurable: true
    })
  })

  it.for([
    new WorkspaceApiError('Service unavailable', 503),
    new WorkspaceApiError('Network Error'),
    new WorkspaceApiError('Bad request', 400),
    new TypeError('Network unavailable')
  ])('reports a failed deployment lookup once: %s', async (error) => {
    mockWorkspaceApi.listDeployments.mockRejectedValue(error)
    const store = useDeploymentPickStore()

    const boot = store.loadOnce()
    await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_BACKSTOP_MS)
    await boot

    expect(store.bootDeployment).toBeUndefined()
    expect(reportError).toHaveBeenCalledExactlyOnceWith(error, {
      surface: 'workspace',
      errorType: 'error_loading_deployment_listing'
    })
  })

  it('reports failed lookups once per page, however often they fail', async () => {
    const error = new WorkspaceApiError('Service unavailable', 503)
    mockWorkspaceApi.listDeployments.mockRejectedValue(error)
    const store = useDeploymentPickStore()

    const boot = store.loadOnce()
    await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_BACKSTOP_MS)
    await boot
    await store.load()
    await store.load()

    expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledTimes(5)
    expect(reportError).toHaveBeenCalledExactlyOnceWith(error, {
      surface: 'workspace',
      errorType: 'error_loading_deployment_listing'
    })
  })

  it('saves the one report for the active workspace when a left workspace fails', async () => {
    const staleError = new WorkspaceApiError('Service unavailable', 503)
    let reject: (err: unknown) => void = () => {}
    mockWorkspaceApi.listDeployments.mockReturnValueOnce(
      new Promise<WorkspaceDeploymentList>((_, r) => {
        reject = r
      })
    )
    const store = useDeploymentPickStore()
    const stale = store.load()
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-2' })
    reject(staleError)
    await stale

    expect(reportError).not.toHaveBeenCalled()

    const error = new WorkspaceApiError('Bad gateway', 502)
    mockWorkspaceApi.listDeployments.mockRejectedValue(error)
    await store.load()
    await store.load()

    expect(reportError).toHaveBeenCalledExactlyOnceWith(error, {
      surface: 'workspace',
      errorType: 'error_loading_deployment_listing'
    })
  })

  it.for([
    new WorkspaceApiError('Service unavailable', 503),
    new WorkspaceApiError('Gateway timeout', 504),
    new WorkspaceApiError('timeout of 30000ms exceeded')
  ])(
    'retries a transient boot lookup failure and boots on the listing: %s',
    async (error) => {
      mockWorkspaceApi.listDeployments
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(listing)
      const store = useDeploymentPickStore()
      const settled = vi.fn()

      const boot = store.loadOnce().then(settled)
      await vi.advanceTimersByTimeAsync(0)
      expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1_000)
      expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(2_000)
      await boot

      expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledTimes(3)
      expect(settled).toHaveBeenCalledOnce()
      expect(store.bootDeployment?.deployment_id).toBe('dep-2')
      expect(reportError).not.toHaveBeenCalled()
    }
  )

  it('gives up on the boot lookup after three attempts', async () => {
    const error = new WorkspaceApiError('Service unavailable', 503)
    mockWorkspaceApi.listDeployments.mockRejectedValue(error)
    const store = useDeploymentPickStore()

    const boot = store.loadOnce()
    await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_BACKSTOP_MS)
    await boot

    expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledTimes(3)
    expect(store.bootDeployment).toBeUndefined()
    expect(store.isVisible).toBe(false)
  })

  it.for([
    new WorkspaceApiError('Bad request', 400),
    new TypeError('Network unavailable')
  ])(
    'does not retry a lookup failure that is not transient: %s',
    async (error) => {
      mockWorkspaceApi.listDeployments.mockRejectedValue(error)
      const store = useDeploymentPickStore()

      const boot = store.loadOnce()
      await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_BACKSTOP_MS)
      await boot

      expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledOnce()
    }
  )

  it('does not retry a lookup the switcher asks for', async () => {
    mockWorkspaceApi.listDeployments.mockRejectedValue(
      new WorkspaceApiError('Service unavailable', 503)
    )
    const store = useDeploymentPickStore()

    const reload = store.load()
    await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_BACKSTOP_MS)
    await reload

    expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledOnce()
  })

  it('stops retrying the boot lookup once the workspace changes', async () => {
    mockWorkspaceApi.listDeployments.mockRejectedValue(
      new WorkspaceApiError('Service unavailable', 503)
    )
    const store = useDeploymentPickStore()

    const boot = store.loadOnce()
    await vi.advanceTimersByTimeAsync(0)
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-2' })
    await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_BACKSTOP_MS)
    await boot

    expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledOnce()
    expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledWith('ws-1')
  })

  it('boots on Comfy Cloud, quietly, when ingest has no deployment routes (404)', async () => {
    mockWorkspaceApi.listDeployments.mockRejectedValue(
      new WorkspaceApiError('Not found', 404)
    )
    const store = useDeploymentPickStore()

    await store.loadOnce()

    expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledOnce()
    expect(store.bootDeployment).toBeNull()
    expect(store.isVisible).toBe(false)
    expect(reportError).not.toHaveBeenCalled()
  })

  it('keeps an unconfirmed boot on Comfy Cloud when a later listing answers', async () => {
    mockWorkspaceApi.listDeployments
      .mockRejectedValueOnce(new WorkspaceApiError('Bad request', 400))
      .mockResolvedValueOnce(listing)
    const store = useDeploymentPickStore()
    await store.loadOnce()
    expect(store.bootDeployment).toBeUndefined()

    store.bootOnComfyCloud()
    await store.load()

    expect(store.bootDeployment).toBeNull()
    expect(store.changeSinceBoot).toBe('deployment')
  })

  it('does not report an expected rollout refusal as an error', async () => {
    mockWorkspaceApi.listDeployments.mockRejectedValueOnce(
      new WorkspaceApiError('Outside rollout', 403)
    )
    const store = useDeploymentPickStore()

    await store.loadOnce()

    expect(store.bootDeployment).toBeNull()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('keeps Cloud as the boot source when an excluded account later gets a listing', async () => {
    mockWorkspaceApi.listDeployments
      .mockRejectedValueOnce(new WorkspaceApiError('Outside rollout', 403))
      .mockResolvedValueOnce(listing)
    const store = useDeploymentPickStore()
    await store.loadOnce()
    expect(store.bootDeployment).toBeNull()
    await store.load()
    expect(store.bootDeployment).toBeNull()
    expect(store.changeSinceBoot).toBe('deployment')
  })

  it('loads the listing and knows which deployment is picked', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    const store = useDeploymentPickStore()
    expect(store.isVisible).toBe(false)

    await store.load()

    expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledWith('ws-1')
    expect(store.state.phase).toBe('ready')
    expect(store.isVisible).toBe(true)
    expect(store.deployments).toHaveLength(2)
    expect(store.pickedDeploymentId).toBe('dep-2')
    expect(store.pickedDeployment?.build_name).toBe('Studio Build')
    expect(store.pickSource).toBe('browser')
    expect(store.followsWorkspace).toBe(false)
    expect(store.defaultDeploymentId).toBeNull()
    expect(store.canSetDefault).toBe(false)
  })

  it('remembers the deployment the page booted on from the first listing only', async () => {
    mockWorkspaceApi.listDeployments
      .mockResolvedValueOnce(listing)
      .mockResolvedValue({ ...listing, picked_deployment_id: 'dep-1' })
    const store = useDeploymentPickStore()
    expect(store.bootDeployment).toBeUndefined()

    await Promise.all([store.loadOnce(), store.loadOnce()])
    expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledOnce()
    expect(store.bootDeployment?.deployment_id).toBe('dep-2')

    await store.load()
    expect(store.pickedDeploymentId).toBe('dep-1')
    expect(store.bootDeployment?.deployment_id).toBe('dep-2')
  })

  it('boots on Comfy Cloud when ingest reports the pick gone', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: undefined,
      gone_picked_deployment_id: 'dep-gone'
    })
    const store = useDeploymentPickStore()
    await store.loadOnce()

    expect(store.goneDeployment).toBe('pick')
    expect(store.bootDeployment).toBeNull()
  })

  it.for(['browser', 'workspace_default'] as const)(
    'does not invent a gone %s deployment from an inconsistent listing',
    async (pickSource) => {
      mockWorkspaceApi.listDeployments.mockResolvedValue({
        ...listing,
        picked_deployment_id: 'dep-unlisted',
        pick_source: pickSource
      } satisfies WorkspaceDeploymentList)
      const store = useDeploymentPickStore()

      await store.loadOnce()

      expect(store.goneDeployment).toBeNull()
    }
  )

  it('keeps saying the pick is gone after the one listing that reported it', async () => {
    const onCloud = {
      ...listing,
      picked_deployment_id: undefined,
      pick_source: undefined
    }
    mockWorkspaceApi.listDeployments
      .mockResolvedValueOnce({ ...onCloud, gone_picked_deployment_id: 'dep-x' })
      .mockResolvedValue(onCloud)
    const store = useDeploymentPickStore()
    await store.loadOnce()
    expect(store.goneDeployment).toBe('pick')

    await store.load()

    expect(store.goneDeployment).toBe('pick')
    expect(store.bootDeployment).toBeNull()
  })

  it('stops saying the pick is gone once a later listing shows a picked deployment', async () => {
    const onCloud = {
      ...listing,
      picked_deployment_id: undefined,
      pick_source: undefined
    }
    mockWorkspaceApi.listDeployments
      .mockResolvedValueOnce({ ...onCloud, gone_picked_deployment_id: 'dep-x' })
      .mockResolvedValueOnce(onCloud)
      .mockResolvedValue({ ...listing, picked_deployment_id: 'dep-1' })
    const store = useDeploymentPickStore()
    await store.loadOnce()
    await store.load()
    expect(store.goneDeployment).toBe('pick')

    await store.load()

    expect(store.pickedDeployment?.deployment_id).toBe('dep-1')
    expect(store.goneDeployment).toBeNull()
  })

  it.for([
    { now: 'the same deployment and Release', next: listing, change: null },
    {
      now: 'its deployment on another Release',
      next: {
        ...listing,
        items: [{ ...listing.items[0], release_id: 'r-3' }, listing.items[1]]
      },
      change: 'release'
    },
    {
      now: 'another deployment with another Release',
      next: { ...listing, picked_deployment_id: 'dep-1' },
      change: 'deployment'
    },
    {
      now: 'another deployment of the same Release',
      next: {
        ...listing,
        picked_deployment_id: 'dep-1',
        items: [listing.items[0], { ...listing.items[1], release_id: 'r-2' }]
      },
      change: null
    },
    {
      now: 'Comfy Cloud',
      next: {
        ...listing,
        picked_deployment_id: undefined,
        pick_source: undefined
      },
      change: 'deployment'
    }
  ] satisfies {
    now: string
    next: WorkspaceDeploymentList
    change: 'release' | 'deployment' | null
  }[])(
    'says what changed when a later listing runs on $now',
    async ({ next, change }) => {
      mockWorkspaceApi.listDeployments
        .mockResolvedValueOnce(listing)
        .mockResolvedValue(next)
      const store = useDeploymentPickStore()
      await store.loadOnce()
      expect(store.changeSinceBoot).toBeNull()

      await store.load()

      expect(store.changeSinceBoot).toBe(change)
    }
  )

  it('follows the workspace default when the browser has no pick of its own', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      pick_source: 'workspace_default',
      default_deployment_id: 'dep-2'
    })
    const store = useDeploymentPickStore()
    await store.load()

    expect(store.pickedDeploymentId).toBe('dep-2')
    expect(store.pickSource).toBe('workspace_default')
    expect(store.followsWorkspace).toBe(true)
    expect(store.defaultDeploymentId).toBe('dep-2')
    expect(store.defaultDeployment?.release_version).toBe(2)

    // Already following: nothing to drop.
    await expect(store.followWorkspace()).resolves.toBeNull()
    expect(mockWorkspaceApi.clearDeployment).not.toHaveBeenCalled()

    // Picking Comfy Cloud is this browser's own choice, even though the
    // browser runs on dep-2 only because it follows the default: it goes
    // through the clear route and reloads.
    mockWorkspaceApi.clearDeployment.mockResolvedValue(undefined)
    await expect(store.pick(null)).resolves.toBeNull()
    expect(mockWorkspaceApi.clearDeployment).toHaveBeenCalledWith('ws-1')
    expect(reload).toHaveBeenCalledOnce()
  })

  it('drops its own pick to follow the workspace, through the clear route with follow=workspace', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: 'dep-1',
      default_deployment_id: 'dep-2'
    })
    mockWorkspaceApi.clearDeployment.mockResolvedValue(undefined)
    const store = useDeploymentPickStore()
    await store.load()

    await expect(store.followWorkspace()).resolves.toBeNull()

    expect(mockWorkspaceApi.clearDeployment).toHaveBeenCalledWith('ws-1', {
      follow: 'workspace'
    })
    expect(reload).toHaveBeenCalledOnce()
  })

  it('locks out other switches while it drops an own pick of the default itself', async () => {
    const ownPickOfDefault = {
      ...listing,
      picked_deployment_id: 'dep-2',
      pick_source: 'browser',
      default_deployment_id: 'dep-2'
    } satisfies WorkspaceDeploymentList
    mockWorkspaceApi.listDeployments
      .mockResolvedValueOnce(ownPickOfDefault)
      .mockResolvedValue({
        ...ownPickOfDefault,
        pick_source: 'workspace_default'
      })
    const cleared = deferred<void>()
    mockWorkspaceApi.clearDeployment.mockReturnValue(cleared.promise)
    const store = useDeploymentPickStore()
    await store.load()

    const following = store.followWorkspace()

    expect(store.isSwitching).toBe(true)
    await expect(store.pick('dep-1')).resolves.toBeNull()
    expect(mockWorkspaceApi.pickDeployment).not.toHaveBeenCalled()

    cleared.resolve()
    await expect(following).resolves.toBeNull()
    expect(store.isSwitching).toBe(false)
    expect(store.followsWorkspace).toBe(true)
    expect(reload).not.toHaveBeenCalled()
  })

  it('an owner sets the picked deployment as the workspace default and the listing refreshes', async () => {
    Object.assign(useTeamWorkspaceStore(), {
      workspaceId: 'ws-1',
      activeWorkspace: { id: 'ws-1', role: 'owner' }
    })
    mockWorkspaceApi.listDeployments
      .mockResolvedValueOnce(listing)
      .mockResolvedValueOnce({ ...listing, default_deployment_id: 'dep-2' })
    mockWorkspaceApi.setDefaultDeployment.mockResolvedValue(undefined)
    const store = useDeploymentPickStore()
    await store.load()
    expect(store.canSetDefault).toBe(true)

    await expect(store.setDefault('dep-2')).resolves.toBeNull()

    expect(mockWorkspaceApi.setDefaultDeployment).toHaveBeenCalledWith('ws-1', {
      deployment_id: 'dep-2'
    })
    expect(reload).not.toHaveBeenCalled()
    expect(store.state.phase).toBe('ready')
    expect(store.defaultDeploymentId).toBe('dep-2')

    // Clearing it, likewise; setting what is already set is a no-op.
    await expect(store.setDefault('dep-2')).resolves.toBeNull()
    expect(mockWorkspaceApi.setDefaultDeployment).toHaveBeenCalledOnce()
    mockWorkspaceApi.listDeployments.mockResolvedValueOnce(listing)
    mockWorkspaceApi.clearDefaultDeployment.mockResolvedValue(undefined)
    await expect(store.setDefault(null)).resolves.toBeNull()
    expect(mockWorkspaceApi.clearDefaultDeployment).toHaveBeenCalledWith('ws-1')
    expect(store.defaultDeploymentId).toBeNull()
  })

  it('a browser that follows the workspace reloads when its owner changes the default', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: undefined,
      pick_source: undefined
    })
    mockWorkspaceApi.setDefaultDeployment.mockResolvedValue(undefined)
    const store = useDeploymentPickStore()
    await store.load()
    expect(store.followsWorkspace).toBe(true)

    await expect(store.setDefault('dep-2')).resolves.toBeNull()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('an owner clears a workspace default that no longer exists without reloading a browser that already runs on Comfy Cloud', async () => {
    Object.assign(useTeamWorkspaceStore(), {
      workspaceId: 'ws-1',
      activeWorkspace: { id: 'ws-1', role: 'owner' }
    })
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: undefined,
      pick_source: undefined,
      gone_default_deployment_id: 'dep-gone'
    })
    mockWorkspaceApi.clearDefaultDeployment.mockResolvedValue(undefined)
    const store = useDeploymentPickStore()
    await store.load()
    expect(store.defaultDeploymentId).toBeNull()
    expect(store.goneDeployment).toBe('default')

    await expect(store.setDefault(null)).resolves.toBeNull()

    expect(mockWorkspaceApi.clearDefaultDeployment).toHaveBeenCalledWith('ws-1')
    expect(reload).not.toHaveBeenCalled()
    expect(store.isSwitching).toBe(false)
  })

  it("hands back the server's refusal of a default and stays ready", async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    mockWorkspaceApi.setDefaultDeployment.mockRejectedValue(
      new WorkspaceApiError(
        'only a workspace owner can set the default deployment',
        403
      )
    )
    const store = useDeploymentPickStore()
    await store.load()

    await expect(store.setDefault('dep-1')).resolves.toBe(
      'only a workspace owner can set the default deployment'
    )
    expect(store.state.phase).toBe('ready')
    expect(store.defaultDeploymentId).toBeNull()
    expect(reload).not.toHaveBeenCalled()
  })

  it('hides itself when the account is outside the rollout', async () => {
    mockWorkspaceApi.listDeployments.mockRejectedValue(
      new WorkspaceApiError(
        'not enabled for this account yet',
        403,
        'FORBIDDEN'
      )
    )
    const store = useDeploymentPickStore()
    await store.load()
    expect(store.state.phase).toBe('hidden')
    expect(store.isVisible).toBe(false)
  })

  it('picks a deployment and reloads the page', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    mockWorkspaceApi.pickDeployment.mockResolvedValue(undefined)
    const store = useDeploymentPickStore()
    await store.load()

    await expect(store.pick('dep-1')).resolves.toBeNull()

    expect(mockWorkspaceApi.pickDeployment).toHaveBeenCalledWith('ws-1', {
      deployment_id: 'dep-1'
    })
    expect(reload).toHaveBeenCalledOnce()
  })

  it('goes back to the listing, refreshed, when the page is still in use after a switch reload', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    mockWorkspaceApi.pickDeployment.mockResolvedValue(undefined)
    const store = useDeploymentPickStore()
    await store.load()
    await store.pick('dep-1')
    expect(store.isSwitching).toBe(true)

    window.dispatchEvent(new Event('pointerdown'))

    expect(store.isSwitching).toBe(false)
    await vi.waitFor(() =>
      expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledTimes(2)
    )
  })

  it('clears the pick for Comfy Cloud and reloads', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    mockWorkspaceApi.clearDeployment.mockResolvedValue(undefined)
    const store = useDeploymentPickStore()
    await store.load()

    await expect(store.pick(null)).resolves.toBeNull()

    expect(mockWorkspaceApi.clearDeployment).toHaveBeenCalledWith('ws-1')
    expect(mockWorkspaceApi.pickDeployment).not.toHaveBeenCalled()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('hands back a refused pick and stays ready, without reloading', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    mockWorkspaceApi.pickDeployment.mockRejectedValue(
      new WorkspaceApiError(
        "deployment dep-1 is not one of this workspace's",
        422
      )
    )
    const store = useDeploymentPickStore()
    await store.load()

    await expect(store.pick('dep-1')).resolves.toBe(
      "deployment dep-1 is not one of this workspace's"
    )
    expect(store.state.phase).toBe('ready')
    expect(store.pickedDeploymentId).toBe('dep-2')
    expect(reload).not.toHaveBeenCalled()
  })

  it('picking the current deployment is a no-op', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    const store = useDeploymentPickStore()
    await store.load()

    await expect(store.pick('dep-2')).resolves.toBeNull()
    expect(mockWorkspaceApi.pickDeployment).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('ignores a listing that arrives after the workspace changed', async () => {
    let resolve: (value: WorkspaceDeploymentList) => void = () => {}
    mockWorkspaceApi.listDeployments.mockReturnValue(
      new Promise<WorkspaceDeploymentList>((r) => {
        resolve = r
      })
    )
    const store = useDeploymentPickStore()
    const loading = store.load()
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-2' })
    resolve(listing)
    await loading

    expect(store.state.phase).toBe('idle')
    expect(store.deployments).toEqual([])
  })

  it("hides the last workspace's listing as soon as the workspace changes", async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValueOnce(listing)
    const store = useDeploymentPickStore()
    await store.load()
    expect(store.pickedDeploymentId).toBe('dep-2')

    mockWorkspaceApi.listDeployments.mockRejectedValue(new Error('offline'))
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-2' })
    expect(store.isVisible).toBe(false)
    expect(store.deployments).toEqual([])
    expect(store.pickedDeploymentId).toBeNull()

    await store.load()
    expect(mockWorkspaceApi.listDeployments).toHaveBeenLastCalledWith('ws-2')
    expect(store.state.phase).toBe('hidden')
  })

  it("loads the new workspace's listing on the next loadOnce", async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    const store = useDeploymentPickStore()
    await store.loadOnce()

    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-2' })
    await store.loadOnce()

    expect(mockWorkspaceApi.listDeployments).toHaveBeenLastCalledWith('ws-2')
    expect(store.pickedDeploymentId).toBe('dep-2')
  })

  describe('a pick from a link', () => {
    it('keeps a link pick exclusive when a late listing arrives after a failed boot listing', async () => {
      const listed = deferred<WorkspaceDeploymentList>()
      const put = deferred<void>()
      const started = deferred<void>()
      mockWorkspaceApi.listDeployments
        .mockRejectedValueOnce(new Error('listing failed'))
        .mockReturnValueOnce(listed.promise)
      mockWorkspaceApi.pickDeployment.mockImplementation(() => {
        started.resolve()
        return put.promise
      })
      const store = useDeploymentPickStore()
      await store.loadOnce()
      const refresh = store.load()
      const linked = store.pickFromLink('dep-1')
      await started.promise
      listed.resolve(listing)
      await refresh
      const competing = store.pick('dep-other')
      put.resolve()
      await Promise.all([linked, competing])
      expect(mockWorkspaceApi.pickDeployment).toHaveBeenCalledTimes(1)
      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('stops waiting for a stalled listing and never picks when it eventually answers', async () => {
      vi.useFakeTimers()
      const listed = deferred<WorkspaceDeploymentList>()
      mockWorkspaceApi.listDeployments.mockReturnValue(listed.promise)
      const store = useDeploymentPickStore()
      const settled = vi.fn()
      const linked = store.pickFromLink('dep-1').then(settled)
      await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_BACKSTOP_MS - 1)
      expect(settled).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(settled).toHaveBeenCalledWith({ kind: 'timedOut' })
      listed.resolve(listing)
      await linked
      expect(mockWorkspaceApi.pickDeployment).not.toHaveBeenCalled()
      expect(reload).not.toHaveBeenCalled()
    })

    it('times out and cancels a stalled selection after a slow failed listing without reloading on late success', async () => {
      vi.useFakeTimers()
      const listed = deferred<WorkspaceDeploymentList>()
      const selected = deferred<void>()
      let selectionSignal: AbortSignal | undefined
      mockWorkspaceApi.listDeployments.mockReturnValue(listed.promise)
      mockWorkspaceApi.pickDeployment.mockImplementation(
        (_id: string, _payload: unknown, signal?: AbortSignal) => {
          selectionSignal = signal
          return selected.promise
        }
      )
      const store = useDeploymentPickStore()
      const settled = vi.fn()
      const linked = store.pickFromLink('dep-1').then(settled)
      await vi.advanceTimersByTimeAsync(30_000)
      listed.reject(new Error('listing timed out'))
      await vi.advanceTimersByTimeAsync(0)
      expect(mockWorkspaceApi.pickDeployment).toHaveBeenCalledOnce()
      await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_BACKSTOP_MS)
      expect(settled).toHaveBeenCalledWith({ kind: 'timedOut' })
      expect(selectionSignal?.aborted).toBe(true)
      expect(store.isSwitching).toBe(false)
      selected.resolve()
      await linked
      await vi.advanceTimersByTimeAsync(0)
      expect(reload).not.toHaveBeenCalled()
    })

    it.for([12_000, DEPLOYMENT_LISTING_BACKSTOP_MS - 1])(
      'selects the linked deployment when the listing succeeds after %i ms',
      async (delay) => {
        vi.useFakeTimers()
        const listed = deferred<WorkspaceDeploymentList>()
        mockWorkspaceApi.listDeployments.mockReturnValue(listed.promise)
        mockWorkspaceApi.pickDeployment.mockResolvedValue(undefined)
        const store = useDeploymentPickStore()
        const linked = store.pickFromLink('dep-1')
        await vi.advanceTimersByTimeAsync(delay)
        listed.resolve(listing)
        await expect(linked).resolves.toEqual({ kind: 'picked' })
        expect(mockWorkspaceApi.pickDeployment).toHaveBeenCalledExactlyOnceWith(
          'ws-1',
          { deployment_id: 'dep-1' },
          expect.any(AbortSignal)
        )
        expect(reload).toHaveBeenCalledOnce()
      }
    )

    it('waits for the first listing, then picks and reloads', async () => {
      mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
      mockWorkspaceApi.pickDeployment.mockResolvedValue(undefined)
      const store = useDeploymentPickStore()

      await expect(store.pickFromLink('dep-1')).resolves.toEqual({
        kind: 'picked'
      })

      expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledOnce()
      expect(mockWorkspaceApi.pickDeployment).toHaveBeenCalledWith(
        'ws-1',
        {
          deployment_id: 'dep-1'
        },
        expect.any(AbortSignal)
      )
      expect(reload).toHaveBeenCalledOnce()
    })

    it('does nothing for the deployment this browser already runs on', async () => {
      mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
      const store = useDeploymentPickStore()

      await expect(store.pickFromLink('dep-2')).resolves.toEqual({
        kind: 'unchanged'
      })
      expect(mockWorkspaceApi.pickDeployment).not.toHaveBeenCalled()
      expect(reload).not.toHaveBeenCalled()
    })

    // The switcher stays hidden outside the rollout, but a link still asks,
    // so the person learns why nothing changed.
    it("hands back the server's refusal when the account is outside the rollout", async () => {
      mockWorkspaceApi.listDeployments.mockRejectedValue(
        new WorkspaceApiError('not enabled for this account yet', 403)
      )
      mockWorkspaceApi.pickDeployment.mockRejectedValue(
        new WorkspaceApiError('not enabled for this account yet', 403)
      )
      const store = useDeploymentPickStore()

      await expect(store.pickFromLink('dep-1')).resolves.toEqual({
        kind: 'refused',
        message: 'not enabled for this account yet'
      })
      expect(store.state.phase).toBe('hidden')
      expect(reload).not.toHaveBeenCalled()
    })

    it("hands back a refused pick and keeps the listing's pick", async () => {
      mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
      mockWorkspaceApi.pickDeployment.mockRejectedValue(
        new WorkspaceApiError('deployment not found', 422)
      )
      const store = useDeploymentPickStore()

      await expect(store.pickFromLink('dep-gone')).resolves.toEqual({
        kind: 'refused',
        message: 'deployment not found'
      })
      expect(store.state.phase).toBe('ready')
      expect(store.pickedDeploymentId).toBe('dep-2')
      expect(reload).not.toHaveBeenCalled()
    })
  })

  it('does nothing without an active workspace', async () => {
    Object.assign(useTeamWorkspaceStore(), { workspaceId: null })
    const store = useDeploymentPickStore()
    await store.load()
    expect(mockWorkspaceApi.listDeployments).not.toHaveBeenCalled()
    expect(store.state.phase).toBe('idle')
  })

  describe('while the listing loads', () => {
    it('stays hidden until the first listing answers', async () => {
      const listed = deferred<WorkspaceDeploymentList>()
      mockWorkspaceApi.listDeployments.mockReturnValue(listed.promise)
      const store = useDeploymentPickStore()

      const loading = store.load()
      expect(store.isVisible).toBe(false)

      listed.resolve(listing)
      await loading
      expect(store.isVisible).toBe(true)
    })

    it('stays hidden while it reloads for an account the last answer hid', async () => {
      mockWorkspaceApi.listDeployments.mockRejectedValueOnce(
        new WorkspaceApiError('not enabled for this account yet', 403)
      )
      const store = useDeploymentPickStore()
      await store.load()
      expect(store.isVisible).toBe(false)

      // The popover remounts the switcher on every open, so every open reloads.
      const listed = deferred<WorkspaceDeploymentList>()
      mockWorkspaceApi.listDeployments.mockReturnValue(listed.promise)
      void store.load()
      expect(store.isVisible).toBe(false)
    })

    it('keeps the last listing on screen until the new one lands', async () => {
      mockWorkspaceApi.listDeployments.mockResolvedValueOnce({
        ...listing,
        default_deployment_id: 'dep-1'
      })
      const store = useDeploymentPickStore()
      await store.load()

      const listed = deferred<WorkspaceDeploymentList>()
      mockWorkspaceApi.listDeployments.mockReturnValue(listed.promise)
      const reloading = store.load()
      expect(store.isVisible).toBe(true)
      expect(store.pickedDeploymentId).toBe('dep-2')
      expect(store.defaultDeploymentId).toBe('dep-1')
      expect(store.deployments).toHaveLength(2)

      listed.resolve({ ...listing, picked_deployment_id: 'dep-1' })
      await reloading
      expect(store.pickedDeploymentId).toBe('dep-1')
    })

    it('shows the new default at once while the listing refreshes after an owner changes it', async () => {
      Object.assign(useTeamWorkspaceStore(), {
        workspaceId: 'ws-1',
        activeWorkspace: { id: 'ws-1', role: 'owner' }
      })
      mockWorkspaceApi.listDeployments.mockResolvedValueOnce({
        ...listing,
        default_deployment_id: 'dep-1'
      })
      mockWorkspaceApi.setDefaultDeployment.mockResolvedValue(undefined)
      const store = useDeploymentPickStore()
      await store.load()

      const listed = deferred<WorkspaceDeploymentList>()
      mockWorkspaceApi.listDeployments.mockReturnValue(listed.promise)
      const setting = store.setDefault('dep-2')
      await vi.waitFor(() =>
        expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledTimes(2)
      )
      expect(store.defaultDeploymentId).toBe('dep-2')
      expect(store.isSwitching).toBe(false)

      listed.resolve({ ...listing, default_deployment_id: 'dep-2' })
      await setting
      expect(store.defaultDeploymentId).toBe('dep-2')
    })

    it('keeps the switcher locked when a listing lands while a pick is in flight', async () => {
      mockWorkspaceApi.listDeployments.mockResolvedValueOnce(listing)
      const store = useDeploymentPickStore()
      await store.load()

      // The popover was reopened: a reload is in flight, the rows are clickable.
      const listed = deferred<WorkspaceDeploymentList>()
      mockWorkspaceApi.listDeployments.mockReturnValueOnce(listed.promise)
      const reloading = store.load()
      const put = deferred<void>()
      mockWorkspaceApi.pickDeployment.mockReturnValueOnce(put.promise)
      const picking = store.pick('dep-1')

      listed.resolve({ ...listing, default_deployment_id: 'dep-1' })
      await reloading
      expect(store.isSwitching).toBe(true)
      expect(store.state).toMatchObject({ phase: 'switching', target: 'dep-1' })
      expect(store.defaultDeploymentId).toBe('dep-1')

      // A second pick cannot go out while the first is in flight.
      await expect(store.pick(null)).resolves.toBeNull()
      expect(mockWorkspaceApi.clearDeployment).not.toHaveBeenCalled()

      put.resolve()
      await picking
      expect(mockWorkspaceApi.pickDeployment).toHaveBeenCalledOnce()
      expect(reload).toHaveBeenCalledOnce()
    })

    it.for([
      {
        later: 'a listing answers',
        async afterRefusal(store: ReturnType<typeof useDeploymentPickStore>) {
          mockWorkspaceApi.listDeployments.mockResolvedValueOnce(listing)
          await store.load()
          expect(store.isVisible).toBe(true)
        }
      },
      {
        later: 'nothing more answers',
        async afterRefusal(store: ReturnType<typeof useDeploymentPickStore>) {
          expect(store.isVisible).toBe(false)
        }
      }
    ])(
      'keeps the switcher locked when a refresh is refused while a pick is in flight and $later',
      async ({ afterRefusal }) => {
        mockWorkspaceApi.listDeployments.mockResolvedValueOnce(listing)
        const store = useDeploymentPickStore()
        await store.load()
        const put = deferred<void>()
        mockWorkspaceApi.pickDeployment.mockReturnValueOnce(put.promise)
        const picking = store.pick('dep-1')

        mockWorkspaceApi.listDeployments.mockRejectedValueOnce(
          new WorkspaceApiError('not enabled for this account yet', 403)
        )
        await store.load()
        expect(store.isVisible).toBe(false)
        expect(store.isSwitching).toBe(true)
        await afterRefusal(store)

        await expect(store.pick(null)).resolves.toBeNull()
        await expect(store.setDefault('dep-1')).resolves.toBeNull()
        expect(mockWorkspaceApi.clearDeployment).not.toHaveBeenCalled()
        expect(mockWorkspaceApi.setDefaultDeployment).not.toHaveBeenCalled()

        put.resolve()
        await picking
        expect(mockWorkspaceApi.pickDeployment).toHaveBeenCalledOnce()
        expect(reload).toHaveBeenCalledOnce()
      }
    )

    it('hides itself when a pick refused after a refresh said the account left the rollout', async () => {
      mockWorkspaceApi.listDeployments.mockResolvedValueOnce(listing)
      const store = useDeploymentPickStore()
      await store.load()
      const put = deferred<void>()
      mockWorkspaceApi.pickDeployment.mockReturnValueOnce(put.promise)
      const picking = store.pick('dep-1')
      mockWorkspaceApi.listDeployments.mockRejectedValueOnce(
        new WorkspaceApiError('not enabled for this account yet', 403)
      )
      await store.load()

      put.reject(new WorkspaceApiError('not enabled for this account yet', 403))
      await expect(picking).resolves.toBe('not enabled for this account yet')
      expect(store.state.phase).toBe('hidden')
      expect(reload).not.toHaveBeenCalled()
    })

    it('returns to the newer listing when a pick that a listing overtook is refused', async () => {
      mockWorkspaceApi.listDeployments.mockResolvedValueOnce(listing)
      const store = useDeploymentPickStore()
      await store.load()

      const listed = deferred<WorkspaceDeploymentList>()
      mockWorkspaceApi.listDeployments.mockReturnValueOnce(listed.promise)
      const reloading = store.load()
      const put = deferred<void>()
      mockWorkspaceApi.pickDeployment.mockReturnValueOnce(put.promise)
      const picking = store.pick('dep-1')
      listed.resolve({ ...listing, default_deployment_id: 'dep-1' })
      await reloading

      put.reject(
        new WorkspaceApiError("deployment is not one of this workspace's", 422)
      )
      await expect(picking).resolves.toBe(
        "deployment is not one of this workspace's"
      )
      expect(store.state.phase).toBe('ready')
      expect(store.defaultDeploymentId).toBe('dep-1')
      expect(reload).not.toHaveBeenCalled()
    })
  })

  describe('when the listing fails', () => {
    it.for([
      ['a 400', new WorkspaceApiError('invalid workspace id', 400)],
      ['a 401', new WorkspaceApiError('Authentication required', 401)],
      ['a 403', new WorkspaceApiError('not enabled for this account yet', 403)],
      [
        'a 404 (ingest without the routes)',
        new WorkspaceApiError('404 page not found', 404)
      ],
      ['a 500', new WorkspaceApiError('Failed to list deployments', 500)],
      [
        'a 503',
        new WorkspaceApiError(
          'could not list deployments from comfy-deploy; try again',
          503
        )
      ],
      ['a network error', new WorkspaceApiError('Network Error')],
      ['no signed-in user', new Error('User not authenticated')]
    ] as const)(
      'hides itself on a first load that fails with %s',
      async ([, err]) => {
        mockWorkspaceApi.listDeployments.mockRejectedValue(err)
        const store = useDeploymentPickStore()
        await store.load()
        expect(store.state.phase).toBe('hidden')
        expect(store.isVisible).toBe(false)
      }
    )

    it('hides a shown listing and stops retrying when a refresh gets a 404', async () => {
      mockWorkspaceApi.listDeployments
        .mockResolvedValueOnce(listing)
        .mockRejectedValueOnce(new WorkspaceApiError('404 page not found', 404))
      const store = useDeploymentPickStore()
      await store.load()

      await store.load()

      expect(store.isVisible).toBe(false)
      expect(store.listingRefused).toBe(true)
    })

    it.for([
      { answer: 'a 403', status: 403, refused: true },
      { answer: 'a 404', status: 404, refused: true },
      { answer: 'a 503', status: 503, refused: false }
    ])('treats $answer as final: $refused', async ({ status, refused }) => {
      mockWorkspaceApi.listDeployments.mockRejectedValue(
        new WorkspaceApiError('listing failed', status)
      )
      const store = useDeploymentPickStore()
      await store.load()
      expect(store.listingRefused).toBe(refused)
    })

    it('keeps the last listing when a refresh fails', async () => {
      mockWorkspaceApi.listDeployments.mockResolvedValueOnce(listing)
      const store = useDeploymentPickStore()
      await store.load()

      mockWorkspaceApi.listDeployments.mockRejectedValueOnce(
        new WorkspaceApiError(
          'could not list deployments from comfy-deploy; try again',
          503
        )
      )
      await store.load()
      expect(store.state.phase).toBe('ready')
      expect(store.isVisible).toBe(true)
      expect(store.pickedDeploymentId).toBe('dep-2')
    })

    it('hides itself when a refresh says the account left the rollout', async () => {
      mockWorkspaceApi.listDeployments.mockResolvedValueOnce(listing)
      const store = useDeploymentPickStore()
      await store.load()

      mockWorkspaceApi.listDeployments.mockRejectedValueOnce(
        new WorkspaceApiError('not enabled for this account yet', 403)
      )
      await store.load()
      expect(store.isVisible).toBe(false)
    })

    it('ends the switch when the refresh after a new default fails', async () => {
      Object.assign(useTeamWorkspaceStore(), {
        workspaceId: 'ws-1',
        activeWorkspace: { id: 'ws-1', role: 'owner' }
      })
      mockWorkspaceApi.listDeployments
        .mockResolvedValueOnce(listing)
        .mockRejectedValueOnce(new WorkspaceApiError('Bad Gateway', 502))
      mockWorkspaceApi.setDefaultDeployment.mockResolvedValue(undefined)
      const store = useDeploymentPickStore()
      await store.load()

      await expect(store.setDefault('dep-2')).resolves.toBeNull()
      expect(store.isSwitching).toBe(false)
      expect(store.state.phase).toBe('ready')
    })

    it.for([
      ['sets', 'dep-2', 'dep-2'],
      ['clears', null, null]
    ] as const)(
      'shows the default an owner %s even when the refresh after it fails',
      async ([, target, shown]) => {
        Object.assign(useTeamWorkspaceStore(), {
          workspaceId: 'ws-1',
          activeWorkspace: { id: 'ws-1', role: 'owner' }
        })
        mockWorkspaceApi.listDeployments
          .mockResolvedValueOnce({ ...listing, default_deployment_id: 'dep-1' })
          .mockRejectedValueOnce(
            new WorkspaceApiError(
              'could not list deployments from comfy-deploy; try again',
              503
            )
          )
        mockWorkspaceApi.setDefaultDeployment.mockResolvedValue(undefined)
        mockWorkspaceApi.clearDefaultDeployment.mockResolvedValue(undefined)
        const store = useDeploymentPickStore()
        await store.load()

        await expect(store.setDefault(target)).resolves.toBeNull()
        expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledTimes(2)
        expect(store.defaultDeploymentId).toBe(shown)
        expect(store.state.phase).toBe('ready')
        // This browser has its own pick, so the new default does not reload it.
        expect(reload).not.toHaveBeenCalled()
      }
    )
  })

  describe('when answers arrive out of order', () => {
    it.for([
      [
        'fails',
        () =>
          mockWorkspaceApi.listDeployments.mockRejectedValueOnce(
            new WorkspaceApiError(
              'could not list deployments from comfy-deploy; try again',
              503
            )
          )
      ],
      [
        'answers first',
        () =>
          mockWorkspaceApi.listDeployments.mockResolvedValueOnce({
            ...listing,
            default_deployment_id: 'dep-2'
          })
      ]
    ] as const)(
      'keeps a new default when a listing asked for before it lands last and the refresh %s',
      async ([, queueRefresh]) => {
        Object.assign(useTeamWorkspaceStore(), {
          workspaceId: 'ws-1',
          activeWorkspace: { id: 'ws-1', role: 'owner' }
        })
        mockWorkspaceApi.listDeployments.mockResolvedValueOnce({
          ...listing,
          default_deployment_id: 'dep-1'
        })
        mockWorkspaceApi.setDefaultDeployment.mockResolvedValue(undefined)
        const store = useDeploymentPickStore()
        await store.load()

        // The popover was reopened: a listing with the old default is in flight.
        const stale = deferred<WorkspaceDeploymentList>()
        mockWorkspaceApi.listDeployments.mockReturnValueOnce(stale.promise)
        const reloading = store.load()

        queueRefresh()
        await expect(store.setDefault('dep-2')).resolves.toBeNull()
        expect(store.defaultDeploymentId).toBe('dep-2')

        stale.resolve({ ...listing, default_deployment_id: 'dep-1' })
        await reloading
        expect(store.defaultDeploymentId).toBe('dep-2')
        expect(store.state.phase).toBe('ready')
      }
    )

    it('keeps the newer listing when an older one lands after it', async () => {
      const older = deferred<WorkspaceDeploymentList>()
      mockWorkspaceApi.listDeployments
        .mockReturnValueOnce(older.promise)
        .mockResolvedValueOnce({ ...listing, picked_deployment_id: 'dep-1' })
      const store = useDeploymentPickStore()
      const first = store.load()
      await store.load()
      expect(store.pickedDeploymentId).toBe('dep-1')

      older.resolve(listing)
      await first
      expect(store.pickedDeploymentId).toBe('dep-1')
    })

    it.for([
      { newer: 'shows no pick', reply: {}, gone: 'pick' },
      {
        newer: 'shows a deployment picked',
        reply: { picked_deployment_id: 'dep-1', pick_source: 'browser' },
        gone: null
      }
    ] satisfies {
      newer: string
      reply: Partial<WorkspaceDeploymentList>
      gone: 'pick' | null
    }[])(
      'says the pick is gone: $gone, when an older listing reports it gone after a newer one that $newer answered',
      async ({ reply, gone }) => {
        const older = deferred<WorkspaceDeploymentList>()
        mockWorkspaceApi.listDeployments
          .mockReturnValueOnce(older.promise)
          .mockResolvedValueOnce({
            ...listing,
            picked_deployment_id: undefined,
            pick_source: undefined,
            ...reply
          })
        const store = useDeploymentPickStore()
        const first = store.load()
        await store.load()

        older.resolve({
          ...listing,
          picked_deployment_id: undefined,
          pick_source: undefined,
          gone_picked_deployment_id: 'dep-gone'
        })
        await first

        expect(store.goneDeployment).toBe(gone)
      }
    )

    it('stays visible when an older listing fails after a newer one answered', async () => {
      const older = deferred<WorkspaceDeploymentList>()
      mockWorkspaceApi.listDeployments
        .mockReturnValueOnce(older.promise)
        .mockResolvedValueOnce(listing)
      const store = useDeploymentPickStore()
      const first = store.load()
      await store.load()

      older.reject(
        new WorkspaceApiError('not enabled for this account yet', 403)
      )
      await first
      expect(store.isVisible).toBe(true)
      expect(store.pickedDeploymentId).toBe('dep-2')
    })

    // The popover was closed and reopened before the first listing answered,
    // so two listings are in flight on the first load.
    it.for([
      ['a 503', new WorkspaceApiError('upstream', 503)],
      ['a network error', new Error('Network Error')]
    ] as const)(
      'shows an older listing that answered when the newer one fails with %s',
      async ([, error]) => {
        const newer = deferred<WorkspaceDeploymentList>()
        mockWorkspaceApi.listDeployments
          .mockResolvedValueOnce(listing)
          .mockReturnValueOnce(newer.promise)
        const store = useDeploymentPickStore()
        const first = store.load()
        const second = store.load()
        await first
        expect(store.isVisible).toBe(true)
        expect(store.pickedDeploymentId).toBe('dep-2')

        newer.reject(error)
        await second
        expect(store.state.phase).toBe('ready')
        expect(store.pickedDeploymentId).toBe('dep-2')
      }
    )

    it('shows an older listing that answered while the newer one never answers', async () => {
      mockWorkspaceApi.listDeployments
        .mockResolvedValueOnce(listing)
        .mockReturnValueOnce(new Promise(() => {}))
      const store = useDeploymentPickStore()
      const first = store.load()
      void store.load()
      await first
      expect(store.state.phase).toBe('ready')
      expect(store.pickedDeploymentId).toBe('dep-2')
    })

    it('shows an older listing that answers after the newer one failed', async () => {
      const older = deferred<WorkspaceDeploymentList>()
      mockWorkspaceApi.listDeployments
        .mockReturnValueOnce(older.promise)
        .mockRejectedValueOnce(new Error('Network Error'))
      const store = useDeploymentPickStore()
      const first = store.load()
      await store.load()
      expect(store.isVisible).toBe(false)

      older.resolve(listing)
      await first
      expect(store.state.phase).toBe('ready')
      expect(store.pickedDeploymentId).toBe('dep-2')
    })

    it('hides itself when the newer listing says the account left the rollout', async () => {
      const newer = deferred<WorkspaceDeploymentList>()
      mockWorkspaceApi.listDeployments
        .mockResolvedValueOnce(listing)
        .mockReturnValueOnce(newer.promise)
      const store = useDeploymentPickStore()
      const first = store.load()
      const second = store.load()
      await first

      newer.reject(
        new WorkspaceApiError('not enabled for this account yet', 403)
      )
      await second
      expect(store.state.phase).toBe('hidden')
    })

    it('takes an older 403 at once while a newer listing is still in flight', async () => {
      const older = deferred<WorkspaceDeploymentList>()
      const newer = deferred<WorkspaceDeploymentList>()
      mockWorkspaceApi.listDeployments
        .mockReturnValueOnce(older.promise)
        .mockReturnValueOnce(newer.promise)
      const store = useDeploymentPickStore()
      const first = store.load()
      const second = store.load()

      older.reject(
        new WorkspaceApiError('not enabled for this account yet', 403)
      )
      await first
      // A refusal is an answer about the account, unlike a plain failure.
      expect(store.state.phase).toBe('hidden')

      newer.resolve(listing)
      await second
      expect(store.state.phase).toBe('ready')
    })

    it('ignores an older failure while a newer listing is still in flight', async () => {
      const older = deferred<WorkspaceDeploymentList>()
      const newer = deferred<WorkspaceDeploymentList>()
      mockWorkspaceApi.listDeployments
        .mockReturnValueOnce(older.promise)
        .mockReturnValueOnce(newer.promise)
      const store = useDeploymentPickStore()
      const first = store.load()
      const second = store.load()

      older.reject(new Error('Network Error'))
      await first
      // Still waiting on the newer listing, not settled on "the load failed".
      expect(store.state.phase).toBe('idle')

      newer.resolve(listing)
      await second
      expect(store.state.phase).toBe('ready')
    })
  })

  describe('clicking the row already checked', () => {
    it('does nothing on Comfy Cloud with no pick and no default', async () => {
      mockWorkspaceApi.listDeployments.mockResolvedValue({
        ...listing,
        picked_deployment_id: undefined,
        pick_source: undefined
      })
      const store = useDeploymentPickStore()
      await store.load()

      await expect(store.pick(null)).resolves.toBeNull()
      expect(mockWorkspaceApi.clearDeployment).not.toHaveBeenCalled()
      expect(reload).not.toHaveBeenCalled()
    })

    it("does nothing on the workspace default's row, so the browser keeps following it", async () => {
      mockWorkspaceApi.listDeployments.mockResolvedValue({
        ...listing,
        pick_source: 'workspace_default',
        default_deployment_id: 'dep-2'
      })
      const store = useDeploymentPickStore()
      await store.load()

      await expect(store.pick('dep-2')).resolves.toBeNull()
      expect(mockWorkspaceApi.pickDeployment).not.toHaveBeenCalled()
      expect(reload).not.toHaveBeenCalled()
      expect(store.followsWorkspace).toBe(true)
    })
  })

  describe("this browser's deployment hint", () => {
    type HintState = ReturnType<typeof readDeploymentHint>

    function seedHint(hint: HintState) {
      if (hint === 'deployment') setDeploymentHint('ws-1', 'dep-1')
      else if (hint === 'cloud') setDeploymentHint('ws-1', null)
      else if (hint === 'unconfirmed') setUnconfirmedCloudHint('ws-1')
    }

    beforeEach(() => {
      localStorage.clear()
    })

    it.for<{
      answer: string
      hintBefore: HintState
      respond: () => void
      hintAfter: HintState
    }>([
      {
        answer: 'a listing on a deployment',
        hintBefore: 'unknown',
        respond: () =>
          mockWorkspaceApi.listDeployments.mockResolvedValue(listing),
        hintAfter: 'deployment'
      },
      {
        answer: 'a listing on Comfy Cloud, after a boot on a deployment',
        hintBefore: 'deployment',
        respond: () =>
          mockWorkspaceApi.listDeployments.mockResolvedValue({
            ...listing,
            picked_deployment_id: null,
            pick_source: null
          }),
        hintAfter: 'cloud'
      },
      {
        answer: 'a listing on Comfy Cloud, with no hint',
        hintBefore: 'unknown',
        respond: () =>
          mockWorkspaceApi.listDeployments.mockResolvedValue({
            ...listing,
            picked_deployment_id: null,
            pick_source: null
          }),
        hintAfter: 'cloud'
      },
      {
        answer: 'a 403',
        hintBefore: 'deployment',
        respond: () =>
          mockWorkspaceApi.listDeployments.mockRejectedValue(
            new WorkspaceApiError('Outside rollout', 403)
          ),
        hintAfter: 'cloud'
      },
      {
        answer: 'a 404',
        hintBefore: 'unknown',
        respond: () =>
          mockWorkspaceApi.listDeployments.mockRejectedValue(
            new WorkspaceApiError('Not found', 404)
          ),
        hintAfter: 'cloud'
      },
      {
        answer: 'a 403, after a failure left Comfy Cloud unconfirmed',
        hintBefore: 'unconfirmed',
        respond: () =>
          mockWorkspaceApi.listDeployments.mockRejectedValue(
            new WorkspaceApiError('Outside rollout', 403)
          ),
        hintAfter: 'cloud'
      },
      ...(['deployment', 'cloud', 'unconfirmed'] as const).map((hint) => ({
        answer: `a transient failure, with the hint at ${hint}`,
        hintBefore: hint,
        respond: () =>
          mockWorkspaceApi.listDeployments.mockRejectedValue(
            new WorkspaceApiError('Service unavailable', 503)
          ),
        hintAfter: hint
      })),
      {
        answer: 'a transient failure, with no hint',
        hintBefore: 'unknown',
        respond: () =>
          mockWorkspaceApi.listDeployments.mockRejectedValue(
            new WorkspaceApiError('Service unavailable', 503)
          ),
        hintAfter: 'unconfirmed'
      },
      {
        answer: 'a failure that is not transient, with no hint',
        hintBefore: 'unknown',
        respond: () =>
          mockWorkspaceApi.listDeployments.mockRejectedValue(
            new WorkspaceApiError('Bad request', 400)
          ),
        hintAfter: 'unknown'
      }
    ])(
      'keeps the hint in step with the boot listing: $answer',
      async ({ hintBefore, respond, hintAfter }) => {
        seedHint(hintBefore)
        respond()
        const store = useDeploymentPickStore()

        const boot = store.loadOnce()
        await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_BACKSTOP_MS)
        await boot

        expect(readDeploymentHint('ws-1')).toBe(hintAfter)
      }
    )

    it.for<{ why: string; arrange: () => void; hintAfter: HintState }>([
      {
        why: 'this browser last booted on a deployment',
        arrange: () => seedHint('deployment'),
        hintAfter: 'deployment'
      },
      {
        why: 'the page opened from a deployment link',
        arrange: () =>
          Object.defineProperty(window, 'location', {
            value: {
              reload,
              origin: 'http://localhost',
              search: '?deployment=dep-1'
            },
            writable: true,
            configurable: true
          }),
        hintAfter: 'unknown'
      }
    ])(
      'leaves the hint alone and still reports a transient failure when $why',
      async ({ arrange, hintAfter }) => {
        arrange()
        const error = new WorkspaceApiError('Service unavailable', 503)
        mockWorkspaceApi.listDeployments.mockRejectedValue(error)
        const store = useDeploymentPickStore()

        const boot = store.loadOnce()
        await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_BACKSTOP_MS)
        await boot

        expect(readDeploymentHint('ws-1')).toBe(hintAfter)
        expect(reportError).toHaveBeenCalledExactlyOnceWith(error, {
          surface: 'workspace',
          errorType: 'error_loading_deployment_listing'
        })
      }
    )

    it('never writes the unconfirmed Comfy Cloud hint where an older frontend would read a deployment id', async () => {
      mockWorkspaceApi.listDeployments.mockRejectedValue(
        new WorkspaceApiError('Service unavailable', 503)
      )

      await useDeploymentPickStore().load()

      expect(readDeploymentHint('ws-1')).toBe('unconfirmed')
      expect(localStorage.getItem('Comfy.Workspace.DeploymentHint.ws-1')).toBe(
        null
      )
    })

    it.for<{
      answer: string
      respond: () => void
      legacyHint: string
      hintAfter: HintState
    }>([
      {
        answer: 'a deployment',
        respond: () =>
          mockWorkspaceApi.listDeployments.mockResolvedValueOnce(listing),
        legacyHint: 'dep-2',
        hintAfter: 'deployment'
      },
      {
        answer: 'Comfy Cloud',
        respond: () =>
          mockWorkspaceApi.listDeployments.mockResolvedValueOnce({
            ...listing,
            picked_deployment_id: null,
            pick_source: null
          }),
        legacyHint: 'cloud',
        hintAfter: 'cloud'
      },
      {
        answer: 'a 403',
        respond: () =>
          mockWorkspaceApi.listDeployments.mockRejectedValueOnce(
            new WorkspaceApiError('Outside rollout', 403)
          ),
        legacyHint: 'cloud',
        hintAfter: 'cloud'
      }
    ])(
      'replaces the unconfirmed Comfy Cloud hint a failure left once a listing answers with $answer',
      async ({ respond, legacyHint, hintAfter }) => {
        mockWorkspaceApi.listDeployments.mockRejectedValueOnce(
          new WorkspaceApiError('Service unavailable', 503)
        )
        const store = useDeploymentPickStore()

        await store.load()
        expect(readDeploymentHint('ws-1')).toBe('unconfirmed')
        respond()
        await store.load()

        expect(readDeploymentHint('ws-1')).toBe(hintAfter)
        expect(
          localStorage.getItem('Comfy.Workspace.DeploymentHint.ws-1')
        ).toBe(legacyHint)
        expect(
          localStorage.getItem('Comfy.Workspace.UnconfirmedCloudHint.ws-1')
        ).toBeNull()
      }
    )

    it.for([
      { legacyHint: 'dep-1', hint: 'deployment' },
      { legacyHint: 'cloud', hint: 'cloud' }
    ])(
      'reads the hint an older frontend wrote over an unconfirmed Comfy Cloud hint: $legacyHint',
      ({ legacyHint, hint }) => {
        setUnconfirmedCloudHint('ws-1')
        localStorage.setItem('Comfy.Workspace.DeploymentHint.ws-1', legacyHint)

        expect(readDeploymentHint('ws-1')).toBe(hint)
      }
    )

    it('keeps the hint per workspace', async () => {
      mockWorkspaceApi.listDeployments.mockResolvedValue(listing)

      await useDeploymentPickStore().load()

      expect(readDeploymentHint('ws-1')).toBe('deployment')
      expect(readDeploymentHint('ws-2')).toBe('unknown')
    })

    it.for<{
      action: string
      listed: WorkspaceDeploymentList
      hintBefore: HintState
      act: (
        store: ReturnType<typeof useDeploymentPickStore>
      ) => Promise<unknown>
      hintAfter: HintState
    }>([
      {
        action: 'picking a deployment',
        listed: listing,
        hintBefore: 'cloud',
        act: (store) => store.pick('dep-1'),
        hintAfter: 'deployment'
      },
      {
        action: 'picking Comfy Cloud',
        listed: listing,
        hintBefore: 'deployment',
        act: (store) => store.pick(null),
        hintAfter: 'cloud'
      },
      {
        action: 'picking from a link',
        listed: listing,
        hintBefore: 'cloud',
        act: (store) => store.pickFromLink('dep-1'),
        hintAfter: 'deployment'
      },
      {
        action: 'following a workspace with a default',
        listed: { ...listing, default_deployment_id: 'dep-1' },
        hintBefore: 'cloud',
        act: (store) => store.followWorkspace(),
        hintAfter: 'deployment'
      },
      {
        action: 'following a workspace with no default',
        listed: listing,
        hintBefore: 'deployment',
        act: (store) => store.followWorkspace(),
        hintAfter: 'cloud'
      },
      {
        action: 'setting a default while following the workspace',
        listed: {
          ...listing,
          picked_deployment_id: undefined,
          pick_source: undefined
        },
        hintBefore: 'cloud',
        act: (store) => store.setDefault('dep-1'),
        hintAfter: 'deployment'
      },
      {
        action: 'clearing the default while following the workspace',
        listed: {
          ...listing,
          pick_source: 'workspace_default',
          default_deployment_id: 'dep-2'
        },
        hintBefore: 'deployment',
        act: (store) => store.setDefault(null),
        hintAfter: 'cloud'
      }
    ])(
      'sets the hint for the next boot before reloading: $action',
      async ({ listed, hintBefore, act, hintAfter }) => {
        mockWorkspaceApi.listDeployments.mockResolvedValue(listed)
        mockWorkspaceApi.pickDeployment.mockResolvedValue(undefined)
        mockWorkspaceApi.clearDeployment.mockResolvedValue(undefined)
        mockWorkspaceApi.setDefaultDeployment.mockResolvedValue(undefined)
        mockWorkspaceApi.clearDefaultDeployment.mockResolvedValue(undefined)
        const store = useDeploymentPickStore()
        await store.load()
        seedHint(hintBefore)
        reload.mockImplementation(() =>
          expect(readDeploymentHint('ws-1')).toBe(hintAfter)
        )

        await act(store)

        expect(reload).toHaveBeenCalledOnce()
        expect(readDeploymentHint('ws-1')).toBe(hintAfter)
      }
    )

    it('loads the listing when localStorage throws', async () => {
      vi.stubGlobal('localStorage', {
        getItem: () => null,
        setItem: () => {
          throw new DOMException('quota', 'QuotaExceededError')
        }
      })
      mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
      const store = useDeploymentPickStore()

      await store.loadOnce()

      expect(store.bootDeployment?.deployment_id).toBe('dep-2')
    })
  })
})

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  let reject: (err: unknown) => void = () => {}
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
