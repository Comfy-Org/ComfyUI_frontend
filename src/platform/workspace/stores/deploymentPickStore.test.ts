import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkspaceDeploymentList } from '@comfyorg/ingest-types'

import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'

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
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    Object.defineProperty(window, 'location', {
      value: { reload, origin: 'http://localhost' },
      writable: true,
      configurable: true
    })
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

  it('boots on Comfy Cloud when the pick is no longer listed', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: 'dep-gone'
    })
    const store = useDeploymentPickStore()
    await store.loadOnce()

    expect(store.pickIsGone).toBe(true)
    expect(store.bootDeployment).toBeNull()
  })

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
