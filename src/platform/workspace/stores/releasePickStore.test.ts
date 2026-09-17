import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkspaceReleaseList } from '@comfyorg/ingest-types'

import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'

import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { useReleasePickStore } from './releasePickStore'

const mockWorkspaceApi = vi.hoisted(() => ({
  listReleases: vi.fn(),
  pickRelease: vi.fn(),
  clearRelease: vi.fn()
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
