import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import type { WorkspaceDeploymentList } from '@/platform/workspace/api/workspaceApi'

import enMessages from '@/locales/en/main.json'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useToast } from '@/components/ui/toast/toastStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { createTestRootGraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { takeLeavePromptSkip } from '@/platform/workflow/management/leavePrompt'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { DEPLOYMENT_LISTING_BACKSTOP_MS } from '@/platform/workspace/api/deploymentListingTimeouts'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogService } from '@/services/dialogService'

import DeploymentSwitcher from './DeploymentSwitcher.vue'

const mockWorkspaceApi = vi.hoisted(() => ({
  listDeployments: vi.fn(),
  pickDeployment: vi.fn(),
  clearDeployment: vi.fn(),
  setDefaultDeployment: vi.fn(),
  clearDefaultDeployment: vi.fn(),
  checkDeploymentCompatibility: vi.fn()
}))

const hoisted = vi.hoisted(() => ({
  rootGraph: undefined as unknown
}))

vi.mock(import('@/composables/useFeatureFlags'))

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    get rootGraph() {
      return hoisted.rootGraph
    },
    get isGraphReady() {
      return hoisted.rootGraph !== undefined
    }
  }
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

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/services/dialogService'))
vi.mock(import('@/platform/workflow/core/services/workflowService'))

const distribution = vi.hoisted(() => ({ isCloud: true }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  },
  isDesktop: false,
  isNightly: false
}))

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

function workflowWith(...types: string[]): LGraph {
  const graph = createTestRootGraph()
  for (const type of types) graph.add(new LGraphNode(type, type))
  return graph
}

function renderSwitcher(plugin = i18n) {
  const user = userEvent.setup({ pointerEventsCheck: 0 })
  render(DeploymentSwitcher, {
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

async function focusWindowEvery(ms: number, times: number) {
  for (let focus = 0; focus < times; focus++) {
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(ms)
  }
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
    hoisted.rootGraph = undefined
    sessionStorage.clear()
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    Object.defineProperty(window, 'location', {
      value: { reload, origin: 'http://localhost' },
      writable: true,
      configurable: true
    })
  })

  it('names the Build then the deployment, as plain text, on the button and in the list', async () => {
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
      await screen.findByTestId('deployment-switcher-trigger')
    ).toHaveAccessibleName(
      "Running on Studio Build · Studio's <b>production</b> & R&D. Choose where this editor runs"
    )
    await openList(user)
    const production = screen.getByTestId(`deployment-row-${D2}`)
    expect(production).toHaveTextContent('Studio Build')
    expect(
      within(production).getByText("Studio's <b>production</b> & R&D · v2")
    ).toBeVisible()
    expect(screen.getByTestId(`deployment-row-${D1}`)).toHaveTextContent(
      'Studio Buildstaging'
    )
  })

  it.for([
    { row: D2, ends: 'production · v2' },
    { row: D1, ends: 'staging · v1Stopped' },
    { row: D9, ends: 'Deployment dep-b9b9b9b9Stopped' }
  ])(
    'puts the Release version after the deployment name and the status on the right unless ready: $ends',
    async ({ row, ends }) => {
      mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
      const user = renderSwitcher()
      await openList(user)
      expect(screen.getByTestId(`deployment-row-${row}`)).toHaveTextContent(
        new RegExp(`${ends}$`)
      )
    }
  )

  it.for([
    {
      status: 'ready',
      text: 'Running on Studio Build · production',
      name: 'Running on Studio Build · production. Choose where this editor runs'
    },
    {
      status: 'stopped',
      text: "Running on Studio Build · production. It's stopped, so jobs won't run until it's started on the Developer Platform.",
      name: "Running on Studio Build · production. It's stopped, so jobs won't run until it's started on the Developer Platform. Choose where this editor runs"
    },
    {
      status: 'failed',
      text: "Running on Studio Build · production. It isn't ready, so jobs won't run until it is.",
      name: "Running on Studio Build · production. It isn't ready, so jobs won't run until it is. Choose where this editor runs"
    },
    {
      status: 'starting',
      text: "Running on Studio Build · production. It isn't ready, so jobs won't run until it is.",
      name: "Running on Studio Build · production. It isn't ready, so jobs won't run until it is. Choose where this editor runs"
    }
  ])(
    'names the Build, deployment and any status on hover and to assistive tech, $status',
    async ({ status, text, name }) => {
      mockWorkspaceApi.listDeployments.mockResolvedValue({
        ...listing,
        picked_deployment_id: D2,
        items: [{ ...listing.items[0], status }, ...listing.items.slice(1)]
      })
      const user = renderSwitcher()
      const trigger = await screen.findByTestId('deployment-switcher-trigger')

      await user.hover(trigger)

      expect(await screen.findByRole('tooltip')).toHaveTextContent(text)
      expect(trigger).toHaveAccessibleName(name)
    }
  )

  it.for([
    { session: 'a local build', cloud: false, apiKey: false },
    { session: 'a Cloud API key', cloud: true, apiKey: true }
  ])(
    'renders nothing and lists nothing for $session',
    async ({ cloud, apiKey }) => {
      distribution.isCloud = cloud
      onTestFinished(() => {
        distribution.isCloud = true
      })
      Object.assign(useCurrentUser(), {
        isApiKeyLogin: computed(() => apiKey)
      })
      mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
      renderSwitcher()
      await nextTick()

      expect(mockWorkspaceApi.listDeployments).not.toHaveBeenCalled()
      expect(screen.queryByTestId('deployment-switcher')).toBeNull()
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
      await screen.findByTestId('deployment-switcher-trigger')
    ).toHaveAccessibleName(
      'Running on Comfy Cloud. Choose where this editor runs'
    )
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
    expect(create).toHaveAttribute(
      'href',
      expect.stringMatching(/\/profile\/deploy#builds$/)
    )
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
        await screen.findByTestId('deployment-switcher-trigger')
      ).toHaveAccessibleName(
        'Running on Comfy Cloud. Choose where this editor runs'
      )
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
      await waitFor(() => expect(reload).toHaveBeenCalledOnce())
    }
  )

  it('disables the Reload item while a switch is in flight', async () => {
    const boot = {
      ...listing,
      picked_deployment_id: D2,
      pick_source: 'browser'
    }
    mockWorkspaceApi.listDeployments
      .mockResolvedValueOnce(boot)
      .mockResolvedValue({
        ...boot,
        items: [
          { ...listing.items[0], release_id: 'r-3', release_version: 3 },
          ...listing.items.slice(1)
        ]
      })
    mockWorkspaceApi.pickDeployment.mockReturnValue(new Promise<void>(() => {}))
    const user = renderSwitcher()
    await screen.findByTestId('deployment-switcher-trigger')
    await openList(user)
    const reloadItem = await screen.findByTestId('deployment-switcher-reload')

    await user.click(screen.getByTestId(`deployment-row-${D1}`))

    await waitFor(() =>
      expect(reloadItem).toHaveAttribute('aria-disabled', 'true')
    )
  })

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
      await screen.findByTestId('deployment-switcher-trigger')
    ).toHaveAccessibleName(
      'Running on Comfy Cloud. Choose where this editor runs'
    )
  })

  it.for([
    {
      answer: 'no signed-in user',
      error: new Error('User not authenticated'),
      retries: true
    },
    {
      answer: 'a 403, outside the rollout',
      error: new WorkspaceApiError('not enabled', 403),
      retries: false
    },
    {
      answer: 'a 404, an ingest without these routes',
      error: new WorkspaceApiError('404 page not found', 404),
      retries: false
    }
  ])(
    'after $answer at first, asks again when the window regains focus: $retries',
    async ({ error, retries }) => {
      mockWorkspaceApi.listDeployments
        .mockRejectedValueOnce(error)
        .mockResolvedValue(listing)
      renderSwitcher()
      await waitFor(() =>
        expect(useDeploymentPickStore().state.phase).toBe('hidden')
      )

      window.dispatchEvent(new Event('focus'))

      await waitFor(() =>
        expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledTimes(
          retries ? 2 : 1
        )
      )
      await waitFor(() =>
        expect(screen.queryByTestId('deployment-switcher') !== null).toBe(
          retries
        )
      )
    }
  )

  it('asks again on focus at most once a minute while the listing keeps failing', async () => {
    mockWorkspaceApi.listDeployments.mockRejectedValue(
      new WorkspaceApiError('Service unavailable', 503)
    )
    renderSwitcher()
    await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_BACKSTOP_MS)
    expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledTimes(3)

    await focusWindowEvery(5_000, 10)
    expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledTimes(4)

    await vi.advanceTimersByTimeAsync(10_000)
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(0)
    expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledTimes(5)
  })

  it('waits for the boot listing before a focus retries it', async () => {
    let answer: (list: WorkspaceDeploymentList) => void = () => {}
    mockWorkspaceApi.listDeployments.mockReturnValueOnce(
      new Promise<WorkspaceDeploymentList>((resolve) => {
        answer = resolve
      })
    )
    renderSwitcher()

    window.dispatchEvent(new Event('focus'))
    answer(listing)

    expect(await screen.findByTestId('deployment-switcher')).toBeVisible()
    expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledOnce()
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

  it('checks the default deployment for a browser that follows it, and offers a member no way to change it', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D2,
      pick_source: 'workspace_default',
      default_deployment_id: D2
    })
    const user = renderSwitcher()
    await openList(user)

    expect(screen.getByTestId(`deployment-row-${D2}`)).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.queryByTestId('deployment-switcher-default')).toBeNull()
  })

  it('goes back to following the workspace default when its row is picked over an own pick of another deployment', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D1,
      pick_source: 'browser',
      default_deployment_id: D2
    })
    mockWorkspaceApi.clearDeployment.mockResolvedValue(undefined)
    const user = renderSwitcher()
    await openList(user)

    await user.click(screen.getByTestId(`deployment-row-${D2}`))

    expect(mockWorkspaceApi.clearDeployment).toHaveBeenCalledWith('ws-1', {
      follow: 'workspace'
    })
    expect(mockWorkspaceApi.pickDeployment).not.toHaveBeenCalled()
    await waitFor(() => expect(reload).toHaveBeenCalledOnce())
  })

  it('lets an owner make any deployment the workspace default without switching to it, and names its Build', async () => {
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
    ).toHaveTextContent(/^Studio Build$/)
    await openDefaultMenu(user)
    expect(screen.getByTestId(`default-row-${D1}`)).toHaveAttribute(
      'aria-checked',
      'true'
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

  it('disables the engine button while a default is being set', async () => {
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

  it('shows the new default even when the refresh after it fails', async () => {
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
    await openDefaultMenu(user)
    expect(screen.getByTestId(`default-row-${D2}`)).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(useToast().toasts).toEqual([])
    expect(reload).not.toHaveBeenCalled()
  })

  describe('with unsaved workflows', () => {
    const portrait = fromPartial<ComfyWorkflow>({
      path: 'workflows/portrait.json',
      isLoaded: true,
      isModified: true
    })

    beforeEach(() => {
      takeLeavePromptSkip()
      Object.assign(useWorkflowStore(), { modifiedWorkflows: [portrait] })
      vi.mocked(useWorkflowService().saveWorkflow).mockResolvedValue(true)
    })

    it.for([
      {
        path: 'picking a deployment',
        owner: false,
        boot: listing,
        next: listing,
        act: (user: ReturnType<typeof userEvent.setup>) =>
          user.click(screen.getByTestId(`deployment-row-${D2}`)),
        target: 'Studio Build · production'
      },
      {
        path: 'picking Comfy Cloud',
        owner: false,
        boot: { ...listing, picked_deployment_id: D2, pick_source: 'browser' },
        next: { ...listing, picked_deployment_id: D2, pick_source: 'browser' },
        act: (user: ReturnType<typeof userEvent.setup>) =>
          user.click(screen.getByTestId('deployment-row-cloud')),
        target: 'Comfy Cloud'
      },
      {
        path: 'following the workspace default',
        owner: false,
        boot: {
          ...listing,
          picked_deployment_id: D1,
          pick_source: 'browser',
          default_deployment_id: D2
        },
        next: {
          ...listing,
          picked_deployment_id: D1,
          pick_source: 'browser',
          default_deployment_id: D2
        },
        act: (user: ReturnType<typeof userEvent.setup>) =>
          user.click(screen.getByTestId(`deployment-row-${D2}`)),
        target: 'Studio Build · production'
      },
      {
        path: 'changing the default this browser follows',
        owner: true,
        boot: listing,
        next: listing,
        act: async (user: ReturnType<typeof userEvent.setup>) => {
          await openDefaultMenu(user)
          await user.click(screen.getByTestId(`default-row-${D1}`))
        },
        target: 'Studio Build · staging'
      },
      {
        path: 'reloading after its deployment changed',
        owner: false,
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
        act: async (user: ReturnType<typeof userEvent.setup>) =>
          user.click(await screen.findByTestId('deployment-switcher-reload')),
        target: 'Studio Build · production'
      }
    ] satisfies {
      path: string
      owner: boolean
      boot: WorkspaceDeploymentList
      next: WorkspaceDeploymentList
      act: (user: ReturnType<typeof userEvent.setup>) => Promise<void>
      target: string
    }[])(
      'asks to save them first when $path, and changes nothing on Cancel',
      async ({ owner, boot, next, act, target }) => {
        if (owner) asOwner()
        mockWorkspaceApi.listDeployments
          .mockResolvedValueOnce(boot)
          .mockResolvedValue(next)
        vi.mocked(useDialogService().confirm).mockResolvedValueOnce(null)
        const user = renderSwitcher()
        await screen.findByTestId('deployment-switcher-trigger')
        await openList(user)

        await act(user)

        await waitFor(() =>
          expect(useDialogService().confirm).toHaveBeenCalledWith(
            expect.objectContaining({
              message: `Switching to ${target} reloads the tab. These workflows have changes that aren't saved yet.`,
              itemList: ['workflows/portrait.json']
            })
          )
        )
        expect(mockWorkspaceApi.pickDeployment).not.toHaveBeenCalled()
        expect(mockWorkspaceApi.clearDeployment).not.toHaveBeenCalled()
        expect(mockWorkspaceApi.setDefaultDeployment).not.toHaveBeenCalled()
        expect(reload).not.toHaveBeenCalled()
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      }
    )

    it.for([
      { choice: 'Save and switch', answer: true, saved: [portrait] },
      { choice: 'Switch without saving', answer: false, saved: [] }
    ])(
      'switches on $choice, and that reload skips the leave prompt',
      async ({ answer, saved }) => {
        mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
        mockWorkspaceApi.pickDeployment.mockResolvedValue(undefined)
        vi.mocked(useDialogService().confirm).mockResolvedValueOnce(answer)
        const user = renderSwitcher()
        await openList(user)

        await user.click(screen.getByTestId(`deployment-row-${D2}`))

        await waitFor(() => expect(reload).toHaveBeenCalledOnce())
        expect(
          vi
            .mocked(useWorkflowService().saveWorkflow)
            .mock.calls.map(([workflow]) => workflow)
        ).toEqual(saved)
        expect(mockWorkspaceApi.pickDeployment).toHaveBeenCalledWith('ws-1', {
          deployment_id: D2
        })
        expect(takeLeavePromptSkip()).toBe(true)
      }
    )

    it('stays put when a save does not finish', async () => {
      mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
      vi.mocked(useDialogService().confirm).mockResolvedValueOnce(true)
      vi.mocked(useWorkflowService().saveWorkflow).mockResolvedValueOnce(false)
      const user = renderSwitcher()
      await openList(user)

      await user.click(screen.getByTestId(`deployment-row-${D2}`))

      await waitFor(() =>
        expect(useWorkflowService().saveWorkflow).toHaveBeenCalledOnce()
      )
      expect(mockWorkspaceApi.pickDeployment).not.toHaveBeenCalled()
      expect(reload).not.toHaveBeenCalled()
    })

    it('keeps the leave prompt when the server refuses the switch', async () => {
      mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
      mockWorkspaceApi.pickDeployment.mockRejectedValue(
        new WorkspaceApiError('deployment is not in this workspace', 403)
      )
      vi.mocked(useDialogService().confirm).mockResolvedValueOnce(false)
      const user = renderSwitcher()
      await openList(user)

      await user.click(screen.getByTestId(`deployment-row-${D2}`))

      await waitFor(() => expect(useToast().toasts).toHaveLength(1))
      expect(reload).not.toHaveBeenCalled()
      expect(takeLeavePromptSkip()).toBe(false)
    })

    it('neither asks nor changes anything when an owner re-picks the current default', async () => {
      asOwner()
      mockWorkspaceApi.listDeployments.mockResolvedValue({
        ...listing,
        picked_deployment_id: D2,
        pick_source: 'workspace_default',
        default_deployment_id: D2
      })
      const user = renderSwitcher()
      await openList(user)
      await openDefaultMenu(user)

      await user.click(screen.getByTestId(`default-row-${D2}`))

      expect(useDialogService().confirm).not.toHaveBeenCalled()
      expect(mockWorkspaceApi.setDefaultDeployment).not.toHaveBeenCalled()
    })

    it('neither asks nor reloads when an owner clears a deleted default this browser follows', async () => {
      asOwner()
      mockWorkspaceApi.listDeployments.mockResolvedValue({
        ...listing,
        gone_default_deployment_id: GONE
      })
      mockWorkspaceApi.clearDefaultDeployment.mockResolvedValue(undefined)
      const user = renderSwitcher()
      await openList(user)
      await openDefaultMenu(user)

      await user.click(screen.getByTestId('default-row-cloud'))

      await waitFor(() =>
        expect(mockWorkspaceApi.clearDefaultDeployment).toHaveBeenCalledWith(
          'ws-1'
        )
      )
      expect(useDialogService().confirm).not.toHaveBeenCalled()
      expect(reload).not.toHaveBeenCalled()
    })

    it('drops an own pick of the default itself without asking or reloading', async () => {
      const ownPickOfDefault = {
        ...listing,
        picked_deployment_id: D2,
        pick_source: 'browser',
        default_deployment_id: D2
      } satisfies WorkspaceDeploymentList
      mockWorkspaceApi.listDeployments
        .mockResolvedValueOnce(ownPickOfDefault)
        .mockResolvedValueOnce(ownPickOfDefault)
        .mockResolvedValue({
          ...ownPickOfDefault,
          pick_source: 'workspace_default'
        })
      mockWorkspaceApi.clearDeployment.mockResolvedValue(undefined)
      const user = renderSwitcher()
      await openList(user)

      await user.click(screen.getByTestId(`deployment-row-${D2}`))

      await waitFor(() =>
        expect(useDeploymentPickStore().followsWorkspace).toBe(true)
      )
      expect(mockWorkspaceApi.clearDeployment).toHaveBeenCalledWith('ws-1', {
        follow: 'workspace'
      })
      expect(useDialogService().confirm).not.toHaveBeenCalled()
      expect(reload).not.toHaveBeenCalled()
    })
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

    it("shows names with ', & and / as written on the button, the rows and the owner's default", async () => {
      asOwner()
      mockWorkspaceApi.listDeployments.mockResolvedValue({
        ...oddlyNamed,
        picked_deployment_id: D2,
        pick_source: 'browser',
        default_deployment_id: D1
      })
      const user = renderSwitcher(escapingI18n)

      expect(
        await screen.findByTestId('deployment-switcher-trigger')
      ).toHaveAttribute(
        'aria-label',
        "Running on Vinh's R&D/Prod · production & co. Choose where this editor runs"
      )
      await openList(user)
      expect(screen.getByTestId(`deployment-row-${D1}`)).toHaveTextContent(
        "Vinh's R&D/Prodstaging & co"
      )
      expect(
        screen.getByTestId('deployment-switcher-default-current')
      ).toHaveTextContent("Vinh's R&D/Prod")
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

  it('opens its list when the missing-nodes message asks for the switcher', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    renderSwitcher()
    await screen.findByTestId('deployment-switcher-trigger')
    expect(screen.queryByRole('menu')).toBeNull()

    useDeploymentPickStore().requestSwitcherOpen()

    expect(await screen.findByRole('menu')).toBeInTheDocument()
  })

  it('does not open on its own later for an ask made before it could show', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    useDeploymentPickStore().requestSwitcherOpen()
    renderSwitcher()

    expect(
      await screen.findByTestId('deployment-switcher-trigger')
    ).toBeInTheDocument()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  describe('marks which deployments can run the open workflow', () => {
    beforeEach(() => {
      hoisted.rootGraph = workflowWith(
        'KSampler',
        'Power Lora Loader (rgthree)'
      )
      mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
      vi.mocked(useFeatureFlags().flags).deploymentCompatibilityMarksEnabled =
        true
    })

    it('shows the rows as before and sends no check while its switch is off', async () => {
      vi.mocked(useFeatureFlags().flags).deploymentCompatibilityMarksEnabled =
        false
      const user = renderSwitcher()
      await openList(user)

      expect(
        await screen.findByTestId(`deployment-row-${D2}`)
      ).toHaveTextContent('Studio Build')
      await nextTick()
      expect(
        mockWorkspaceApi.checkDeploymentCompatibility
      ).not.toHaveBeenCalled()
      expect(screen.queryByTestId('deployment-row-mark')).toBeNull()
    })

    it('says which rows run it, which miss nodes (named on hover and in the row description), and which were not checked', async () => {
      mockWorkspaceApi.checkDeploymentCompatibility.mockResolvedValue({
        deployments: [
          { deployment_id: D2, missing_node_types: [], unknown: false },
          {
            deployment_id: D1,
            missing_node_types: ['Power Lora Loader (rgthree)'],
            unknown: false
          },
          { deployment_id: D9, missing_node_types: [], unknown: true }
        ],
        cloud: {
          missing_node_types: ['Power Lora Loader (rgthree)', 'Image Saver']
        }
      })
      const user = renderSwitcher()
      await openList(user)

      await waitFor(() =>
        expect(screen.getByTestId(`deployment-row-${D2}`)).toHaveTextContent(
          'Runs this workflow'
        )
      )
      expect(
        mockWorkspaceApi.checkDeploymentCompatibility
      ).toHaveBeenCalledWith('ws-1', [
        'KSampler',
        'Power Lora Loader (rgthree)'
      ])
      expect(screen.getByTestId(`deployment-row-${D1}`)).toHaveTextContent(
        'Missing 1 node'
      )
      expect(screen.getByText('Missing 1 node')).toHaveAttribute(
        'title',
        'Power Lora Loader (rgthree)'
      )
      expect(
        screen.getByTestId(`deployment-row-${D1}`)
      ).toHaveAccessibleDescription('Power Lora Loader (rgthree)')
      expect(
        screen.getByTestId(`deployment-row-${D2}`)
      ).not.toHaveAccessibleDescription()
      expect(screen.getByTestId(`deployment-row-${D9}`)).toHaveTextContent(
        'Not checked'
      )
      expect(screen.getByTestId('deployment-row-cloud')).toHaveTextContent(
        'Missing 2 nodes'
      )
      expect(screen.getByText('Missing 2 nodes')).toHaveAttribute(
        'title',
        'Power Lora Loader (rgthree), Image Saver'
      )
      expect(
        screen.getByTestId('deployment-row-cloud')
      ).toHaveAccessibleDescription('Power Lora Loader (rgthree), Image Saver')
    })

    it('keeps the deployment title whole and shortens its subtitle first, in a list no wider than the screen', async () => {
      mockWorkspaceApi.checkDeploymentCompatibility.mockResolvedValue({
        deployments: [
          { deployment_id: D2, missing_node_types: [], unknown: false }
        ],
        cloud: { missing_node_types: [] }
      })
      const user = renderSwitcher()
      const menu = await openList(user)
      const row = await screen.findByTestId(`deployment-row-${D2}`)
      await waitFor(() => expect(row).toHaveTextContent('Runs this workflow'))

      expect(menu).toHaveClass('max-w-[min(25rem,calc(100vw-1rem))]')
      expect(within(row).getByText('Studio Build')).toHaveClass('shrink-0')
      const subtitle = within(row).getByText('production · v2')
      expect(subtitle).toHaveClass('min-w-0', 'truncate')
      expect(subtitle).not.toHaveClass('shrink-0')
      expect(subtitle).toHaveAttribute('title', 'production · v2')
    })

    it('shows the rows as before when the check fails', async () => {
      mockWorkspaceApi.checkDeploymentCompatibility.mockRejectedValue(
        new WorkspaceApiError('not found', 404)
      )
      const user = renderSwitcher()
      await openList(user)
      await waitFor(() =>
        expect(mockWorkspaceApi.checkDeploymentCompatibility).toHaveBeenCalled()
      )
      await nextTick()

      expect(screen.getByTestId(`deployment-row-${D2}`)).toHaveTextContent(
        'Studio Build'
      )
      expect(screen.queryByTestId('deployment-row-mark')).toBeNull()
    })
  })
})
