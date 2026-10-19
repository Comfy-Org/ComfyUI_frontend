import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { clearPreservedQuery } from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { reportError } from '@/platform/telemetry/reportError'
import { DEPLOYMENT_LISTING_BACKSTOP_MS } from '@/platform/workspace/api/deploymentListingTimeouts'
import type { WorkspaceDeploymentList } from '@/platform/workspace/api/workspaceApi'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'
import { setDeploymentHint } from '@/platform/workspace/deploymentHint'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { waitForDeploymentPick } from './waitForDeploymentPick'

const mockWorkspaceApi = vi.hoisted(() => ({ listDeployments: vi.fn() }))

vi.mock<unknown>(import('@/platform/workspace/api/workspaceApi'), async () => {
  class WorkspaceApiError extends Error {
    constructor(
      message: string,
      public readonly status?: number
    ) {
      super(message)
      this.name = 'WorkspaceApiError'
    }
  }
  return { workspaceApi: mockWorkspaceApi, WorkspaceApiError }
})

vi.mock(import('@/platform/telemetry/reportError'), { spy: true })

const failures = [
  { failure: 'a 500', error: new WorkspaceApiError('Server error', 500) },
  { failure: 'a network error', error: new WorkspaceApiError('Network Error') },
  { failure: 'a 401', error: new WorkspaceApiError('Unauthorized', 401) }
]

function listingOn(
  deploymentId: string,
  pickSource: 'workspace_default' | 'browser'
): WorkspaceDeploymentList {
  return {
    builds_visible: true,
    picked_deployment_id: deploymentId,
    pick_source: pickSource,
    default_deployment_id:
      pickSource === 'workspace_default' ? deploymentId : undefined,
    items: [
      {
        deployment_id: deploymentId,
        release_id: 'r-2',
        build_id: 'b-1',
        build_name: 'Studio Build',
        release_version: 2,
        status: 'ready',
        created_at: '2026-10-01T00:00:00Z'
      }
    ]
  }
}

function openedAt(url: string) {
  window.history.replaceState(null, '', url)
  onTestFinished(() => window.history.replaceState(null, '', '/'))
}

function settledAt(promise: Promise<boolean>) {
  const result = { value: undefined as boolean | undefined }
  void promise.then((value) => {
    result.value = value
  })
  return result
}

describe('waitForDeploymentPick', () => {
  beforeEach(() => {
    vi.mocked(reportError).mockImplementation(() => undefined)
    localStorage.clear()
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
  })

  it.for(failures)(
    'boots on Comfy Cloud at once, reporting but not waiting on $failure, when this browser last booted on Comfy Cloud',
    async ({ error }) => {
      setDeploymentHint('ws-1', null)
      mockWorkspaceApi.listDeployments.mockRejectedValue(error)
      const store = useDeploymentPickStore()
      const boot = store.loadOnce()

      const confirmed = settledAt(waitForDeploymentPick())
      await vi.advanceTimersByTimeAsync(0)

      expect(confirmed.value).toBe(true)
      expect(store.bootDeployment).toBeNull()
      await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_BACKSTOP_MS)
      await boot
      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        error,
        expect.objectContaining({
          errorType: 'error_loading_deployment_listing'
        })
      )
    }
  )

  it('boots on Comfy Cloud at once, without asking for the listing, when this browser last booted on Comfy Cloud', async () => {
    setDeploymentHint('ws-1', null)
    mockWorkspaceApi.listDeployments.mockReturnValue(new Promise(() => {}))

    const confirmed = settledAt(waitForDeploymentPick())
    await vi.advanceTimersByTimeAsync(0)

    expect(confirmed.value).toBe(true)
    expect(useDeploymentPickStore().bootDeployment).toBeNull()
    expect(mockWorkspaceApi.listDeployments).not.toHaveBeenCalled()
  })

  it.for([
    { pickSource: 'workspace_default' as const },
    { pickSource: 'browser' as const }
  ])(
    'waits with no hint and boots on the deployment the listing names: picked by $pickSource',
    async ({ pickSource }) => {
      mockWorkspaceApi.listDeployments.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(listingOn('dep-2', pickSource)), 50)
          )
      )
      const store = useDeploymentPickStore()

      const confirmed = settledAt(waitForDeploymentPick())
      await vi.advanceTimersByTimeAsync(0)
      expect(confirmed.value).toBeUndefined()
      await vi.advanceTimersByTimeAsync(50)

      expect(confirmed.value).toBe(true)
      expect(store.bootDeployment?.deployment_id).toBe('dep-2')
      expect(store.changeSinceBoot).toBeNull()
    }
  )

  it.for([
    {
      why: 'this browser last booted on a deployment',
      arrange: () => setDeploymentHint('ws-1', 'dep-1')
    },
    {
      why: 'this browser has no hint for the workspace',
      arrange: () => {}
    },
    {
      why: 'the page opened from a deployment link, after a boot on Comfy Cloud',
      arrange: () => {
        setDeploymentHint('ws-1', null)
        openedAt('/?workspace=ws-1&deployment=dep-1')
      }
    },
    {
      why: 'the page opened from a deployment link',
      arrange: () => openedAt('/?workspace=ws-1&deployment=dep-1')
    },
    {
      why: 'a deployment link was stashed across sign-in',
      arrange: () => {
        sessionStorage.setItem(
          'Comfy.PreservedQuery.deployment',
          JSON.stringify({ deployment: 'dep-1' })
        )
        onTestFinished(() =>
          clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.DEPLOYMENT)
        )
      }
    }
  ])(
    'waits for a failing listing and gives up when $why',
    async ({ arrange }) => {
      arrange()
      mockWorkspaceApi.listDeployments.mockRejectedValue(
        new WorkspaceApiError('Server error', 500)
      )

      const confirmed = settledAt(waitForDeploymentPick())
      await vi.advanceTimersByTimeAsync(0)
      expect(confirmed.value).toBeUndefined()
      await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_BACKSTOP_MS)

      expect(confirmed.value).toBe(false)
      expect(useDeploymentPickStore().bootDeployment).toBeNull()
    }
  )

  it("does not wait on another workspace's hint", async () => {
    setDeploymentHint('ws-1', null)
    setDeploymentHint('ws-other', 'dep-1')
    mockWorkspaceApi.listDeployments.mockReturnValue(new Promise(() => {}))

    const confirmed = settledAt(waitForDeploymentPick())
    await vi.advanceTimersByTimeAsync(0)

    expect(confirmed.value).toBe(true)
  })

  it('waits when localStorage throws, as with no hint', async () => {
    setDeploymentHint('ws-1', null)
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError')
      },
      setItem: () => {
        throw new DOMException('denied', 'SecurityError')
      }
    })
    mockWorkspaceApi.listDeployments.mockReturnValue(new Promise(() => {}))

    const confirmed = settledAt(waitForDeploymentPick())
    await vi.advanceTimersByTimeAsync(0)
    expect(confirmed.value).toBeUndefined()
    await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_BACKSTOP_MS)

    expect(confirmed.value).toBe(false)
  })
})
