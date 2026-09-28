import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkspaceReleaseList } from '@comfyorg/ingest-types'

import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'

import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { useReleasePickStore } from './releasePickStore'

const mockWorkspaceApi = vi.hoisted(() => ({
  listReleases: vi.fn(),
  pickRelease: vi.fn(),
  clearRelease: vi.fn(),
  setDefaultRelease: vi.fn(),
  clearDefaultRelease: vi.fn()
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

const listing: WorkspaceReleaseList = {
  builds_visible: true,
  picked_release_id: 'r-2',
  pick_source: 'browser',
  releases: [
    {
      release_id: 'r-2',
      build_id: 'b-1',
      build_name: 'Studio Build',
      version: 2,
      deployed: true,
      deployment_status: 'ready'
    },
    {
      release_id: 'r-1',
      build_id: 'b-1',
      build_name: 'Studio Build',
      version: 1,
      deployed: false
    }
  ]
}

describe('useReleasePickStore', () => {
  const reload = vi.fn()

  beforeEach(() => {
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    Object.defineProperty(window, 'location', {
      value: { reload, origin: 'http://localhost' },
      writable: true,
      configurable: true
    })
  })

  it('loads the listing and knows which Release is picked', async () => {
    mockWorkspaceApi.listReleases.mockResolvedValue(listing)
    const store = useReleasePickStore()
    expect(store.isVisible).toBe(false)

    await store.load()

    expect(mockWorkspaceApi.listReleases).toHaveBeenCalledWith('ws-1')
    expect(store.state.phase).toBe('ready')
    expect(store.isVisible).toBe(true)
    expect(store.releases).toHaveLength(2)
    expect(store.pickedReleaseId).toBe('r-2')
    expect(store.pickedRelease?.build_name).toBe('Studio Build')
    expect(store.pickSource).toBe('browser')
    expect(store.followsWorkspace).toBe(false)
    expect(store.defaultReleaseId).toBeNull()
    expect(store.canSetDefault).toBe(false)
  })

  it('follows the workspace default when the browser has no pick of its own', async () => {
    mockWorkspaceApi.listReleases.mockResolvedValue({
      ...listing,
      pick_source: 'workspace_default',
      default_release_id: 'r-2'
    })
    const store = useReleasePickStore()
    await store.load()

    expect(store.pickedReleaseId).toBe('r-2')
    expect(store.pickSource).toBe('workspace_default')
    expect(store.followsWorkspace).toBe(true)
    expect(store.defaultReleaseId).toBe('r-2')
    expect(store.defaultRelease?.version).toBe(2)

    // Already following: nothing to drop.
    await expect(store.followWorkspace()).resolves.toBeNull()
    expect(mockWorkspaceApi.clearRelease).not.toHaveBeenCalled()

    // Picking Comfy Cloud is this browser's own choice, even though nothing
    // is "picked" yet: it goes through the clear route and reloads.
    mockWorkspaceApi.clearRelease.mockResolvedValue(undefined)
    await expect(store.pick(null)).resolves.toBeNull()
    expect(mockWorkspaceApi.clearRelease).toHaveBeenCalledWith('ws-1')
    expect(reload).toHaveBeenCalledOnce()
  })

  it('drops its own pick to follow the workspace, through the clear route with follow=workspace', async () => {
    mockWorkspaceApi.listReleases.mockResolvedValue({
      ...listing,
      picked_release_id: 'r-1',
      default_release_id: 'r-2'
    })
    mockWorkspaceApi.clearRelease.mockResolvedValue(undefined)
    const store = useReleasePickStore()
    await store.load()

    await expect(store.followWorkspace()).resolves.toBeNull()

    expect(mockWorkspaceApi.clearRelease).toHaveBeenCalledWith('ws-1', {
      follow: 'workspace'
    })
    expect(reload).toHaveBeenCalledOnce()
  })

  it('an owner sets the picked Release as the workspace default and the listing refreshes', async () => {
    Object.assign(useTeamWorkspaceStore(), {
      workspaceId: 'ws-1',
      activeWorkspace: { id: 'ws-1', role: 'owner' }
    })
    mockWorkspaceApi.listReleases
      .mockResolvedValueOnce(listing)
      .mockResolvedValueOnce({ ...listing, default_release_id: 'r-2' })
    mockWorkspaceApi.setDefaultRelease.mockResolvedValue(undefined)
    const store = useReleasePickStore()
    await store.load()
    expect(store.canSetDefault).toBe(true)

    await expect(store.setDefault('r-2')).resolves.toBeNull()

    expect(mockWorkspaceApi.setDefaultRelease).toHaveBeenCalledWith('ws-1', {
      release_id: 'r-2'
    })
    expect(reload).not.toHaveBeenCalled()
    expect(store.state.phase).toBe('ready')
    expect(store.defaultReleaseId).toBe('r-2')

    // Clearing it, likewise; setting what is already set is a no-op.
    await expect(store.setDefault('r-2')).resolves.toBeNull()
    expect(mockWorkspaceApi.setDefaultRelease).toHaveBeenCalledOnce()
    mockWorkspaceApi.listReleases.mockResolvedValueOnce(listing)
    mockWorkspaceApi.clearDefaultRelease.mockResolvedValue(undefined)
    await expect(store.setDefault(null)).resolves.toBeNull()
    expect(mockWorkspaceApi.clearDefaultRelease).toHaveBeenCalledWith('ws-1')
    expect(store.defaultReleaseId).toBeNull()
  })

  it('a browser that follows the workspace reloads when its owner changes the default', async () => {
    mockWorkspaceApi.listReleases.mockResolvedValue({
      ...listing,
      picked_release_id: undefined,
      pick_source: undefined
    })
    mockWorkspaceApi.setDefaultRelease.mockResolvedValue(undefined)
    const store = useReleasePickStore()
    await store.load()
    expect(store.followsWorkspace).toBe(true)

    await expect(store.setDefault('r-2')).resolves.toBeNull()
    expect(reload).toHaveBeenCalledOnce()
  })

  it("hands back the server's refusal of a default and stays ready", async () => {
    mockWorkspaceApi.listReleases.mockResolvedValue(listing)
    mockWorkspaceApi.setDefaultRelease.mockRejectedValue(
      new WorkspaceApiError(
        'only a workspace owner can set the default release',
        403
      )
    )
    const store = useReleasePickStore()
    await store.load()

    await expect(store.setDefault('r-1')).resolves.toBe(
      'only a workspace owner can set the default release'
    )
    expect(store.state.phase).toBe('ready')
    expect(store.defaultReleaseId).toBeNull()
    expect(reload).not.toHaveBeenCalled()
  })

  it('hides itself when the account is outside the rollout', async () => {
    mockWorkspaceApi.listReleases.mockRejectedValue(
      new WorkspaceApiError(
        'not enabled for this account yet',
        403,
        'FORBIDDEN'
      )
    )
    const store = useReleasePickStore()
    await store.load()
    expect(store.state.phase).toBe('hidden')
    expect(store.isVisible).toBe(false)
  })

  it('is unavailable, with the message, when the platform cannot be asked', async () => {
    mockWorkspaceApi.listReleases.mockRejectedValue(
      new WorkspaceApiError(
        'could not list releases from comfy-deploy; try again',
        503
      )
    )
    const store = useReleasePickStore()
    await store.load()
    expect(store.state).toEqual({
      phase: 'unavailable',
      message: 'could not list releases from comfy-deploy; try again'
    })
    expect(store.isVisible).toBe(true)
  })

  it('picks a Release and reloads the page', async () => {
    mockWorkspaceApi.listReleases.mockResolvedValue(listing)
    mockWorkspaceApi.pickRelease.mockResolvedValue(undefined)
    const store = useReleasePickStore()
    await store.load()

    await expect(store.pick('r-1')).resolves.toBeNull()

    expect(mockWorkspaceApi.pickRelease).toHaveBeenCalledWith('ws-1', {
      release_id: 'r-1'
    })
    expect(reload).toHaveBeenCalledOnce()
  })

  it('clears the pick for Comfy Cloud and reloads', async () => {
    mockWorkspaceApi.listReleases.mockResolvedValue(listing)
    mockWorkspaceApi.clearRelease.mockResolvedValue(undefined)
    const store = useReleasePickStore()
    await store.load()

    await expect(store.pick(null)).resolves.toBeNull()

    expect(mockWorkspaceApi.clearRelease).toHaveBeenCalledWith('ws-1')
    expect(mockWorkspaceApi.pickRelease).not.toHaveBeenCalled()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('hands back a refused pick and stays ready, without reloading', async () => {
    mockWorkspaceApi.listReleases.mockResolvedValue(listing)
    mockWorkspaceApi.pickRelease.mockRejectedValue(
      new WorkspaceApiError(
        'release r-1 has no deployment; deploy it first',
        422
      )
    )
    const store = useReleasePickStore()
    await store.load()

    await expect(store.pick('r-1')).resolves.toBe(
      'release r-1 has no deployment; deploy it first'
    )
    expect(store.state.phase).toBe('ready')
    expect(store.pickedReleaseId).toBe('r-2')
    expect(reload).not.toHaveBeenCalled()
  })

  it('picking the current Release is a no-op', async () => {
    mockWorkspaceApi.listReleases.mockResolvedValue(listing)
    const store = useReleasePickStore()
    await store.load()

    await expect(store.pick('r-2')).resolves.toBeNull()
    expect(mockWorkspaceApi.pickRelease).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('ignores a listing that arrives after the workspace changed', async () => {
    let resolve: (value: WorkspaceReleaseList) => void = () => {}
    mockWorkspaceApi.listReleases.mockReturnValue(
      new Promise<WorkspaceReleaseList>((r) => {
        resolve = r
      })
    )
    const store = useReleasePickStore()
    const loading = store.load()
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-2' })
    resolve(listing)
    await loading

    expect(store.state.phase).toBe('loading')
    expect(store.releases).toEqual([])
  })

  it('does nothing without an active workspace', async () => {
    Object.assign(useTeamWorkspaceStore(), { workspaceId: null })
    const store = useReleasePickStore()
    await store.load()
    expect(mockWorkspaceApi.listReleases).not.toHaveBeenCalled()
    expect(store.state.phase).toBe('idle')
  })
})
