import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { WorkspaceDeploymentList } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import DeploymentSwitcher from './DeploymentSwitcher.vue'

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

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const D2 = 'dep-a2a2a2a2-0000-4000-8000-000000000002'
const D1 = 'dep-a1a1a1a1-0000-4000-8000-000000000001'
const D9 = 'dep-b9b9b9b9-0000-4000-8000-000000000009'

const listing: WorkspaceDeploymentList = {
  builds_visible: true,
  items: [
    {
      deployment_id: D2,
      release_id: 'r-2',
      build_id: 'b-1',
      build_name: 'Studio Build',
      release_version: 2,
      status: 'ready',
      created_at: '2026-10-01T00:00:00Z'
    },
    {
      deployment_id: D1,
      release_id: 'r-1',
      build_id: 'b-1',
      build_name: 'Studio Build',
      release_version: 1,
      status: 'stopped',
      created_at: '2026-09-20T00:00:00Z'
    },
    {
      deployment_id: D9,
      release_id: 'r-9',
      status: 'stopped',
      created_at: '2026-09-10T00:00:00Z'
    }
  ]
}

function renderSwitcher() {
  return render(DeploymentSwitcher, {
    global: {
      plugins: [i18n]
    }
  })
}

describe('DeploymentSwitcher', () => {
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
    mockWorkspaceApi.listDeployments.mockRejectedValue(
      new WorkspaceApiError('not enabled for this account yet', 403)
    )
    renderSwitcher()
    await waitFor(() =>
      expect(useDeploymentPickStore().state.phase).toBe('hidden')
    )
    expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledWith('ws-1')
    expect(screen.queryByTestId('deployment-switcher')).toBeNull()
  })

  it('says Comfy Cloud when nothing is picked, and lists the deployments', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    renderSwitcher()

    await waitFor(() =>
      expect(
        screen.getByTestId('deployment-switcher-current')
      ).toHaveTextContent('Comfy Cloud')
    )
    await userEvent.click(screen.getByTestId('deployment-switcher-trigger'))

    const panel = screen.getByTestId('deployment-switcher-panel')
    expect(panel).toHaveTextContent('Studio Build v2')
    expect(panel).toHaveTextContent('dep-a2a2a2a2, ready')
    expect(panel).toHaveTextContent('Studio Build v1')
    expect(panel).toHaveTextContent('dep-a1a1a1a1, stopped')
    expect(panel).toHaveTextContent('Deployment dep-b9b9b9b9')
    expect(screen.getByTestId('deployment-row-cloud')).toHaveAttribute(
      'aria-checked',
      'true'
    )
    // A stopped deployment can still be picked; a job submitted to it is
    // refused until it is ready.
    expect(screen.getByTestId(`deployment-row-${D1}`)).not.toBeDisabled()
    // Comfy Cloud with no workspace default: nothing to say it follows.
    expect(screen.queryByTestId('deployment-switcher-following')).toBeNull()
    expect(screen.queryByTestId('deployment-row-follow')).toBeNull()
  })

  it('shows the picked deployment by its Build and Release', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D2
    })
    renderSwitcher()
    await waitFor(() =>
      expect(
        screen.getByTestId('deployment-switcher-current')
      ).toHaveTextContent('Studio Build v2')
    )
  })

  it('picks a deployment, which reloads the editor', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    mockWorkspaceApi.pickDeployment.mockResolvedValue(undefined)
    renderSwitcher()
    await userEvent.click(
      await screen.findByTestId('deployment-switcher-trigger')
    )

    await userEvent.click(screen.getByTestId(`deployment-row-${D2}`))

    expect(mockWorkspaceApi.pickDeployment).toHaveBeenCalledWith('ws-1', {
      deployment_id: D2
    })
    await waitFor(() => expect(reload).toHaveBeenCalledOnce())
  })

  it('goes back to Comfy Cloud through the clear route', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D2
    })
    mockWorkspaceApi.clearDeployment.mockResolvedValue(undefined)
    renderSwitcher()
    await userEvent.click(
      await screen.findByTestId('deployment-switcher-trigger')
    )

    await userEvent.click(screen.getByTestId('deployment-row-cloud'))

    expect(mockWorkspaceApi.clearDeployment).toHaveBeenCalledWith('ws-1')
    await waitFor(() => expect(reload).toHaveBeenCalledOnce())
  })

  it('renders nothing until the listing answers', async () => {
    let resolve: (value: WorkspaceDeploymentList) => void = () => {}
    mockWorkspaceApi.listDeployments.mockReturnValue(
      new Promise<WorkspaceDeploymentList>((r) => {
        resolve = r
      })
    )
    renderSwitcher()
    await nextTick()
    expect(screen.queryByTestId('deployment-switcher')).toBeNull()

    resolve(listing)
    expect(
      await screen.findByTestId('deployment-switcher-current')
    ).toHaveTextContent('Comfy Cloud')
  })

  it('renders nothing when the listing fails', async () => {
    mockWorkspaceApi.listDeployments.mockRejectedValue(
      new WorkspaceApiError('404 page not found', 404)
    )
    renderSwitcher()
    await waitFor(() =>
      expect(useDeploymentPickStore().state.phase).toBe('hidden')
    )
    expect(screen.queryByTestId('deployment-switcher')).toBeNull()
  })

  it('disables the trigger while a pick is in flight', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    mockWorkspaceApi.pickDeployment.mockReturnValue(new Promise(() => {}))
    renderSwitcher()
    const trigger = await screen.findByTestId('deployment-switcher-trigger')
    await userEvent.click(trigger)
    expect(trigger).not.toBeDisabled()

    await userEvent.click(screen.getByTestId(`deployment-row-${D2}`))
    expect(trigger).toBeDisabled()
  })

  it("shows the server's refusal as a toast, does not reload, and lets the user pick again", async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    mockWorkspaceApi.pickDeployment.mockRejectedValue(
      new WorkspaceApiError("deployment is not one of this workspace's", 422)
    )
    renderSwitcher()
    const trigger = await screen.findByTestId('deployment-switcher-trigger')
    await userEvent.click(trigger)
    await userEvent.click(screen.getByTestId(`deployment-row-${D2}`))

    await waitFor(() =>
      expect(useToastStore().messagesToAdd).toContainEqual(
        expect.objectContaining({
          severity: 'error',
          detail: "deployment is not one of this workspace's"
        })
      )
    )
    expect(reload).not.toHaveBeenCalled()
    expect(screen.queryByTestId('deployment-switcher-panel')).toBeNull()
    expect(trigger).not.toBeDisabled()
  })

  it('says it follows the workspace default, and marks that deployment in the list', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D2,
      pick_source: 'workspace_default',
      default_deployment_id: D2
    })
    renderSwitcher()
    await waitFor(() =>
      expect(
        screen.getByTestId('deployment-switcher-current')
      ).toHaveTextContent('Studio Build v2')
    )
    expect(
      screen.getByTestId('deployment-switcher-following')
    ).toHaveTextContent('Workspace default')
    await userEvent.click(screen.getByTestId('deployment-switcher-trigger'))
    expect(screen.getByTestId(`deployment-row-${D2}`)).toHaveTextContent(
      'Workspace default'
    )
    expect(screen.queryByTestId('deployment-row-follow')).toBeNull()
    expect(screen.queryByTestId('deployment-switcher-owner')).toBeNull()
  })

  it('offers a browser with its own pick the workspace default, which clears with follow=workspace', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      pick_source: 'browser',
      default_deployment_id: D2
    })
    mockWorkspaceApi.clearDeployment.mockResolvedValue(undefined)
    renderSwitcher()
    await userEvent.click(
      await screen.findByTestId('deployment-switcher-trigger')
    )
    expect(screen.queryByTestId('deployment-switcher-following')).toBeNull()

    const follow = screen.getByTestId('deployment-row-follow')
    expect(follow).toHaveTextContent('Studio Build v2')
    await userEvent.click(follow)

    expect(mockWorkspaceApi.clearDeployment).toHaveBeenCalledWith('ws-1', {
      follow: 'workspace'
    })
    await waitFor(() => expect(reload).toHaveBeenCalledOnce())
  })

  it('lets an owner set the picked deployment as the workspace default, and clear it', async () => {
    Object.assign(useTeamWorkspaceStore(), {
      workspaceId: 'ws-1',
      activeWorkspace: { id: 'ws-1', role: 'owner' }
    })
    mockWorkspaceApi.listDeployments
      .mockResolvedValueOnce({
        ...listing,
        picked_deployment_id: D2,
        pick_source: 'browser'
      })
      .mockResolvedValue({
        ...listing,
        picked_deployment_id: D2,
        pick_source: 'browser',
        default_deployment_id: D2
      })
    mockWorkspaceApi.setDefaultDeployment.mockResolvedValue(undefined)
    mockWorkspaceApi.clearDefaultDeployment.mockResolvedValue(undefined)
    renderSwitcher()
    await userEvent.click(
      await screen.findByTestId('deployment-switcher-trigger')
    )

    const owner = screen.getByTestId('deployment-switcher-owner')
    expect(owner).toHaveTextContent('No workspace default')
    expect(screen.queryByTestId('deployment-switcher-clear-default')).toBeNull()
    await userEvent.click(screen.getByTestId('deployment-switcher-set-default'))

    expect(mockWorkspaceApi.setDefaultDeployment).toHaveBeenCalledWith('ws-1', {
      deployment_id: D2
    })
    await waitFor(() =>
      expect(owner).toHaveTextContent('Workspace default: Studio Build v2')
    )
    expect(reload).not.toHaveBeenCalled()
    expect(screen.queryByTestId('deployment-switcher-set-default')).toBeNull()

    await userEvent.click(
      screen.getByTestId('deployment-switcher-clear-default')
    )
    expect(mockWorkspaceApi.clearDefaultDeployment).toHaveBeenCalledWith('ws-1')
  })

  it("disables the trigger and the owner's buttons while a default is being set", async () => {
    Object.assign(useTeamWorkspaceStore(), {
      workspaceId: 'ws-1',
      activeWorkspace: { id: 'ws-1', role: 'owner' }
    })
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D2,
      pick_source: 'browser',
      default_deployment_id: D1
    })
    mockWorkspaceApi.setDefaultDeployment.mockReturnValue(new Promise(() => {}))
    renderSwitcher()
    const trigger = await screen.findByTestId('deployment-switcher-trigger')
    await userEvent.click(trigger)
    const setDefault = screen.getByTestId('deployment-switcher-set-default')
    const clearDefault = screen.getByTestId('deployment-switcher-clear-default')
    expect(setDefault).not.toBeDisabled()
    expect(clearDefault).not.toBeDisabled()

    await userEvent.click(setDefault)

    expect(trigger).toBeDisabled()
    expect(setDefault).toBeDisabled()
    expect(clearDefault).toBeDisabled()
  })

  it('shows the new default in the footer and the list even when the refresh after it fails', async () => {
    Object.assign(useTeamWorkspaceStore(), {
      workspaceId: 'ws-1',
      activeWorkspace: { id: 'ws-1', role: 'owner' }
    })
    mockWorkspaceApi.listDeployments
      .mockResolvedValueOnce({
        ...listing,
        picked_deployment_id: D2,
        pick_source: 'browser',
        default_deployment_id: D1
      })
      .mockRejectedValue(new WorkspaceApiError('Network Error'))
    mockWorkspaceApi.setDefaultDeployment.mockResolvedValue(undefined)
    renderSwitcher()
    await userEvent.click(
      await screen.findByTestId('deployment-switcher-trigger')
    )
    const owner = screen.getByTestId('deployment-switcher-owner')
    expect(owner).toHaveTextContent('Workspace default: Studio Build v1')

    await userEvent.click(screen.getByTestId('deployment-switcher-set-default'))

    await waitFor(() =>
      expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledTimes(2)
    )
    await waitFor(() =>
      expect(owner).toHaveTextContent('Workspace default: Studio Build v2')
    )
    expect(screen.getByTestId(`deployment-row-${D2}`)).toHaveTextContent(
      'Workspace default'
    )
    expect(screen.getByTestId(`deployment-row-${D1}`)).not.toHaveTextContent(
      'Workspace default'
    )
    expect(useToastStore().messagesToAdd).toEqual([])
    expect(reload).not.toHaveBeenCalled()
  })

  it('offers no way back to a workspace default when there is none', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D2,
      pick_source: 'browser'
    })
    renderSwitcher()
    await userEvent.click(
      await screen.findByTestId('deployment-switcher-trigger')
    )
    expect(screen.getByTestId(`deployment-row-${D2}`)).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.queryByTestId('deployment-row-follow')).toBeNull()
  })

  it('shows a member the workspace default but no way to change it', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D2,
      pick_source: 'browser',
      default_deployment_id: D9
    })
    renderSwitcher()
    await userEvent.click(
      await screen.findByTestId('deployment-switcher-trigger')
    )
    expect(screen.queryByTestId('deployment-switcher-owner')).toBeNull()
    expect(screen.getByTestId('deployment-row-follow')).toHaveTextContent(
      'Deployment dep-b9b9b9b9'
    )
  })
})
