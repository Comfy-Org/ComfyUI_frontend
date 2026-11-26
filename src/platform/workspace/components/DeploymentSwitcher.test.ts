import { fromPartial } from '@total-typescript/shoehorn'
import { escapeRegExp } from 'es-toolkit'
import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import type {
  DeploymentCompatibility,
  WorkspaceDeployment,
  WorkspaceDeploymentList
} from '@/platform/workspace/api/workspaceApi'

import enMessages from '@/locales/en/main.json'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { useToast } from '@/components/ui/toast/toastStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { createTestRootGraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@comfyorg/telemetry/reportError'
import { takeLeavePromptSkip } from '@/platform/workflow/management/leavePrompt'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import {
  DEPLOYMENT_LISTING_BACKSTOP_MS,
  DEPLOYMENT_START_POLL_MS,
  DEPLOYMENT_VERSION_WATCH_MS
} from '@/platform/workspace/api/deploymentListingTimeouts'
import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'
import type {
  BuildStage,
  FollowedBuild
} from '@/platform/workspace/platformFrame/platformFrameBuild'
import { useTelemetry } from '@comfyorg/telemetry'
import { usePlatformFrameStore } from '@/platform/workspace/platformFrame/platformFrameStore'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'
import { api } from '@/scripts/api'

import PlatformFrameHost from '@/platform/workspace/platformFrame/PlatformFrameHost.vue'

import DeploymentSwitcher from './DeploymentSwitcher.vue'

const mockWorkspaceApi = vi.hoisted(() => ({
  listDeployments: vi.fn(),
  pickDeployment: vi.fn(),
  startDeployment: vi.fn(),
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

vi.mock<unknown>(import('@/platform/workspace/api/workspaceApi'), () => ({
  workspaceApi: mockWorkspaceApi
}))

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@comfyorg/telemetry/reportError'), { spy: true })
vi.mock(import('@comfyorg/telemetry'))
vi.mock(
  import('@/platform/workspace/platformFrame/customDeploymentTelemetry'),
  {
    spy: true
  }
)
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
      can_start: false,
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
      can_start: true,
      created_at: '2026-09-20T00:00:00Z'
    },
    {
      deployment_id: D9,
      release_id: 'r-9',
      status: 'stopped',
      can_start: true,
      created_at: '2026-09-10T00:00:00Z'
    }
  ]
}

function withStatus(
  deployment: WorkspaceDeployment,
  status: WorkspaceDeployment['status'],
  canStart = status === 'stopped' || status === 'failed'
): WorkspaceDeployment {
  return { ...deployment, status, can_start: canStart }
}

const everyRowReady: WorkspaceDeploymentList = {
  ...listing,
  items: listing.items.map((item) => withStatus(item, 'ready'))
}

function workflowWith(...types: string[]): LGraph {
  const graph = createTestRootGraph()
  for (const type of types) graph.add(new LGraphNode(type, type))
  return graph
}

function renderSwitcher(plugin = i18n, { onTeamPlan = true } = {}) {
  const user = userEvent.setup({ pointerEventsCheck: 0 })
  render(DeploymentSwitcher, {
    props: { onTeamPlan },
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
    useSettingStore().$patch({
      settingValues: { 'Comfy.DeploymentSwitcher.Seen': true }
    })
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
      within(production).getByText("Studio's <b>production</b> & R&D")
    ).toBeVisible()
    expect(screen.getByTestId(`deployment-row-${D1}`)).toHaveTextContent(
      'Studio Buildstaging'
    )
  })

  const rowColumns = [
    {
      row: D2,
      title: 'Studio Build',
      name: 'production',
      detail: 'v2',
      runOnDetail: 'v2',
      note: ''
    },
    {
      row: D1,
      title: 'Studio Build',
      name: 'staging',
      detail: 'Stopped',
      runOnDetail: 'Start',
      note: "Studio Build · staging isn't running. Start it on the Developer Platform, then pick it."
    },
    {
      row: D9,
      title: 'Deployment dep-b9b9b9b9',
      name: '',
      detail: 'Stopped',
      runOnDetail: 'Start',
      note: "Deployment dep-b9b9b9b9 isn't running. Start it on the Developer Platform, then pick it."
    }
  ]

  function columnsOf(
    { title, name, detail }: (typeof rowColumns)[number],
    note = ''
  ) {
    const cells = [title, name, detail, note].map(escapeRegExp)
    return new RegExp(`^${cells.join('\\s*')}$`)
  }

  it.for(rowColumns)(
    'gives each row the same columns, the Build, the deployment, then the version when ready or else what choosing it does: $title $name $runOnDetail',
    async (columns) => {
      mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
      const user = renderSwitcher()
      await openList(user)
      expect(
        screen.getByTestId(`deployment-row-${columns.row}`)
      ).toHaveTextContent(
        columnsOf({ ...columns, detail: columns.runOnDetail }, columns.note)
      )
    }
  )

  it.for(rowColumns)(
    'gives each Workspace default row the same columns: $title $name $detail',
    async (columns) => {
      asOwner()
      mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
      const user = renderSwitcher()
      await openList(user)
      await openDefaultMenu(user)
      expect(
        screen.getByTestId(`default-row-${columns.row}`)
      ).toHaveTextContent(columnsOf(columns))
    }
  )

  async function focusProductionRow(cutOffText?: string) {
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(
      function (this: Element) {
        return this.textContent.trim() === cutOffText ? 400 : 0
      }
    )
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    const user = renderSwitcher()
    await openList(user)
    const production = screen.getByTestId(`deployment-row-${D2}`)

    production.focus()
    await waitFor(() => expect(production).toHaveFocus())
  }

  it.for([
    { cell: 'Build name', text: 'Studio Build' },
    { cell: 'deployment name', text: 'production' },
    { cell: 'version', text: 'v2' }
  ])(
    'spells out a row beside the menu when its $cell is cut off',
    async ({ text }) => {
      await focusProductionRow(text)

      expect(await screen.findByRole('tooltip')).toHaveTextContent(
        'Studio Build · production · v2'
      )
    }
  )

  it('shows no tooltip for a row whose text fits', async () => {
    await focusProductionRow()

    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it.for<{
    status: WorkspaceDeployment['status']
    text: string
    name: string
  }>([
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
        items: [withStatus(listing.items[0], status), ...listing.items.slice(1)]
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
    expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledWith('ws-1', [])
    expect(screen.queryByTestId('deployment-switcher')).toBeNull()
  })

  it('says Comfy Cloud when nothing is picked, and lists every deployment with only a ready one pickable', async () => {
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
    expect(screen.getByTestId(`deployment-row-${D2}`)).not.toHaveAttribute(
      'aria-disabled'
    )
    expect(screen.getByTestId(`deployment-row-${D1}`)).toHaveAccessibleName(
      'Start Studio Build · staging on the Developer Platform'
    )
    expect(screen.queryByTestId('deployment-switcher-default')).toBeNull()
  })

  it('marks the engine button until its first open closes, and remembers it on every device as soon as it opens', async () => {
    useSettingStore().$patch({
      settingValues: { 'Comfy.DeploymentSwitcher.Seen': false }
    })
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    const user = renderSwitcher()
    const trigger = await screen.findByTestId('deployment-switcher-trigger')
    expect(screen.getByTestId('deployment-switcher-new')).toBeInTheDocument()
    expect(trigger).toHaveAccessibleName(
      'New. Running on Comfy Cloud. Choose where this editor runs'
    )

    await openList(user)
    expect(api.storeSetting).toHaveBeenCalledWith(
      'Comfy.DeploymentSwitcher.Seen',
      true
    )
    expect(screen.getByTestId('deployment-switcher-new')).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await waitFor(() =>
      expect(
        screen.queryByTestId('deployment-switcher-new')
      ).not.toBeInTheDocument()
    )
    expect(trigger).toHaveAccessibleName(
      'Running on Comfy Cloud. Choose where this editor runs'
    )
  })

  it('switches only to a ready deployment, and a stopped row opens its page on the Developer Platform in a new tab', async () => {
    const openPage = vi.spyOn(window, 'open').mockReturnValue(null)
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    mockWorkspaceApi.pickDeployment.mockReturnValue(new Promise(() => {}))
    const user = renderSwitcher()
    await openList(user)

    await user.click(screen.getByTestId(`deployment-row-${D1}`))
    expect(openPage).toHaveBeenCalledWith(
      `${getComfyPlatformBaseUrl()}/profile/deployments/${D1}?utm_source=comfyui&utm_medium=app&utm_content=deployment-switcher`,
      '_blank',
      'noopener,noreferrer'
    )
    expect(mockWorkspaceApi.pickDeployment).not.toHaveBeenCalled()
    expect(mockWorkspaceApi.startDeployment).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())

    await openList(user)

    await user.click(screen.getByTestId(`deployment-row-${D2}`))
    expect(mockWorkspaceApi.pickDeployment).toHaveBeenCalledWith('ws-1', {
      deployment_id: D2
    })
  })

  it.for<{ status: WorkspaceDeployment['status']; reason: string }>([
    {
      status: 'stopped',
      reason:
        "Studio Build · staging isn't running. Start it on the Developer Platform, then pick it."
    },
    {
      status: 'failed',
      reason:
        "Studio Build · staging isn't running. Start it on the Developer Platform, then pick it."
    },
    {
      status: 'provisioning',
      reason: "Studio Build · staging is starting. Pick it once it's ready."
    },
    {
      status: 'stopping',
      reason: "Studio Build · staging isn't ready. Pick it once it's ready."
    }
  ])(
    'says beside a $status row why it cannot be picked',
    async ({ status, reason }) => {
      mockWorkspaceApi.listDeployments.mockResolvedValue({
        ...listing,
        items: [listing.items[0], withStatus(listing.items[1], status)]
      })
      const user = renderSwitcher()
      await openList(user)

      await user.hover(screen.getByTestId(`deployment-row-${D1}`))
      await vi.advanceTimersByTimeAsync(1_000)

      expect(await screen.findByRole('tooltip')).toHaveTextContent(reason)
    }
  )

  it('gives no reason on the row this browser already runs on', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D1,
      items: [listing.items[0], withStatus(listing.items[1], 'provisioning')]
    })
    const user = renderSwitcher()
    await openList(user)

    expect(
      await screen.findByTestId(`deployment-row-${D1}`)
    ).not.toHaveAccessibleDescription()
  })

  it('refreshes the listing each time the list opens', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    const user = renderSwitcher()
    await openList(user)
    await waitFor(() =>
      expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledTimes(2)
    )
  })

  it('keeps keyboard focus on a row that the refreshed listing moves', async () => {
    let refresh: (listing: WorkspaceDeploymentList) => void = () => {}
    mockWorkspaceApi.listDeployments.mockResolvedValueOnce(everyRowReady)
    mockWorkspaceApi.listDeployments.mockReturnValueOnce(
      new Promise<WorkspaceDeploymentList>((resolve) => {
        refresh = resolve
      })
    )
    const user = renderSwitcher()
    await openList(user)
    const unnamed = screen.getByTestId(`deployment-row-${D9}`)
    unnamed.focus()
    await waitFor(() => expect(unnamed).toHaveFocus())

    const [production, staging, unnamedItem] = everyRowReady.items
    refresh({ ...everyRowReady, items: [unnamedItem, production, staging] })
    await waitFor(() =>
      expect(
        screen.getAllByRole('menuitemradio').map((row) => row.dataset.testid)
      ).toEqual([
        'deployment-row-cloud',
        `deployment-row-${D9}`,
        `deployment-row-${D2}`,
        `deployment-row-${D1}`
      ])
    )

    await waitFor(() => expect(unnamed).toHaveFocus())
    await user.keyboard('{ArrowDown}')
    expect(screen.getByTestId(`deployment-row-${D2}`)).toHaveFocus()
  })

  it('links an existing deployment workspace to the Builds page on the Developer Platform in a new tab', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    const user = renderSwitcher()
    await openList(user)

    const builds = screen.getByRole('menuitem', { name: 'Manage builds' })
    expect(builds).toHaveAttribute(
      'href',
      `${getComfyPlatformBaseUrl()}/profile/builds?utm_source=comfyui&utm_medium=app&utm_content=deployment-switcher`
    )
    expect(builds).toHaveAttribute('target', '_blank')
  })

  it('offers to create a Custom Build in a workspace that already has deployments', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    const user = renderSwitcher()
    await openList(user)

    await user.click(
      screen.getByRole('menuitem', { name: 'Create a Custom Build' })
    )

    await waitFor(() =>
      expect(
        useDialogStore().isDialogOpen('global-create-custom-deployment')
      ).toBe(true)
    )
  })

  function sendRealLinkTelemetry() {
    Object.assign(useFeatureFlags().flags, {
      customDeploymentsEditorEnabled: true
    })
    onTestFinished(() => {
      Object.assign(useFeatureFlags().flags, {
        customDeploymentsEditorEnabled: false
      })
    })
  }

  function sentLinkEvents() {
    return vi
      .mocked(useTelemetry()!.trackCustomDeploymentEvent)
      .mock.calls.map(([event]) => event)
      .filter((event) => event.name === 'platform:deployment_link_clicked')
  }

  const MANAGE_DEPLOYMENTS_EVENT = {
    name: 'platform:deployment_link_clicked',
    properties: { kind: 'manage_deployments', workspace_id: null }
  }

  it('counts a Manage builds click', async () => {
    sendRealLinkTelemetry()
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    const user = renderSwitcher()
    await openList(user)

    await user.click(screen.getByRole('menuitem', { name: 'Manage builds' }))

    await waitFor(() =>
      expect(sentLinkEvents()).toEqual([MANAGE_DEPLOYMENTS_EVENT])
    )
  })

  it('counts a Manage builds click once when a script cancels and replays it', async () => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    sendRealLinkTelemetry()
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    render(DeploymentSwitcher, { global: { plugins: [i18n] } })
    const user = userEvent.setup({
      pointerEventsCheck: 0,
      advanceTimers: vi.advanceTimersByTime
    })
    await openList(user)
    const builds = screen.getByRole('menuitem', { name: 'Manage builds' })
    let replayed = false
    builds.addEventListener('click', (event) => {
      if (builds.dataset.replayed === 'true') {
        delete builds.dataset.replayed
        replayed = true
        return
      }
      builds.dataset.replayed = 'true'
      setTimeout(() => builds.click(), 10)
      event.preventDefault()
    })

    await user.click(builds)

    await vi.advanceTimersByTimeAsync(20)

    expect(replayed).toBe(true)
    expect(sentLinkEvents()).toEqual([MANAGE_DEPLOYMENTS_EVENT])
  })

  it('says a workspace with no deployments has none yet and opens the creation dialog', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      items: []
    })
    const user = renderSwitcher()
    await openList(user)

    expect(screen.getByTestId('deployment-switcher-empty')).toHaveTextContent(
      'This workspace has no deployments yet.'
    )
    expect(screen.queryByTestId('deployment-switcher-builds')).toBeNull()
    expect(screen.queryByText(/Switching reloads the editor/)).toBeNull()

    await user.click(
      screen.getByRole('menuitem', { name: 'Create a Custom Build' })
    )

    await waitFor(() =>
      expect(
        useDialogStore().isDialogOpen('global-create-custom-deployment')
      ).toBe(true)
    )
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
    const readyStaging = withStatus(listing.items[1], 'ready')
    const boot = {
      ...listing,
      items: [listing.items[0], readyStaging],
      picked_deployment_id: D2,
      pick_source: 'browser'
    }
    mockWorkspaceApi.listDeployments
      .mockResolvedValueOnce(boot)
      .mockResolvedValue({
        ...boot,
        items: [
          { ...listing.items[0], release_id: 'r-3', release_version: 3 },
          readyStaging
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

  it.for([
    { flag: true, reads: 2 },
    { flag: false, reads: 1 }
  ])(
    'reads once on focus, and every 30 s only with Platform in the editor on: $flag',
    async ({ flag, reads }) => {
      Object.assign(useFeatureFlags().flags, {
        customDeploymentsEditorEnabled: flag
      })
      mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
      renderSwitcher()
      await screen.findByTestId('deployment-switcher-trigger')
      await vi.advanceTimersByTimeAsync(0)

      window.dispatchEvent(new Event('focus'))
      await vi.advanceTimersByTimeAsync(0)
      expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledTimes(2)

      await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)
      expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledTimes(1 + reads)
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

  it('reads the listing again when the window regains focus on a listing already shown', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    renderSwitcher()
    expect(await screen.findByTestId('deployment-switcher')).toBeVisible()
    await vi.advanceTimersByTimeAsync(0)
    expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledOnce()

    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(0)

    expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledTimes(2)
  })

  it('puts keyboard focus in the menu each time it is asked to open', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    const user = renderSwitcher()
    await screen.findByTestId('deployment-switcher-trigger')
    const store = useDeploymentPickStore()

    store.requestSwitcherOpen()
    const firstMenu = await screen.findByRole('menu')
    await waitFor(() => expect(firstMenu).toHaveFocus())
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())

    store.requestSwitcherOpen()
    const secondMenu = await screen.findByRole('menu')
    await waitFor(() => expect(secondMenu).toHaveFocus())
  })

  it('counts as a switcher that can open only while it is mounted', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    const { unmount } = render(DeploymentSwitcher, {
      global: { plugins: [i18n] }
    })
    await screen.findByTestId('deployment-switcher-trigger')
    const store = useDeploymentPickStore()

    store.requestSwitcherOpen()
    expect(await screen.findByRole('menu')).toBeVisible()
    expect(store.switcherMounts).toBe(1)

    unmount()

    expect(store.switcherMounts).toBe(0)
  })

  it('keeps reading the listing while the picked deployment is starting, with the menu closed', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D1,
      items: [
        listing.items[0],
        withStatus(listing.items[1], 'starting'),
        listing.items[2]
      ]
    })
    renderSwitcher()
    expect(await screen.findByTestId('deployment-switcher')).toBeVisible()
    await vi.advanceTimersByTimeAsync(0)
    const readsAtBoot = mockWorkspaceApi.listDeployments.mock.calls.length

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_START_POLL_MS)

    expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledTimes(
      readsAtBoot + 1
    )
  })

  it('keeps reading the listing when it mounts on a pick that is already starting', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D1,
      items: [
        listing.items[0],
        withStatus(listing.items[1], 'starting'),
        listing.items[2]
      ]
    })
    await useDeploymentPickStore().loadOnce()
    renderSwitcher()
    expect(await screen.findByTestId('deployment-switcher')).toBeVisible()
    await vi.advanceTimersByTimeAsync(0)
    const readsAtMount = mockWorkspaceApi.listDeployments.mock.calls.length

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_START_POLL_MS)

    expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledTimes(
      readsAtMount + 1
    )
  })

  it('offers Switch on Comfy Cloud when the picked deployment is stopped, and switches there', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D1
    })
    mockWorkspaceApi.clearDeployment.mockResolvedValue(undefined)
    const user = renderSwitcher()
    await openList(user)

    const cloud = await screen.findByTestId('deployment-row-cloud')
    expect(within(cloud).getByText('Switch')).toBeVisible()
    expect(
      within(screen.getByTestId(`deployment-row-${D2}`)).queryByText('Switch')
    ).toBeNull()

    await user.click(cloud)

    await waitFor(() =>
      expect(mockWorkspaceApi.clearDeployment).toHaveBeenCalledWith('ws-1')
    )
  })

  it('offers no Switch while the picked deployment is ready', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      picked_deployment_id: D2
    })
    const user = renderSwitcher()
    await openList(user)

    expect(
      within(await screen.findByTestId('deployment-row-cloud')).queryByText(
        'Switch'
      )
    ).toBeNull()
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

  it('offers an owner on a Team or Enterprise plan the workspace default', async () => {
    asOwner()
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    const user = renderSwitcher()
    await openList(user)

    expect(
      screen.getByTestId('deployment-switcher-default')
    ).toBeInTheDocument()
  })

  it('hides the workspace default from an owner on an individual plan', async () => {
    asOwner()
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    const user = renderSwitcher(i18n, { onTeamPlan: false })
    await openList(user)

    expect(screen.queryByTestId('deployment-switcher-default')).toBeNull()
    expect(
      screen.getByRole('menuitem', { name: 'Manage builds' })
    ).toBeInTheDocument()
  })

  it.for([
    { recorded: 'a default', reply: { default_deployment_id: D1 } },
    {
      recorded: 'a deleted default',
      reply: { gone_default_deployment_id: GONE }
    }
  ] satisfies {
    recorded: string
    reply: Partial<WorkspaceDeploymentList>
  }[])(
    'offers an owner on an individual plan only clearing the workspace default while $recorded is recorded',
    async ({ reply }) => {
      asOwner()
      mockWorkspaceApi.listDeployments.mockResolvedValue({
        ...listing,
        ...reply
      })
      const user = renderSwitcher(i18n, { onTeamPlan: false })
      await openList(user)
      await openDefaultMenu(user)

      expect(screen.getByTestId('default-row-cloud')).toBeInTheDocument()
      expect(screen.queryByTestId(`default-row-${D2}`)).not.toBeInTheDocument()
    }
  )

  it('keeps the current default checked in the clear-only menu for an owner on an individual plan', async () => {
    asOwner()
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      default_deployment_id: D1
    })
    const user = renderSwitcher(i18n, { onTeamPlan: false })
    await openList(user)
    await openDefaultMenu(user)

    expect(screen.getByTestId(`default-row-${D1}`)).toHaveAttribute(
      'aria-checked',
      'true'
    )
  })

  it('does not send an owner on an individual plan to choose a new default when it was deleted', async () => {
    asOwner()
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      gone_default_deployment_id: GONE
    })
    const user = renderSwitcher(i18n, { onTeamPlan: false })
    await openList(user)

    expect(
      screen.getByTestId('deployment-switcher-notice')
    ).not.toHaveTextContent('Choose a new one under Workspace default')
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
        setup: () => {},
        boot: listing,
        next: listing,
        act: (user: ReturnType<typeof userEvent.setup>) =>
          user.click(screen.getByTestId(`deployment-row-${D2}`)),
        message:
          "Switching to Studio Build · production reloads the tab. These workflows have changes that aren't saved yet."
      },
      {
        path: 'picking Comfy Cloud',
        setup: () => {},
        boot: { ...listing, picked_deployment_id: D2, pick_source: 'browser' },
        next: { ...listing, picked_deployment_id: D2, pick_source: 'browser' },
        act: (user: ReturnType<typeof userEvent.setup>) =>
          user.click(screen.getByTestId('deployment-row-cloud')),
        message:
          "Switching to Comfy Cloud reloads the tab. These workflows have changes that aren't saved yet."
      },
      {
        path: 'following the workspace default',
        setup: () => {},
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
        message:
          "Switching to Studio Build · production reloads the tab. These workflows have changes that aren't saved yet."
      },
      {
        path: 'changing the default this browser follows',
        setup: asOwner,
        boot: listing,
        next: listing,
        act: async (user: ReturnType<typeof userEvent.setup>) => {
          await openDefaultMenu(user)
          await user.click(screen.getByTestId(`default-row-${D1}`))
        },
        message:
          "Switching to Studio Build · staging reloads the tab. These workflows have changes that aren't saved yet."
      },
      {
        path: 'reloading after its deployment changed',
        setup: () => {},
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
        message:
          "Reloading the tab runs it on Studio Build · production. These workflows have changes that aren't saved yet."
      }
    ] satisfies {
      path: string
      setup: () => void
      boot: WorkspaceDeploymentList
      next: WorkspaceDeploymentList
      act: (user: ReturnType<typeof userEvent.setup>) => Promise<void>
      message: string
    }[])(
      'asks to save them first when $path, and changes nothing on Cancel',
      async ({ setup, boot, next, act, message }) => {
        setup()
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
              message,
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

    it('drops the first-open mark when it closes its list to ask about them', async () => {
      useSettingStore().$patch({
        settingValues: { 'Comfy.DeploymentSwitcher.Seen': false }
      })
      mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
      vi.mocked(useDialogService().confirm).mockResolvedValueOnce(null)
      const user = renderSwitcher()
      await openList(user)

      await user.click(screen.getByTestId(`deployment-row-${D2}`))

      await waitFor(() =>
        expect(useDialogService().confirm).toHaveBeenCalledOnce()
      )
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      await waitFor(() =>
        expect(
          screen.queryByTestId('deployment-switcher-new')
        ).not.toBeInTheDocument()
      )
    })

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

  it('opens its list and remembers the first open when the missing-nodes message asks for the switcher', async () => {
    useSettingStore().$patch({
      settingValues: { 'Comfy.DeploymentSwitcher.Seen': false }
    })
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    const user = renderSwitcher()
    await screen.findByTestId('deployment-switcher-trigger')
    expect(screen.queryByRole('menu')).toBeNull()

    useDeploymentPickStore().requestSwitcherOpen()

    expect(await screen.findByRole('menu')).toBeInTheDocument()
    await waitFor(() =>
      expect(api.storeSetting).toHaveBeenCalledWith(
        'Comfy.DeploymentSwitcher.Seen',
        true
      )
    )
    expect(screen.getByTestId('deployment-switcher-new')).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await waitFor(() =>
      expect(
        screen.queryByTestId('deployment-switcher-new')
      ).not.toBeInTheDocument()
    )
    expect(
      screen.getByTestId('deployment-switcher-trigger')
    ).toHaveAccessibleName(
      'Running on Comfy Cloud. Choose where this editor runs'
    )
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

  describe('groups the rows by whether they can run the open workflow', () => {
    function rowsIn(group: string) {
      return within(screen.getByRole('group', { name: group }))
        .getAllByRole('menuitemradio')
        .map((row) => row.dataset.testid)
    }

    beforeEach(() => {
      hoisted.rootGraph = workflowWith(
        'KSampler',
        'Power Lora Loader (rgthree)'
      )
      mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
      vi.mocked(useFeatureFlags().flags).deploymentCompatibilityMarksEnabled =
        true
    })

    it('shows one Run on list and sends no check while its switch is off', async () => {
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
      expect(rowsIn('Run on')).toEqual([
        'deployment-row-cloud',
        `deployment-row-${D2}`,
        `deployment-row-${D1}`,
        `deployment-row-${D9}`
      ])
    })

    function rowOrder() {
      return screen
        .getAllByRole('menuitemradio')
        .map((row) => row.dataset.testid)
    }

    it('puts the current deployment first in the one Run on list', async () => {
      vi.mocked(useFeatureFlags().flags).deploymentCompatibilityMarksEnabled =
        false
      mockWorkspaceApi.listDeployments.mockResolvedValue({
        ...listing,
        picked_deployment_id: D1
      })
      const user = renderSwitcher()
      await openList(user)

      await waitFor(() =>
        expect(rowsIn('Run on')).toEqual([
          `deployment-row-${D1}`,
          'deployment-row-cloud',
          `deployment-row-${D2}`,
          `deployment-row-${D9}`
        ])
      )
    })

    it('offers Switch on a ready deployment that runs the workflow when Comfy Cloud lacks its nodes', async () => {
      mockWorkspaceApi.listDeployments.mockResolvedValue({
        ...listing,
        picked_deployment_id: D1
      })
      mockWorkspaceApi.checkDeploymentCompatibility.mockResolvedValue({
        deployments: [
          { deployment_id: D2, missing_node_types: [], unknown: false },
          { deployment_id: D1, missing_node_types: [], unknown: false },
          { deployment_id: D9, missing_node_types: [], unknown: false }
        ],
        cloud: { missing_node_types: ['Power Lora Loader (rgthree)'] }
      })
      const user = renderSwitcher()
      await openList(user)

      await waitFor(() =>
        expect(
          within(screen.getByTestId(`deployment-row-${D2}`)).getByText('Switch')
        ).toBeVisible()
      )
      expect(
        within(screen.getByTestId('deployment-row-cloud')).queryByText('Switch')
      ).toBeNull()
    })

    it('lists the current row under Running on, then the rows that run it, then the rest, and names missing nodes on hover and in the row description', async () => {
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
        expect(rowsIn('Compatible environments')).toEqual([
          `deployment-row-${D2}`
        ])
      )
      expect(
        mockWorkspaceApi.checkDeploymentCompatibility
      ).toHaveBeenCalledWith('ws-1', [
        'KSampler',
        'Power Lora Loader (rgthree)'
      ])
      expect(rowsIn('Running on')).toEqual(['deployment-row-cloud'])
      expect(rowsIn('Incompatible environments')).toEqual([
        `deployment-row-${D1}`,
        `deployment-row-${D9}`
      ])
      expect(rowOrder()).toEqual([
        'deployment-row-cloud',
        `deployment-row-${D2}`,
        `deployment-row-${D1}`,
        `deployment-row-${D9}`
      ])
      expect(screen.getByTestId('deployment-row-cloud')).toHaveAccessibleName(
        'Comfy Cloud'
      )
      expect(
        screen.getByTestId('deployment-row-cloud')
      ).toHaveAccessibleDescription(
        'Comfy Cloud cannot run this workflow. It is missing Power Lora Loader (rgthree) and Image Saver.'
      )
      expect(
        screen.getByTestId(`deployment-row-${D2}`)
      ).not.toHaveAccessibleDescription()
      expect(
        screen.getByTestId(`deployment-row-${D9}`)
      ).toHaveAccessibleDescription(
        "Deployment dep-b9b9b9b9 isn't running. Start it on the Developer Platform, then pick it. Could not check whether it can run this workflow."
      )

      const staging = screen.getByTestId(`deployment-row-${D1}`)
      const stagingNote =
        "Studio Build · staging isn't running. Start it on the Developer Platform, then pick it. It cannot run this workflow. It is missing Power Lora Loader (rgthree)."
      expect(staging).toHaveAccessibleDescription(stagingNote)
      await user.hover(staging)
      await vi.advanceTimersByTimeAsync(1_000)
      expect(await screen.findByRole('tooltip')).toHaveTextContent(stagingNote)
    })

    it('keeps keyboard focus on the same row when the answer regroups the menu', async () => {
      mockWorkspaceApi.listDeployments.mockResolvedValue(everyRowReady)
      let answer: (compatibility: DeploymentCompatibility) => void = () => {}
      mockWorkspaceApi.checkDeploymentCompatibility.mockReturnValue(
        new Promise<DeploymentCompatibility>((resolve) => {
          answer = resolve
        })
      )
      const user = renderSwitcher()
      await openList(user)
      const staging = screen.getByTestId(`deployment-row-${D1}`)
      staging.focus()
      await waitFor(() => expect(staging).toHaveFocus())

      answer({
        deployments: [
          { deployment_id: D2, missing_node_types: [], unknown: false },
          {
            deployment_id: D1,
            missing_node_types: ['Power Lora Loader (rgthree)'],
            unknown: false
          },
          { deployment_id: D9, missing_node_types: [], unknown: true }
        ],
        cloud: { missing_node_types: [] }
      })
      await waitFor(() =>
        expect(rowsIn('Incompatible environments')).toEqual([
          `deployment-row-${D1}`,
          `deployment-row-${D9}`
        ])
      )

      await waitFor(() =>
        expect(screen.getByTestId(`deployment-row-${D1}`)).toHaveFocus()
      )
      await user.keyboard('{ArrowDown}')
      expect(screen.getByTestId(`deployment-row-${D9}`)).toHaveFocus()
    })

    it('shows one Run on list when the check fails', async () => {
      mockWorkspaceApi.checkDeploymentCompatibility.mockRejectedValue(
        new WorkspaceApiError('not found', 404)
      )
      const user = renderSwitcher()
      await openList(user)
      await waitFor(() =>
        expect(mockWorkspaceApi.checkDeploymentCompatibility).toHaveBeenCalled()
      )
      await nextTick()

      expect(rowsIn('Run on')).toHaveLength(4)
      expect(
        screen.queryByRole('group', { name: 'Compatible environments' })
      ).toBeNull()
    })
  })
})

describe('DeploymentSwitcher, starting a stopped deployment', () => {
  const staging = listing.items[1]

  function withStaging(
    status: WorkspaceDeployment['status'],
    canStart?: boolean
  ): WorkspaceDeploymentList {
    return {
      ...listing,
      items: [listing.items[0], withStatus(staging, status, canStart)]
    }
  }

  function offerStart() {
    vi.mocked(useFeatureFlags().flags).deploymentStartEnabled = true
  }

  function stagingRow() {
    return screen.getByTestId(`deployment-row-${D1}`)
  }

  beforeEach(() => {
    hoisted.rootGraph = undefined
    sessionStorage.clear()
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn(), origin: 'http://localhost' },
      writable: true,
      configurable: true
    })
  })

  it('offers Start on a stopped row, and choosing it starts the deployment instead of switching to it', async () => {
    offerStart()
    mockWorkspaceApi.listDeployments.mockResolvedValue(withStaging('stopped'))
    mockWorkspaceApi.startDeployment.mockReturnValue(new Promise(() => {}))
    const user = renderSwitcher()
    await openList(user)

    const start = screen.getByRole('menuitemradio', {
      name: 'Start Studio Build · staging'
    })
    expect(within(start).getByText('Start')).toBeVisible()
    await user.click(start)

    expect(mockWorkspaceApi.startDeployment).toHaveBeenCalledWith('ws-1', D1)
    expect(mockWorkspaceApi.pickDeployment).not.toHaveBeenCalled()
    expect(screen.getByRole('menu')).toBeVisible()
    expect(within(stagingRow()).getByText('Starting')).toBeVisible()
  })

  it('offers Start only on a row the listing says can start, whatever its status', async () => {
    offerStart()
    mockWorkspaceApi.listDeployments.mockResolvedValue(
      withStaging('stopped', false)
    )
    const user = renderSwitcher()
    await openList(user)

    expect(
      screen.queryByRole('menuitemradio', {
        name: 'Start Studio Build · staging'
      })
    ).toBeNull()
    expect(stagingRow()).toHaveAttribute('aria-disabled', 'true')
  })

  it('shows a started deployment as Starting, refreshes the open list every 5 s, and lets it be picked once ready', async () => {
    offerStart()
    let current = withStaging('stopped')
    mockWorkspaceApi.listDeployments.mockImplementation(async () => current)
    mockWorkspaceApi.startDeployment.mockImplementation(async () => {
      current = withStaging('starting')
      return { deployment_id: D1, status: 'starting' }
    })
    mockWorkspaceApi.pickDeployment.mockReturnValue(new Promise(() => {}))
    const user = renderSwitcher()
    await openList(user)

    await user.click(
      screen.getByRole('menuitemradio', {
        name: 'Start Studio Build · staging'
      })
    )
    await waitFor(() =>
      expect(within(stagingRow()).getByText('Starting')).toBeVisible()
    )
    expect(stagingRow()).toHaveAttribute('aria-disabled', 'true')

    current = withStaging('ready')
    await vi.advanceTimersByTimeAsync(DEPLOYMENT_START_POLL_MS)
    await waitFor(() =>
      expect(within(stagingRow()).getByText('v1')).toBeVisible()
    )
    expect(stagingRow()).not.toHaveAttribute('aria-disabled')
    expect(mockWorkspaceApi.pickDeployment).not.toHaveBeenCalled()

    await user.click(stagingRow())
    expect(mockWorkspaceApi.pickDeployment).toHaveBeenCalledWith('ws-1', {
      deployment_id: D1
    })
  })

  it("says why a Start failed with the server's own message, and starts again on Retry", async () => {
    offerStart()
    mockWorkspaceApi.listDeployments.mockResolvedValue(withStaging('stopped'))
    mockWorkspaceApi.startDeployment
      .mockRejectedValueOnce(
        new WorkspaceApiError(
          'The workspace has no credits left.',
          402,
          'PAYMENT_REQUIRED'
        )
      )
      .mockReturnValueOnce(new Promise(() => {}))
    const user = renderSwitcher()
    await openList(user)

    await user.click(
      screen.getByRole('menuitemradio', {
        name: 'Start Studio Build · staging'
      })
    )
    const problem = await screen.findByTestId('deployment-row-problem')
    expect(problem).toHaveTextContent(
      "Studio Build · staging didn't start. The workspace has no credits left."
    )
    expect(problem).toHaveTextContent('Add credits, then retry.')
    const retry = screen.getByRole('menuitemradio', {
      name: 'Retry starting Studio Build · staging'
    })
    expect(retry).toHaveAccessibleDescription(
      "Studio Build · staging didn't start. The workspace has no credits left. Add credits, then retry."
    )

    await user.click(retry)
    expect(mockWorkspaceApi.startDeployment).toHaveBeenCalledTimes(2)
    await waitFor(() =>
      expect(screen.queryByTestId('deployment-row-problem')).toBeNull()
    )
    expect(within(stagingRow()).getByText('Starting')).toBeVisible()
  })

  function startStaging(user: ReturnType<typeof userEvent.setup>) {
    return user.click(
      screen.getByRole('menuitemradio', {
        name: 'Start Studio Build · staging'
      })
    )
  }

  it('names the started deployment on the listing asked for after its Start', async () => {
    offerStart()
    let current = withStaging('stopped')
    mockWorkspaceApi.listDeployments.mockImplementation(async () => current)
    mockWorkspaceApi.startDeployment.mockImplementation(async () => {
      current = withStaging('queued', false)
      return { deployment_id: D1, status: 'queued' }
    })
    const user = renderSwitcher()
    await openList(user)

    await startStaging(user)

    await waitFor(() =>
      expect(mockWorkspaceApi.listDeployments).toHaveBeenLastCalledWith(
        'ws-1',
        [D1]
      )
    )
  })

  it('shows a started deployment that failed to come up as failed, and offers Start again', async () => {
    offerStart()
    let current = withStaging('stopped')
    mockWorkspaceApi.listDeployments.mockImplementation(async () => current)
    mockWorkspaceApi.startDeployment.mockImplementation(async () => {
      current = withStaging('queued')
      return { deployment_id: D1, status: 'queued' }
    })
    const user = renderSwitcher()
    await openList(user)

    await startStaging(user)
    await waitFor(() =>
      expect(within(stagingRow()).getByText('Starting')).toBeVisible()
    )
    current = withStaging('failed')
    await vi.advanceTimersByTimeAsync(DEPLOYMENT_START_POLL_MS)

    await waitFor(() =>
      expect(within(stagingRow()).getByText('Start')).toBeVisible()
    )
    expect(stagingRow()).toHaveAccessibleDescription(
      'Studio Build · staging failed. Start it again to run jobs on it.'
    )
    expect(screen.queryByTestId('deployment-row-problem')).toBeNull()
  })

  it('shows Starting until the listing asked for after the Start lands, whatever an older listing says', async () => {
    offerStart()
    const answers: ((list: WorkspaceDeploymentList) => void)[] = []
    mockWorkspaceApi.listDeployments.mockResolvedValue(withStaging('stopped'))
    let takeStart: (started: {
      deployment_id: string
      status: string
    }) => void = () => {}
    mockWorkspaceApi.startDeployment.mockReturnValue(
      new Promise((resolve) => {
        takeStart = resolve
      })
    )
    const user = renderSwitcher()
    await openList(user)
    await startStaging(user)
    mockWorkspaceApi.listDeployments.mockImplementation(
      () => new Promise((resolve) => answers.push(resolve))
    )

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_START_POLL_MS)
    takeStart({ deployment_id: D1, status: 'queued' })
    await waitFor(() => expect(answers).toHaveLength(2))
    answers[0](withStaging('stopped'))
    await vi.advanceTimersByTimeAsync(0)

    expect(within(stagingRow()).getByText('Starting')).toBeVisible()
    expect(stagingRow()).toHaveAttribute('aria-disabled', 'true')

    answers[1](withStaging('queued'))
    await vi.advanceTimersByTimeAsync(0)

    expect(within(stagingRow()).getByText('Starting')).toBeVisible()
    expect(screen.queryByTestId('deployment-row-problem')).toBeNull()
  })

  it.for([
    {
      sender: 'the concurrency cap',
      code: 'CONCURRENCY_LIMIT',
      message: 'Three deployments are already running.',
      shown: true,
      fix: 'Stop another deployment, then retry.'
    },
    {
      sender: 'a rate limit',
      code: 'RATE_LIMITED',
      message: 'Too many attempts; try again later.',
      shown: true,
      fix: 'Retry, or check it on the Developer Platform.'
    },
    {
      sender: 'a gateway',
      code: undefined,
      message: 'Request failed with status code 429',
      shown: false,
      fix: 'Retry, or check it on the Developer Platform.'
    }
  ])(
    'tells a 429 from $sender apart by its code, and shows only a message the server wrote',
    async ({ code, message, shown, fix }) => {
      offerStart()
      mockWorkspaceApi.listDeployments.mockResolvedValue(withStaging('stopped'))
      mockWorkspaceApi.startDeployment.mockRejectedValue(
        new WorkspaceApiError(message, 429, code)
      )
      const user = renderSwitcher()
      await openList(user)

      await startStaging(user)

      const problem = await screen.findByTestId('deployment-row-problem')
      expect(problem).toHaveTextContent(fix)
      expect(problem.textContent.includes(message)).toBe(shown)
    }
  )

  it.for([
    {
      failure: 'one that is not an API error',
      error: new Error('sign-in failed'),
      reported: true
    },
    {
      failure: 'a 503',
      error: new WorkspaceApiError(
        'could not start',
        503,
        'SERVICE_UNAVAILABLE'
      ),
      reported: true
    },
    {
      failure: 'a timeout',
      error: new WorkspaceApiError('timeout of 30000ms exceeded'),
      reported: true
    },
    {
      failure: 'a refusal the person can act on',
      error: new WorkspaceApiError('no credit', 402, 'PAYMENT_REQUIRED'),
      reported: false
    }
  ])(
    'reports a Start that failed with $failure only when the server gave no answer',
    async ({ error, reported }) => {
      offerStart()
      mockWorkspaceApi.listDeployments.mockResolvedValue(withStaging('stopped'))
      mockWorkspaceApi.startDeployment.mockRejectedValue(error)
      const user = renderSwitcher()
      await openList(user)

      await startStaging(user)

      await screen.findByTestId('deployment-row-problem')
      const reports = vi
        .mocked(reportError)
        .mock.calls.filter(
          ([reportedError, context]) =>
            reportedError === error &&
            context.errorType === 'error_starting_deployment'
        )
      expect(reports).toHaveLength(reported ? 1 : 0)
    }
  )

  it('waits for a slow listing before refreshing the open list again', async () => {
    offerStart()
    let current = withStaging('stopped')
    mockWorkspaceApi.listDeployments.mockImplementation(async () => current)
    mockWorkspaceApi.startDeployment.mockImplementation(async () => {
      current = withStaging('starting')
      return { deployment_id: D1, status: 'starting' }
    })
    const user = renderSwitcher()
    await openList(user)
    await startStaging(user)
    await waitFor(() =>
      expect(within(stagingRow()).getByText('Starting')).toBeVisible()
    )
    mockWorkspaceApi.listDeployments.mockReset()
    mockWorkspaceApi.listDeployments.mockReturnValue(new Promise(() => {}))

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_START_POLL_MS * 3)

    expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledTimes(1)
  })

  it('offers the Developer Platform when the server will not start it from this editor, and does not ask it again', async () => {
    offerStart()
    const openPage = vi.spyOn(window, 'open').mockReturnValue(null)
    mockWorkspaceApi.listDeployments.mockResolvedValue(withStaging('stopped'))
    mockWorkspaceApi.startDeployment.mockRejectedValue(
      new WorkspaceApiError(
        'starting a deployment needs a signed-in session, not an API key',
        403
      )
    )
    const user = renderSwitcher()
    await openList(user)

    await user.click(
      screen.getByRole('menuitemradio', {
        name: 'Start Studio Build · staging'
      })
    )
    expect(
      await screen.findByTestId('deployment-row-problem')
    ).toHaveTextContent('Start it on the Developer Platform for now.')

    await user.click(
      screen.getByRole('menuitemradio', {
        name: 'Start Studio Build · staging on the Developer Platform'
      })
    )
    expect(openPage).toHaveBeenCalledWith(
      `${getComfyPlatformBaseUrl()}/profile/deployments/${D1}?utm_source=comfyui&utm_medium=app&utm_content=deployment-switcher`,
      '_blank',
      'noopener,noreferrer'
    )
    expect(mockWorkspaceApi.startDeployment).toHaveBeenCalledTimes(1)
  })

  it.for<{
    status: WorkspaceDeployment['status']
    start: string
    offered: boolean
    tooltip: string
    notice: string
  }>([
    {
      status: 'stopped',
      start: 'offered',
      offered: true,
      tooltip:
        "Running on Studio Build · staging. It's stopped, so jobs won't run. Open this menu to start it.",
      notice:
        "Studio Build · staging is stopped, so jobs won't run. Start it, or pick a ready deployment."
    },
    {
      status: 'stopped',
      start: 'not offered',
      offered: false,
      tooltip:
        "Running on Studio Build · staging. It's stopped, so jobs won't run until it's started on the Developer Platform.",
      notice:
        "Studio Build · staging is stopped, so jobs won't run. Start it, or pick a ready deployment."
    },
    {
      status: 'failed',
      start: 'offered',
      offered: true,
      tooltip:
        "Running on Studio Build · staging. It failed, so jobs won't run. Open this menu to start it again.",
      notice:
        "Studio Build · staging failed, so jobs won't run. Start it again, or pick a ready deployment."
    }
  ])(
    'says jobs will not run on a $status deployment this browser is on, on hover and at the top of the list, with Start $start',
    async ({ status, offered, tooltip, notice }) => {
      if (offered) offerStart()
      mockWorkspaceApi.listDeployments.mockResolvedValue({
        ...withStaging(status),
        picked_deployment_id: D1,
        pick_source: 'browser'
      })
      const user = renderSwitcher()
      const trigger = await screen.findByTestId('deployment-switcher-trigger')

      await user.hover(trigger)
      expect(await screen.findByRole('tooltip')).toHaveTextContent(tooltip)
      await openList(user)

      expect(
        screen.getByTestId('deployment-switcher-notice')
      ).toHaveTextContent(notice)
    }
  )
})

describe('DeploymentSwitcher with Platform in the editor', () => {
  beforeEach(() => {
    hoisted.rootGraph = undefined
    distribution.isCloud = true
    sessionStorage.clear()
    useSettingStore().$patch({
      settingValues: { 'Comfy.DeploymentSwitcher.Seen': true }
    })
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    const platformFrame = usePlatformFrameStore()
    onTestFinished(() => platformFrame.close())
  })

  function framedAt() {
    const url = usePlatformFrameStore().session?.url
    return url ? Object.fromEntries(new URL(url).searchParams) : null
  }

  it.for([
    { flag: true, pencils: 1 },
    { flag: false, pencils: 0 }
  ])(
    'puts the update pencil on a deployment row only with the flag on: $flag',
    async ({ flag, pencils }) => {
      Object.assign(useFeatureFlags().flags, {
        customDeploymentsEditorEnabled: flag
      })
      mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
      const user = renderSwitcher()
      await openList(user)

      expect(
        within(screen.getByTestId(`deployment-row-${D2}`)).queryAllByTestId(
          'deployment-row-edit'
        )
      ).toHaveLength(pencils)
      expect(
        within(screen.getByTestId('deployment-row-cloud')).queryAllByTestId(
          'deployment-row-edit'
        )
      ).toHaveLength(0)
    }
  )

  it('opens the update for that deployment from its pencil, without switching to it', async () => {
    Object.assign(useFeatureFlags().flags, {
      customDeploymentsEditorEnabled: true
    })
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    const user = renderSwitcher()
    await openList(user)

    const pencil = within(
      screen.getByTestId(`deployment-row-${D2}`)
    ).getByTestId('deployment-row-edit')
    expect(pencil).toHaveAccessibleName('Update Studio Build')

    await user.click(pencil)

    expect(framedAt()).toMatchObject({
      step: 'update',
      deployment: D2
    })
    expect(mockWorkspaceApi.pickDeployment).not.toHaveBeenCalled()
    expect(useDialogStore().dialogStack).toHaveLength(0)
  })

  it('opens the update from the keyboard with E on a deployment row', async () => {
    Object.assign(useFeatureFlags().flags, {
      customDeploymentsEditorEnabled: true
    })
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    const user = renderSwitcher()
    await openList(user)

    const row = screen.getByTestId(`deployment-row-${D2}`)
    expect(row).toHaveAttribute('aria-keyshortcuts', 'E')
    expect(row).toHaveAccessibleDescription(
      expect.stringContaining('Press E to update it.')
    )
    row.focus()
    await user.keyboard('e')

    expect(framedAt()).toMatchObject({
      step: 'update',
      deployment: D2
    })
    expect(mockWorkspaceApi.pickDeployment).not.toHaveBeenCalled()
  })

  it.for([
    { way: 'E on a deployment row', item: 'row' },
    { way: 'Enter on Create a Custom Build', item: 'create' }
  ])(
    'returns focus to Run on when the frame opened with $way closes',
    async ({ item }) => {
      Object.assign(useFeatureFlags().flags, {
        customDeploymentsEditorEnabled: true
      })
      mockWorkspaceApi.listDeployments.mockResolvedValue(
        item === 'row' ? listing : { ...listing, items: [] }
      )
      const user = userEvent.setup({ pointerEventsCheck: 0 })
      render(
        {
          components: { DeploymentSwitcher, PlatformFrameHost },
          template: '<DeploymentSwitcher /><PlatformFrameHost />'
        },
        { global: { plugins: [i18n] } }
      )
      await openList(user)
      const focused =
        item === 'row'
          ? screen.getByTestId(`deployment-row-${D2}`)
          : screen.getByRole('menuitem', { name: 'Create a Custom Build' })
      focused.focus()
      await waitFor(() => expect(focused).toHaveFocus())

      await user.keyboard(item === 'row' ? 'e' : '{Enter}')
      const frame = await screen.findByTestId('platform-frame')
      await waitFor(() => expect(frame).toHaveFocus())
      await user.click(screen.getByRole('button', { name: 'Close' }))

      await waitFor(() =>
        expect(screen.getByTestId('deployment-switcher-trigger')).toHaveFocus()
      )
    }
  )

  it('leaves E alone on the Comfy Cloud row', async () => {
    Object.assign(useFeatureFlags().flags, {
      customDeploymentsEditorEnabled: true
    })
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    const user = renderSwitcher()
    await openList(user)

    const row = screen.getByTestId('deployment-row-cloud')
    expect(row).not.toHaveAttribute('aria-keyshortcuts')
    row.focus()
    await user.keyboard('e')

    expect(framedAt()).toBeNull()
  })

  const unhealthyListing: WorkspaceDeploymentList = {
    ...listing,
    items: [listing.items[0], withStatus(listing.items[1], 'failed', false)]
  }

  it('reaches the update of a deployment that cannot start with the arrow keys and E, while it still cannot be picked', async () => {
    Object.assign(useFeatureFlags().flags, {
      customDeploymentsEditorEnabled: true
    })
    mockWorkspaceApi.listDeployments.mockResolvedValue(unhealthyListing)
    const user = renderSwitcher()
    await openList(user)
    const production = screen.getByTestId(`deployment-row-${D2}`)
    const unhealthy = screen.getByTestId(`deployment-row-${D1}`)
    production.focus()
    await waitFor(() => expect(production).toHaveFocus())

    await user.keyboard('{ArrowDown}')
    expect(unhealthy).toHaveFocus()
    expect(unhealthy).toHaveAttribute('aria-disabled', 'true')

    await user.keyboard('{Enter}')
    expect(mockWorkspaceApi.pickDeployment).not.toHaveBeenCalled()
    expect(mockWorkspaceApi.startDeployment).not.toHaveBeenCalled()
    expect(screen.getByRole('menu')).toBeVisible()

    await user.keyboard('e')
    expect(framedAt()).toMatchObject({ step: 'update', deployment: D1 })
  })

  it('highlights a deployment that cannot start on hover, so its pencil shows and opens the update', async () => {
    Object.assign(useFeatureFlags().flags, {
      customDeploymentsEditorEnabled: true
    })
    mockWorkspaceApi.listDeployments.mockResolvedValue(unhealthyListing)
    const user = renderSwitcher()
    await openList(user)
    const unhealthy = screen.getByTestId(`deployment-row-${D1}`)

    await user.hover(unhealthy)
    expect(unhealthy).toHaveFocus()

    await user.click(within(unhealthy).getByTestId('deployment-row-edit'))
    expect(framedAt()).toMatchObject({ step: 'update', deployment: D1 })
    expect(mockWorkspaceApi.pickDeployment).not.toHaveBeenCalled()
  })

  it('opens a new deployment at its nodes from Create a Custom Build', async () => {
    Object.assign(useFeatureFlags().flags, {
      customDeploymentsEditorEnabled: true
    })
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      items: []
    })
    const user = renderSwitcher()
    await openList(user)

    await user.click(
      screen.getByRole('menuitem', { name: 'Create a Custom Build' })
    )

    expect(framedAt()).toMatchObject({ step: 'new', start: 'nodes' })
    expect(
      useDialogStore().isDialogOpen('global-create-custom-deployment')
    ).toBe(false)
    expect(usePlatformFrameStore().session?.url).toMatch(
      new RegExp(`^${escapeRegExp(getComfyPlatformBaseUrl())}/embed/`)
    )
  })

  function following(stage: BuildStage, progress: FollowedBuild['progress']) {
    Object.assign(usePlatformFrameStore(), {
      build: {
        kind: 'update',
        buildId: 'b-1',
        accountId: 'uid-ana',
        workspaceId: 'ws-1',
        deploymentId: D2,
        deploymentName: 'production',
        releaseId: 'r-2',
        version: 3,
        previousReleaseId: 'r-1',
        previousVersion: 2,
        stage,
        progress,
        startedAt: 0
      } satisfies FollowedBuild
    })
  }

  it.for([
    {
      stage: 'building',
      progress: { step: 3, of: 5 },
      text: 'Building production Step 3 of 5'
    },
    { stage: 'building', progress: null, text: 'Building production' },
    { stage: 'deploying', progress: null, text: 'Deploying production' }
  ] as const)(
    'turns Run on into a spinner that names the stage on hover: $text',
    async ({ stage, progress, text }) => {
      mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
      following(stage, progress)
      const user = renderSwitcher()
      const trigger = await screen.findByTestId('deployment-switcher-trigger')

      expect(
        within(trigger).getByTestId('deployment-switcher-building')
      ).toBeInTheDocument()
      await user.hover(trigger)
      expect(await screen.findByRole('tooltip')).toHaveTextContent(text)
    }
  )

  it('shows the build step apart from the stage, after the deployment name', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    following('building', { step: 2, of: 5 })
    const user = renderSwitcher()
    await user.hover(await screen.findByTestId('deployment-switcher-trigger'))

    expect(
      await screen.findByTestId('deployment-switcher-build-step')
    ).toHaveTextContent(/^Step 2 of 5$/)
    expect(await screen.findByRole('tooltip')).not.toHaveTextContent('·')
  })

  it('spins the row of the deployment being built', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    following('building', null)
    const user = renderSwitcher()
    await openList(user)

    expect(
      within(screen.getByTestId(`deployment-row-${D2}`)).queryAllByTestId(
        'deployment-row-spinner'
      )
    ).toHaveLength(1)
    expect(
      within(screen.getByTestId(`deployment-row-${D1}`)).queryAllByTestId(
        'deployment-row-spinner'
      )
    ).toHaveLength(0)
  })

  it('keeps the update pencil on the row being built beside its spinner', async () => {
    Object.assign(useFeatureFlags().flags, {
      customDeploymentsEditorEnabled: true
    })
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    following('building', null)
    const user = renderSwitcher()
    await openList(user)

    const row = within(screen.getByTestId(`deployment-row-${D2}`))
    expect(row.getByTestId('deployment-row-spinner')).toBeInTheDocument()
    expect(row.getByTestId('deployment-row-edit')).toHaveAccessibleName(
      'Update Studio Build'
    )
  })

  it.for([
    { stage: 'building', deploymentId: '' },
    { stage: 'deploying', deploymentId: 'dep-c4c4c4c4' }
  ] as const)(
    'lists the first deployment while $stage, unpickable, instead of saying there are none',
    async ({ stage, deploymentId }) => {
      mockWorkspaceApi.listDeployments.mockResolvedValue({
        ...listing,
        items: []
      })
      Object.assign(usePlatformFrameStore(), {
        build: {
          kind: 'new',
          buildId: 'b-4',
          accountId: 'uid-ana',
          workspaceId: 'ws-1',
          deploymentId,
          deploymentName: 'lora-stack-demo',
          releaseId: 'r-4',
          version: 1,
          previousReleaseId: null,
          previousVersion: null,
          stage,
          progress: null,
          startedAt: 0
        } satisfies FollowedBuild
      })
      const user = renderSwitcher()
      await openList(user)

      expect(screen.queryByTestId('deployment-switcher-empty')).toBeNull()
      const row = screen.getByRole('menuitemradio', {
        name: /lora-stack-demo/
      })
      expect(row).toHaveTextContent('Building')
      expect(row).toHaveAttribute('aria-checked', 'false')

      await user.click(row)

      expect(mockWorkspaceApi.pickDeployment).not.toHaveBeenCalled()
    }
  )

  const INTENDED = 'dep-c4c4c4c4-0000-4000-8000-000000000004'
  const SIBLING = 'dep-c5c5c5c5-0000-4000-8000-000000000005'
  const PLACEHOLDER = 'b-4'

  function firstBuildDeployment(
    deployment_id: string,
    deployment_name: string,
    created_at: string
  ): WorkspaceDeployment {
    return {
      deployment_id,
      deployment_name,
      release_id: 'r-4',
      release_version: 1,
      status: 'queued',
      can_start: false,
      created_at
    }
  }

  const intendedListed = firstBuildDeployment(
    INTENDED,
    'lora-stack-demo',
    '2026-11-25T00:00:00Z'
  )
  const siblingListed = firstBuildDeployment(
    SIBLING,
    'lora-stack-staging',
    '2026-11-25T00:01:00Z'
  )

  function spinnersByRow(): Record<string, number | null> {
    return Object.fromEntries(
      [INTENDED, SIBLING, PLACEHOLDER].map((id) => {
        const row = screen.queryByTestId(`deployment-row-${id}`)
        return [
          id,
          row === null
            ? null
            : within(row).queryAllByTestId('deployment-row-spinner').length
        ]
      })
    )
  }

  it.for<{
    when: string
    listed: WorkspaceDeployment[]
    deploymentId: string
    deploymentName: string
    spinners: Record<string, number | null>
  }>([
    {
      when: 'nothing is listed yet',
      listed: [],
      deploymentId: '',
      deploymentName: 'lora-stack-demo',
      spinners: { [INTENDED]: null, [SIBLING]: null, [PLACEHOLDER]: 1 }
    },
    {
      when: 'its deployment is listed before deploy-sent names it',
      listed: [intendedListed],
      deploymentId: '',
      deploymentName: 'lora-stack-demo',
      spinners: { [INTENDED]: 1, [SIBLING]: null, [PLACEHOLDER]: null }
    },
    {
      when: 'another deployment of its release is listed first',
      listed: [siblingListed, intendedListed],
      deploymentId: '',
      deploymentName: 'lora-stack-demo',
      spinners: { [INTENDED]: 1, [SIBLING]: 0, [PLACEHOLDER]: null }
    },
    {
      when: 'only another deployment of its release is listed',
      listed: [siblingListed],
      deploymentId: '',
      deploymentName: 'lora-stack-demo',
      spinners: { [INTENDED]: null, [SIBLING]: 0, [PLACEHOLDER]: 1 }
    },
    {
      when: 'deploy-sent names its deployment',
      listed: [siblingListed, intendedListed],
      deploymentId: INTENDED,
      deploymentName: 'lora-stack-demo',
      spinners: { [INTENDED]: 1, [SIBLING]: 0, [PLACEHOLDER]: null }
    },
    {
      when: 'it has no name to match before deploy-sent',
      listed: [siblingListed],
      deploymentId: '',
      deploymentName: '',
      spinners: { [INTENDED]: null, [SIBLING]: 0, [PLACEHOLDER]: 1 }
    }
  ])(
    'spins only the first build of its own deployment when $when',
    async ({ listed, deploymentId, deploymentName, spinners }) => {
      mockWorkspaceApi.listDeployments.mockResolvedValue({
        ...listing,
        items: [...listing.items, ...listed]
      })
      Object.assign(usePlatformFrameStore(), {
        build: {
          kind: 'new',
          buildId: PLACEHOLDER,
          accountId: 'uid-ana',
          workspaceId: 'ws-1',
          deploymentId,
          deploymentName,
          releaseId: 'r-4',
          version: 1,
          previousReleaseId: null,
          previousVersion: null,
          stage: deploymentId ? 'deploying' : 'building',
          progress: null,
          startedAt: 0
        } satisfies FollowedBuild
      })
      const user = renderSwitcher()
      await openList(user)

      expect(spinnersByRow()).toEqual(spinners)
    }
  )

  function followFirstBuild(deploymentId: string, deploymentName: string) {
    Object.assign(usePlatformFrameStore(), {
      build: {
        kind: 'new',
        buildId: PLACEHOLDER,
        accountId: 'uid-ana',
        workspaceId: 'ws-1',
        deploymentId,
        deploymentName,
        releaseId: 'r-4',
        version: 1,
        previousReleaseId: null,
        previousVersion: null,
        stage: deploymentId ? 'deploying' : 'building',
        progress: null,
        startedAt: 0
      } satisfies FollowedBuild
    })
  }

  it.for([
    {
      offers: 'offers no',
      when: 'before deploy-sent',
      deploymentId: '',
      pencils: 0,
      keys: null
    },
    {
      offers: 'offers an',
      when: 'once deploy-sent names its deployment',
      deploymentId: INTENDED,
      pencils: 1,
      keys: 'E'
    }
  ])(
    '$offers update on the Building row $when',
    async ({ deploymentId, pencils, keys }) => {
      Object.assign(useFeatureFlags().flags, {
        customDeploymentsEditorEnabled: true
      })
      mockWorkspaceApi.listDeployments.mockResolvedValue({
        ...listing,
        items: []
      })
      followFirstBuild(deploymentId, 'lora-stack-demo')
      const user = renderSwitcher()
      await openList(user)

      const row = screen.getByTestId(
        `deployment-row-${deploymentId || PLACEHOLDER}`
      )
      expect(within(row).queryAllByTestId('deployment-row-edit')).toHaveLength(
        pencils
      )
      expect(row.getAttribute('aria-keyshortcuts')).toBe(keys)
    }
  )

  it('opens no update with E on the Building row before deploy-sent', async () => {
    Object.assign(useFeatureFlags().flags, {
      customDeploymentsEditorEnabled: true
    })
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      items: []
    })
    followFirstBuild('', 'lora-stack-demo')
    const open = vi.spyOn(usePlatformFrameStore(), 'open')
    const user = renderSwitcher()
    await openList(user)

    screen.getByTestId(`deployment-row-${PLACEHOLDER}`).focus()
    await user.keyboard('e')

    expect(open).not.toHaveBeenCalled()
    expect(framedAt()).toBeNull()
  })

  it('names a Building row with no deployment name yet New deployment', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue({
      ...listing,
      items: []
    })
    followFirstBuild('', '')
    const user = renderSwitcher()
    await openList(user)

    const row = screen.getByTestId(`deployment-row-${PLACEHOLDER}`)
    expect(row).toHaveTextContent(/^New deployment/)
    expect(row).toHaveAccessibleDescription(
      "New deployment isn't ready. Pick it once it's ready."
    )
  })

  it('shows the usual status again once a build fails', async () => {
    mockWorkspaceApi.listDeployments.mockResolvedValue(listing)
    following('failed', null)
    renderSwitcher()
    const trigger = await screen.findByTestId('deployment-switcher-trigger')

    expect(
      within(trigger).queryByTestId('deployment-switcher-building')
    ).toBeNull()
  })
})
