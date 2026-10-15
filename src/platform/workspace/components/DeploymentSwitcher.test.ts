import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { WorkspaceDeploymentList } from '@/platform/workspace/api/workspaceApi'

import enMessages from '@/locales/en/main.json'
import { useToast } from '@/components/ui/toast/toastStore'
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
const GONE = 'dep-0e0e0e0e-0000-4000-8000-0000000000a2'

const listing: WorkspaceDeploymentList = {
  builds_visible: true,
  items: [
    {
      deployment_id: D2,
      deployment_name: 'production',
      release_id: 'r-2',
      build_id: 'b-1',
      build_name: 'Studio Build',
      release_version: 2,
      status: 'ready',
      created_at: '2026-10-01T00:00:00Z'
    },
    {
      deployment_id: D1,
      deployment_name: 'staging',
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

function renderSwitcher(plugin = i18n) {
  const user = userEvent.setup({ pointerEventsCheck: 0 })
  render(DeploymentSwitcher, {
    props: { variant: 'tab' },
    global: { plugins: [plugin] }
  })
  return user
}

async function openList(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByTestId('deployment-switcher-trigger'))
  return screen.findByRole('menu')
}

async function openDefaultMenu(user: ReturnType<typeof userEvent.setup>) {
  const defaultMenu = await screen.findByTestId('deployment-switcher-default')
  defaultMenu.focus()
  await user.keyboard('{ArrowRight}')
  return screen.findByTestId('default-row-cloud')
}

function asOwner() {
  Object.assign(useTeamWorkspaceStore(), {
    workspaceId: 'ws-1',
    activeWorkspace: { id: 'ws-1', role: 'owner' }
  })
}

describe('DeploymentSwitcher', () => {
  const reload = vi.fn()

  beforeEach(() => {
    sessionStorage.clear()
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    Object.defineProperty(window, 'location', {
      value: { reload, origin: 'http://localhost' },
      writable: true,
      configurable: true
    })
  })

  it('names the Build on the pill, and the Build then each deployment in the list, as plain text', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D2,
      items: [
        {
          ...listing.items[0],
          deployment_name: "Studio's <b>production</b> & R&D"
        },
        listing.items[1]
      ]
    })
    const user = renderSwitcher()

    expect(
      await screen.findByTestId('deployment-switcher-current')
    ).toHaveTextContent(/^Studio Build$/)
    await openList(user)
    const production = screen.getByTestId(`deployment-row-${D2}`)
    expect(production).toHaveTextContent('Studio Build')
    expect(
      within(production).getByText("Studio's <b>production</b> & R&D")
    ).toBeVisible()
    expect(screen.getByTestId(`deployment-row-${D1}`)).toHaveTextContent(
      'Studio Buildstaging'
    )
  })

  it.for([
    { row: D2, meta: 'v2' },
    { row: D1, meta: 'Stopped' },
    { row: D9, meta: 'Stopped' }
  ])(
    'shows $meta on the right of a row: the status unless ready, else the Release version',
    async ({ row, meta }) => {
      mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
      const user = renderSwitcher()
      await openList(user)
      expect(screen.getByTestId(`deployment-row-${row}`)).toHaveTextContent(
        new RegExp(`${meta}$`)
      )
    }
  )

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

  it('says Comfy Cloud when nothing is picked, and lists every deployment as pickable', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    const user = renderSwitcher()

    expect(
      await screen.findByTestId('deployment-switcher-current')
    ).toHaveTextContent('Comfy Cloud')
    await openList(user)

    expect(screen.getByTestId('deployment-row-cloud')).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByTestId(`deployment-row-${D9}`)).toHaveTextContent(
      'Deployment dep-b9b9b9b9'
    )
    expect(screen.getByTestId(`deployment-row-${D1}`)).not.toHaveAttribute(
      'aria-disabled',
      'true'
    )
    expect(screen.queryByTestId('deployment-row-follow')).toBeNull()
    expect(screen.queryByTestId('deployment-switcher-default')).toBeNull()
  })

  it('refreshes the listing each time the list opens', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    const user = renderSwitcher()
    await openList(user)
    await waitFor(() =>
      expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledTimes(2)
    )
  })

  it('links to the Developer Platform to create a custom deployment, in a new tab', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    const user = renderSwitcher()
    await openList(user)

    const create = screen.getByTestId('deployment-switcher-create')
    expect(create).toHaveTextContent('Create a custom deployment')
    expect(create).toHaveAttribute('href', expect.stringMatching(/\/deploy$/))
    expect(create).toHaveAttribute('target', '_blank')
  })

  it('says a workspace with no deployments has none yet, and still offers to create one', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      items: []
    })
    const user = renderSwitcher()
    await openList(user)

    expect(screen.getByTestId('deployment-switcher-empty')).toHaveTextContent(
      'This workspace has no deployments yet.'
    )
    expect(screen.getByTestId('deployment-switcher-create')).toBeVisible()
    expect(screen.queryByText(/Switching reloads the editor/)).toBeNull()
  })

  const pickGone = 'The deployment you picked no longer exists.'
  const defaultGoneOwner =
    'The workspace default was deleted, so members start on Comfy Cloud. Choose a new one under Workspace default.'

  it.for([
    {
      gone: 'its own pick, with no default',
      reply: { gone_picked_deployment_id: GONE },
      line: pickGone
    },
    {
      gone: 'its own pick, with a live default',
      reply: {
        pick_source: 'browser',
        default_deployment_id: D1,
        gone_picked_deployment_id: GONE
      },
      line: pickGone
    },
    {
      gone: 'the default it follows',
      reply: { gone_default_deployment_id: GONE },
      line: defaultGoneOwner
    }
  ] satisfies {
    gone: string
    reply: Partial<WorkspaceDeploymentList>
    line: string
  }[])(
    'says Comfy Cloud when $gone is gone, and says why in the list',
    async ({ reply, line }) => {
      asOwner()
      mockWorkspaceApi.listDeployments.mockResolvedValue({
        ...listing,
        ...reply
      })
      const user = renderSwitcher()

      expect(
        await screen.findByTestId('deployment-switcher-current')
      ).toHaveTextContent('Comfy Cloud')
      await openList(user)
      expect(
        screen.getByTestId('deployment-switcher-notice')
      ).toHaveTextContent(line)
      expect(screen.getByTestId('deployment-row-cloud')).toHaveAttribute(
        'aria-checked',
        'true'
      )
    }
  )

  it('tells an owner with a pick of its own that the default is deleted only where the default is chosen', async () => {
    asOwner()
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D2,
      pick_source: 'browser',
      gone_default_deployment_id: GONE
    })
    const user = renderSwitcher()
    await openList(user)

    expect(screen.queryByTestId('deployment-switcher-notice')).toBeNull()
    expect(
      screen.getByTestId('deployment-switcher-default-current')
    ).toHaveTextContent('Deleted')
  })

  it.for([
    {
      change: 'its deployment now runs another Release',
      boot: { ...listing, picked_deployment_id: D2, pick_source: 'browser' },
      next: {
        ...listing,
        picked_deployment_id: D2,
        pick_source: 'browser',
        items: [
          { ...listing.items[0], release_id: 'r-3', release_version: 3 },
          ...listing.items.slice(1)
        ]
      },
      text: 'This deployment now runs a different Release. Reload to get its nodes.'
    },
    {
      change: 'the workspace default it follows was cleared',
      boot: {
        ...listing,
        picked_deployment_id: D2,
        pick_source: 'workspace_default',
        default_deployment_id: D2
      },
      next: listing,
      text: 'This browser now runs on Comfy Cloud. Reload to get its nodes.'
    }
  ] satisfies {
    change: string
    boot: WorkspaceDeploymentList
    next: WorkspaceDeploymentList
    text: string
  }[])(
    'offers a reload when $change since the page loaded',
    async ({ boot, next, text }) => {
      mockWorkspaceApi.listDeployments
        .mockResolvedValueOnce(boot)
        .mockResolvedValue(next)
      const user = renderSwitcher()
      await screen.findByTestId('deployment-switcher-trigger')

      await openList(user)

      expect(
        await screen.findByTestId('deployment-switcher-changed')
      ).toHaveTextContent(text)
      await user.click(screen.getByTestId('deployment-switcher-reload'))
      expect(reload).toHaveBeenCalledOnce()
    }
  )

  it('picks a deployment, shows it switching, and reloads the editor', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    let answer: () => void = () => {}
    mockWorkspaceApi.pickDeployment.mockReturnValue(
      new Promise<void>((resolve) => {
        answer = resolve
      })
    )
    const user = renderSwitcher()
    await openList(user)

    await user.click(screen.getByTestId(`deployment-row-${D2}`))

    expect(mockWorkspaceApi.pickDeployment).toHaveBeenCalledWith('ws-1', {
      deployment_id: D2
    })
    expect(screen.getByTestId(`deployment-row-${D2}`)).toHaveTextContent(
      'Switching'
    )
    expect(screen.getByTestId('deployment-row-cloud')).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    expect(screen.getByTestId('deployment-switcher-trigger')).toBeDisabled()
    answer()
    await waitFor(() => expect(reload).toHaveBeenCalledOnce())
  })

  it('goes back to Comfy Cloud through the clear route', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D2
    })
    mockWorkspaceApi.clearDeployment.mockResolvedValue(undefined)
    const user = renderSwitcher()
    await openList(user)

    await user.click(screen.getByTestId('deployment-row-cloud'))

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

  it("shows the server's refusal as a toast, does not reload, and lets the user pick again", async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    mockWorkspaceApi.pickDeployment.mockRejectedValue(
      new WorkspaceApiError("deployment is not one of this workspace's", 422)
    )
    const user = renderSwitcher()
    await openList(user)
    await user.click(screen.getByTestId(`deployment-row-${D2}`))

    await waitFor(() =>
      expect(useToast().toasts).toContainEqual(
        expect.objectContaining({
          kind: 'error',
          description: "deployment is not one of this workspace's"
        })
      )
    )
    expect(reload).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(screen.getByTestId('deployment-switcher-trigger')).toBeEnabled()
  })

  it('tags the default deployment for a browser that follows it, and offers no way back', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D2,
      pick_source: 'workspace_default',
      default_deployment_id: D2
    })
    const user = renderSwitcher()
    await openList(user)

    const production = screen.getByTestId(`deployment-row-${D2}`)
    expect(production).toHaveAttribute('aria-checked', 'true')
    expect(production).toHaveTextContent('Default')
    expect(screen.getByTestId(`deployment-row-${D1}`)).not.toHaveTextContent(
      'Default'
    )
    expect(screen.queryByTestId('deployment-row-follow')).toBeNull()
    expect(screen.queryByTestId('deployment-switcher-default')).toBeNull()
  })

  it('offers a browser with its own pick the workspace default, which clears with follow=workspace', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      pick_source: 'browser',
      default_deployment_id: D2
    })
    mockWorkspaceApi.clearDeployment.mockResolvedValue(undefined)
    const user = renderSwitcher()
    await openList(user)

    const follow = screen.getByTestId('deployment-row-follow')
    expect(follow).toHaveTextContent('Use the workspace default')
    expect(follow).toHaveTextContent('production')
    await user.click(follow)

    expect(mockWorkspaceApi.clearDeployment).toHaveBeenCalledWith('ws-1', {
      follow: 'workspace'
    })
    await waitFor(() => expect(reload).toHaveBeenCalledOnce())
  })

  it('offers no way back to a workspace default when there is none', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D2,
      pick_source: 'browser'
    })
    const user = renderSwitcher()
    await openList(user)
    expect(screen.getByTestId(`deployment-row-${D2}`)).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.queryByTestId('deployment-row-follow')).toBeNull()
  })

  it('lets an owner make any deployment the workspace default without switching to it', async () => {
    asOwner()
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D2,
      pick_source: 'browser'
    })
    mockWorkspaceApi.setDefaultDeployment.mockResolvedValue(undefined)
    const user = renderSwitcher()
    await openList(user)
    expect(
      screen.getByTestId('deployment-switcher-default-current')
    ).toHaveTextContent('Comfy Cloud')
    await openDefaultMenu(user)
    expect(screen.getByTestId('default-row-cloud')).toHaveAttribute(
      'aria-checked',
      'true'
    )

    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D2,
      pick_source: 'browser',
      default_deployment_id: D1
    })
    await user.click(screen.getByTestId(`default-row-${D1}`))

    expect(mockWorkspaceApi.setDefaultDeployment).toHaveBeenCalledWith('ws-1', {
      deployment_id: D1
    })
    expect(mockWorkspaceApi.pickDeployment).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(useDeploymentPickStore().defaultDeploymentId).toBe(D1)
    )
    expect(reload).not.toHaveBeenCalled()
    await openList(user)
    expect(
      screen.getByTestId('deployment-switcher-default-current')
    ).toHaveTextContent('staging')
    expect(screen.getByTestId(`deployment-row-${D1}`)).toHaveTextContent(
      'Default'
    )
  })

  it('lets an owner clear the workspace default, a deleted one included, by choosing Comfy Cloud', async () => {
    asOwner()
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D2,
      pick_source: 'browser',
      gone_default_deployment_id: GONE
    })
    mockWorkspaceApi.clearDefaultDeployment.mockResolvedValue(undefined)
    const user = renderSwitcher()
    await openList(user)
    await openDefaultMenu(user)

    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D2,
      pick_source: 'browser'
    })
    await user.click(screen.getByTestId('default-row-cloud'))

    expect(mockWorkspaceApi.clearDefaultDeployment).toHaveBeenCalledWith('ws-1')
    await waitFor(() =>
      expect(useDeploymentPickStore().goneDefaultDeploymentId).toBeNull()
    )
    expect(reload).not.toHaveBeenCalled()
  })

  it('disables the pill while a default is being set', async () => {
    asOwner()
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D2,
      pick_source: 'browser',
      default_deployment_id: D1
    })
    mockWorkspaceApi.setDefaultDeployment.mockReturnValue(new Promise(() => {}))
    const user = renderSwitcher()
    await openList(user)
    await openDefaultMenu(user)

    await user.click(screen.getByTestId(`default-row-${D2}`))

    expect(screen.getByTestId('deployment-switcher-trigger')).toBeDisabled()
  })

  it('tags the new default even when the refresh after it fails', async () => {
    asOwner()
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D2,
      pick_source: 'browser',
      default_deployment_id: D1
    })
    mockWorkspaceApi.setDefaultDeployment.mockResolvedValue(undefined)
    const user = renderSwitcher()
    await openList(user)
    await openDefaultMenu(user)

    mockWorkspaceApi.listDeployments.mockRejectedValue(
      new WorkspaceApiError('Network Error')
    )
    await user.click(screen.getByTestId(`default-row-${D2}`))
    await waitFor(() =>
      expect(useDeploymentPickStore().defaultDeploymentId).toBe(D2)
    )

    await openList(user)
    expect(screen.getByTestId(`deployment-row-${D2}`)).toHaveTextContent(
      'Default'
    )
    expect(screen.getByTestId(`deployment-row-${D1}`)).not.toHaveTextContent(
      'Default'
    )
    expect(useToast().toasts).toEqual([])
    expect(reload).not.toHaveBeenCalled()
  })

  it('shows a member the workspace default but no way to change it', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D2,
      pick_source: 'browser',
      default_deployment_id: D9
    })
    const user = renderSwitcher()
    await openList(user)
    expect(screen.queryByTestId('deployment-switcher-default')).toBeNull()
    expect(screen.getByTestId('deployment-row-follow')).toHaveTextContent(
      'Deployment dep-b9b9b9b9'
    )
  })

  describe('with the app i18n, which escapes message parameters', () => {
    const escapingI18n = createI18n({
      legacy: false,
      locale: 'en',
      escapeParameter: true,
      messages: { en: enMessages }
    })
    const oddlyNamed: WorkspaceDeploymentList = {
      ...listing,
      items: listing.items.map((item) => ({
        ...item,
        build_name: item.build_name && "Vinh's R&D/Prod",
        deployment_name: item.deployment_name && `${item.deployment_name} & co`
      }))
    }

    it("shows names with ', & and / as written on the pill, the rows, the follow item and the owner's default", async () => {
      asOwner()
      mockWorkspaceApi.listDeployments.mockResolvedValue({
        ...oddlyNamed,
        picked_deployment_id: D2,
        pick_source: 'browser',
        default_deployment_id: D1
      })
      const user = renderSwitcher(escapingI18n)

      expect(
        await screen.findByTestId('deployment-switcher-current')
      ).toHaveTextContent("Vinh's R&D/Prod")
      expect(screen.getByTestId('deployment-switcher-trigger')).toHaveAttribute(
        'aria-label',
        "Running on Vinh's R&D/Prod · production & co. Choose where this editor runs"
      )
      await openList(user)
      expect(screen.getByTestId(`deployment-row-${D1}`)).toHaveTextContent(
        "Vinh's R&D/Prodstaging & co"
      )
      expect(screen.getByTestId('deployment-row-follow')).toHaveTextContent(
        'staging & co'
      )
      expect(
        screen.getByTestId('deployment-switcher-default-current')
      ).toHaveTextContent('staging & co')
    })

    it("shows names with ', & and / as written in the reload notice", async () => {
      mockWorkspaceApi.listDeployments
        .mockResolvedValueOnce({
          ...oddlyNamed,
          picked_deployment_id: D2,
          pick_source: 'workspace_default',
          default_deployment_id: D2
        })
        .mockResolvedValue({
          ...oddlyNamed,
          picked_deployment_id: D1,
          pick_source: 'workspace_default',
          default_deployment_id: D1
        })
      const user = renderSwitcher(escapingI18n)
      await openList(user)

      expect(
        await screen.findByTestId('deployment-switcher-changed')
      ).toHaveTextContent(
        "This browser now runs on Vinh's R&D/Prod · staging & co. Reload to get its nodes."
      )
    })
  })
})
