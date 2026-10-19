import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { clearPreservedQuery } from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { reportError } from '@/platform/telemetry/reportError'
import { DEPLOYMENT_LISTING_BACKSTOP_MS } from '@/platform/workspace/api/deploymentListingTimeouts'
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
    'boots on Comfy Cloud at once, reporting but not waiting on $failure, without a hint',
    async ({ error }) => {
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

  it('boots on Comfy Cloud at once when the listing never answers, without a hint', async () => {
    mockWorkspaceApi.listDeployments.mockReturnValue(new Promise(() => {}))

    const confirmed = settledAt(waitForDeploymentPick())
    await vi.advanceTimersByTimeAsync(0)

    expect(confirmed.value).toBe(true)
    expect(useDeploymentPickStore().bootDeployment).toBeNull()
  })

  it.for([
    {
      why: 'this workspace has a hint',
      arrange: () => setDeploymentHint('ws-1', 'dep-1')
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
    setDeploymentHint('ws-other', 'dep-1')
    mockWorkspaceApi.listDeployments.mockReturnValue(new Promise(() => {}))

    const confirmed = settledAt(waitForDeploymentPick())
    await vi.advanceTimersByTimeAsync(0)

    expect(confirmed.value).toBe(true)
  })

  it('treats a throwing localStorage as no hint', async () => {
    setDeploymentHint('ws-1', 'dep-1')
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError')
      }
    })
    mockWorkspaceApi.listDeployments.mockReturnValue(new Promise(() => {}))

    const confirmed = settledAt(waitForDeploymentPick())
    await vi.advanceTimersByTimeAsync(0)

    expect(confirmed.value).toBe(true)
  })
})
