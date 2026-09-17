import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { WorkspaceReleaseList } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'
import { useReleasePickStore } from '@/platform/workspace/stores/releasePickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import ReleaseSwitcher from './ReleaseSwitcher.vue'

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

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const listing: WorkspaceReleaseList = {
  builds_visible: true,
  releases: [
    {
      release_id: 'aaaaaaaa-0000-4000-8000-000000000002',
      build_id: 'b-1',
      build_name: 'Studio Build',
      version: 2,
      deployed: true,
      deployment_status: 'ready'
    },
    {
      release_id: 'aaaaaaaa-0000-4000-8000-000000000001',
      build_id: 'b-1',
      build_name: 'Studio Build',
      version: 1,
      deployed: false
    },
    {
      release_id: 'bbbbbbbb-0000-4000-8000-000000000009',
      deployed: true,
      deployment_status: 'stopped'
    }
  ]
}

function renderSwitcher() {
  return render(ReleaseSwitcher, {
    global: {
      plugins: [i18n]
    }
  })
}

describe('ReleaseSwitcher', () => {
  const reload = vi.fn()

  beforeEach(() => {
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    Object.defineProperty(window, 'location', {
      value: { reload, origin: 'http://localhost' },
      writable: true,
      configurable: true
    })
  })

  it('renders nothing when the account is outside the rollout', async () => {
    mockWorkspaceApi.listReleases.mockRejectedValue(
      new WorkspaceApiError('not enabled for this account yet', 403)
    )
    renderSwitcher()
    await waitFor(() =>
      expect(useReleasePickStore().state.phase).toBe('hidden')
    )
    expect(mockWorkspaceApi.listReleases).toHaveBeenCalledWith('ws-1')
    expect(screen.queryByTestId('release-switcher')).toBeNull()
  })

  it('says Comfy Cloud when nothing is picked, and lists the Releases', async () => {
    mockWorkspaceApi.listReleases.mockResolvedValue(listing)
    renderSwitcher()

    await waitFor(() =>
      expect(screen.getByTestId('release-switcher-current')).toHaveTextContent(
        'Comfy Cloud'
      )
    )
    await userEvent.click(screen.getByTestId('release-switcher-trigger'))

    const panel = screen.getByTestId('release-switcher-panel')
    expect(panel).toHaveTextContent('Studio Build v2')
    expect(panel).toHaveTextContent('Deployed, ready')
    expect(panel).toHaveTextContent('Studio Build v1')
    expect(panel).toHaveTextContent('Not deployed')
    expect(panel).toHaveTextContent('Release bbbbbbbb')
    expect(screen.getByTestId('release-row-cloud')).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(
      screen.getByTestId('release-row-aaaaaaaa-0000-4000-8000-000000000001')
    ).toBeDisabled()
  })

  it('shows the picked Release by name', async () => {
    mockWorkspaceApi.listReleases.mockResolvedValue({
      ...listing,
      picked_release_id: 'aaaaaaaa-0000-4000-8000-000000000002'
    })
    renderSwitcher()
    await waitFor(() =>
      expect(screen.getByTestId('release-switcher-current')).toHaveTextContent(
        'Studio Build v2'
      )
    )
  })

  it('picks a deployed Release, which reloads the editor', async () => {
    mockWorkspaceApi.listReleases.mockResolvedValue(listing)
    mockWorkspaceApi.pickRelease.mockResolvedValue(undefined)
    renderSwitcher()
    await userEvent.click(await screen.findByTestId('release-switcher-trigger'))

    await userEvent.click(
      screen.getByTestId('release-row-aaaaaaaa-0000-4000-8000-000000000002')
    )

    expect(mockWorkspaceApi.pickRelease).toHaveBeenCalledWith('ws-1', {
      release_id: 'aaaaaaaa-0000-4000-8000-000000000002'
    })
    await waitFor(() => expect(reload).toHaveBeenCalledOnce())
  })

  it('goes back to Comfy Cloud through the clear route', async () => {
    mockWorkspaceApi.listReleases.mockResolvedValue({
      ...listing,
      picked_release_id: 'aaaaaaaa-0000-4000-8000-000000000002'
    })
    mockWorkspaceApi.clearRelease.mockResolvedValue(undefined)
    renderSwitcher()
    await userEvent.click(await screen.findByTestId('release-switcher-trigger'))

    await userEvent.click(screen.getByTestId('release-row-cloud'))

    expect(mockWorkspaceApi.clearRelease).toHaveBeenCalledWith('ws-1')
    await waitFor(() => expect(reload).toHaveBeenCalledOnce())
  })

  it("shows the server's refusal as a toast and does not reload", async () => {
    mockWorkspaceApi.listReleases.mockResolvedValue(listing)
    mockWorkspaceApi.pickRelease.mockRejectedValue(
      new WorkspaceApiError('release has no deployment; deploy it first', 422)
    )
    renderSwitcher()
    await userEvent.click(await screen.findByTestId('release-switcher-trigger'))
    await userEvent.click(
      screen.getByTestId('release-row-aaaaaaaa-0000-4000-8000-000000000002')
    )

    await waitFor(() =>
      expect(useToastStore().messagesToAdd).toContainEqual(
        expect.objectContaining({
          severity: 'error',
          detail: 'release has no deployment; deploy it first'
        })
      )
    )
    expect(reload).not.toHaveBeenCalled()
    expect(screen.queryByTestId('release-switcher-panel')).toBeNull()
  })

  it('shows why the list is unavailable', async () => {
    mockWorkspaceApi.listReleases.mockRejectedValue(
      new WorkspaceApiError(
        'could not list releases from comfy-deploy; try again',
        503
      )
    )
    renderSwitcher()
    await userEvent.click(await screen.findByTestId('release-switcher-trigger'))
    expect(
      screen.getByTestId('release-switcher-unavailable')
    ).toHaveTextContent('could not list releases from comfy-deploy; try again')
  })
})
