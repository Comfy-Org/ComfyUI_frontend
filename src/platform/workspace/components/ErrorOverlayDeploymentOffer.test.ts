import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ErrorGroup } from '@/components/rightSidePanel/errors/types'
import type {
  MissingPackGroup,
  SwapNodeGroup
} from '@/components/rightSidePanel/errors/useErrorGroups'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { createTestRootGraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import enMessages from '@/locales/en/main.json'
import type { MissingMediaGroup } from '@/platform/workflowErrors/missingMedia/types'
import type { MissingModelGroup } from '@/platform/workflowErrors/missingModel/types'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'
import type {
  DeploymentCompatibility,
  WorkspaceDeployment
} from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type { DeploymentPickState } from '@/platform/workspace/deploymentPickState'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

import ErrorOverlay from '@/components/error/ErrorOverlay.vue'

const hoisted = vi.hoisted(() => ({
  rootGraph: undefined as unknown,
  errorGroups: {
    allErrorGroups: { value: [] as ErrorGroup[] },
    missingPackGroups: { value: [] as MissingPackGroup[] },
    missingModelGroups: { value: [] as MissingModelGroup[] },
    missingMediaGroups: { value: [] as MissingMediaGroup[] },
    swapNodeGroups: { value: [] as SwapNodeGroup[] }
  }
}))

vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

vi.mock<unknown>(
  import('@/components/rightSidePanel/errors/useErrorGroups'),
  () => ({
    useErrorGroups: () => hoisted.errorGroups
  })
)

vi.mock(import('@/composables/graph/useNodeErrorFlagSync'), () => ({
  useNodeErrorFlagSync: vi.fn()
}))

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

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const RGTHREE = 'Power Lora Loader (rgthree)'

function workflowWith(...types: string[]): LGraph {
  const root = createTestRootGraph()
  for (const type of types) root.add(new LGraphNode(type, type))
  return root
}

function deployment(id: string, build: string): WorkspaceDeployment {
  return {
    deployment_id: id,
    release_id: `r-${id}`,
    build_id: `b-${id}`,
    build_name: build,
    release_version: 2,
    status: 'ready',
    created_at: '2026-10-01T00:00:00Z'
  }
}

const agencyA = deployment('dep-agency-a', 'Agency A krea')
const agencyB = deployment('dep-agency-b', 'Agency B flux')
const agencyC = deployment('dep-agency-c', 'Agency C wan')
const plain = deployment('dep-plain', 'Plain')

function readyOn(
  deployments: WorkspaceDeployment[],
  pickedDeploymentId: string | null = plain.deployment_id
): DeploymentPickState {
  return {
    phase: 'ready',
    deployments,
    pickedDeploymentId,
    pickSource: 'browser',
    defaultDeploymentId: null,
    gonePickedDeploymentId: null,
    goneDefaultDeploymentId: null,
    buildsVisible: true
  }
}

function onComfyCloud(deployments: WorkspaceDeployment[]) {
  const store = useDeploymentPickStore()
  store.state = readyOn(deployments, null)
  store.bootDeployment = null
}

const NO_REPLACEMENT: MissingNodeType[] = [
  { type: RGTHREE, cnrId: 'rgthree-comfy', isReplaceable: false }
]

function answer(
  runIt: WorkspaceDeployment[],
  missing: WorkspaceDeployment[]
): DeploymentCompatibility {
  return {
    deployments: [
      ...runIt.map((d) => ({
        deployment_id: d.deployment_id,
        missing_node_types: [],
        unknown: false
      })),
      ...missing.map((d) => ({
        deployment_id: d.deployment_id,
        missing_node_types: [RGTHREE],
        unknown: false
      }))
    ],
    cloud: { missing_node_types: [RGTHREE] }
  }
}

const missingNodeGroup: ErrorGroup = {
  type: 'missing_node',
  severity: 'missing',
  groupKey: 'missing_node',
  displayTitle: `${RGTHREE} isn't on Plain v2`,
  toastMessage: 'Replace this node, or pick a deployment that has it.',
  count: 1,
  priority: 0,
  blockedLastRun: false
}

function renderNotice() {
  useExecutionErrorStore().showErrorOverlay()
  return render(ErrorOverlay, { global: { plugins: [i18n] } })
}

async function compatibilityAnswered() {
  await waitFor(() =>
    expect(workspaceApi.checkDeploymentCompatibility).toHaveBeenCalled()
  )
  await Promise.allSettled(
    vi
      .mocked(workspaceApi.checkDeploymentCompatibility)
      .mock.results.map((result) => result.value)
  )
  await nextTick()
}

function expectNoticeAsToday() {
  const notice = screen.getByTestId('error-overlay')
  expect(screen.queryByTestId('error-overlay-deployment-offer')).toBeNull()
  expect(
    within(notice)
      .getAllByRole('button')
      .map((button) => button.textContent.trim())
  ).toEqual(['View details', ''])
}

function customDeploymentOffer() {
  return screen.queryByTestId('error-overlay-custom-deployment-offer')
}

describe('ErrorOverlay deployment offer', () => {
  const reload = vi.fn()

  beforeEach(() => {
    hoisted.rootGraph = workflowWith('KSampler', RGTHREE)
    hoisted.errorGroups.allErrorGroups.value = [missingNodeGroup]
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    vi.mocked(useFeatureFlags().flags).deploymentCompatibilityMarksEnabled =
      true
    Object.defineProperty(window, 'location', {
      value: { reload, origin: 'http://localhost' },
      writable: true,
      configurable: true
    })
  })

  it('names the deployment that has every node, and Switch picks it and reloads', async () => {
    useDeploymentPickStore().state = readyOn([plain, agencyA])
    vi.mocked(workspaceApi.checkDeploymentCompatibility).mockResolvedValue(
      answer([agencyA], [plain])
    )
    renderNotice()

    const offer = await screen.findByTestId('error-overlay-deployment-offer')
    expect(offer).toHaveTextContent('Runs on Agency A krea · dep-agency-a')
    expect(within(offer).queryByRole('button', { name: /more/ })).toBeNull()

    await userEvent.click(within(offer).getByRole('button', { name: 'Switch' }))

    expect(workspaceApi.pickDeployment).toHaveBeenCalledWith('ws-1', {
      deployment_id: agencyA.deployment_id
    })
    expect(reload).toHaveBeenCalledOnce()
  })

  it('names the first of several and opens the switcher for the rest', async () => {
    useDeploymentPickStore().state = readyOn([plain, agencyA, agencyB, agencyC])
    vi.mocked(workspaceApi.checkDeploymentCompatibility).mockResolvedValue(
      answer([agencyA, agencyB, agencyC], [plain])
    )
    renderNotice()

    const offer = await screen.findByTestId('error-overlay-deployment-offer')
    expect(offer).toHaveTextContent('Runs on Agency A krea · dep-agency-a')

    await userEvent.click(within(offer).getByRole('button', { name: '2 more' }))

    expect(useDeploymentPickStore().switcherOpenAsks).toBe(1)
    expect(workspaceApi.pickDeployment).not.toHaveBeenCalled()
  })

  it.for([
    {
      when: 'no deployment has every node',
      state: readyOn([plain, agencyA]),
      check: () => Promise.resolve(answer([], [plain, agencyA]))
    },
    {
      when: 'the compatibility check fails',
      state: readyOn([plain, agencyA]),
      check: () => Promise.reject(new Error('404'))
    }
  ])('leaves the notice as it was when $when', async (scenario) => {
    useDeploymentPickStore().state = scenario.state
    vi.mocked(workspaceApi.checkDeploymentCompatibility).mockImplementation(
      scenario.check
    )
    renderNotice()
    await compatibilityAnswered()

    expectNoticeAsToday()
  })

  it('leaves the notice as it was and sends no check when the switcher is not shown', async () => {
    useDeploymentPickStore().state = { phase: 'hidden' }
    vi.mocked(workspaceApi.checkDeploymentCompatibility).mockResolvedValue(
      answer([agencyA], [plain])
    )
    renderNotice()
    await nextTick()

    expect(workspaceApi.checkDeploymentCompatibility).not.toHaveBeenCalled()
    expectNoticeAsToday()
  })

  it('offers no deployment and sends no check when the notice is not about missing nodes', async () => {
    hoisted.errorGroups.allErrorGroups.value = [
      { ...missingNodeGroup, type: 'missing_model', groupKey: 'missing_model' }
    ]
    useDeploymentPickStore().state = readyOn([plain, agencyA])
    vi.mocked(workspaceApi.checkDeploymentCompatibility).mockResolvedValue(
      answer([agencyA], [plain])
    )
    renderNotice()
    await nextTick()

    expect(workspaceApi.checkDeploymentCompatibility).not.toHaveBeenCalled()
    expectNoticeAsToday()
  })

  it('offers a custom deployment on Comfy Cloud for missing nodes with no replacement, and Set up opens it', async () => {
    onComfyCloud([])
    useMissingNodesErrorStore().setMissingNodeTypes(NO_REPLACEMENT)
    renderNotice()

    const offer = await screen.findByTestId(
      'error-overlay-custom-deployment-offer'
    )
    expect(offer).toHaveTextContent('Run it on a custom deployment')

    await userEvent.click(within(offer).getByRole('button', { name: 'Set up' }))

    await waitFor(() =>
      expect(
        useDialogStore().isDialogOpen('global-workflow-needs-deployment')
      ).toBe(true)
    )
    expect(screen.getByTestId('error-overlay')).toBeInTheDocument()
  })

  it('waits for the check to find no deployment runs the workflow before offering a custom deployment', async () => {
    onComfyCloud([plain, agencyA])
    useMissingNodesErrorStore().setMissingNodeTypes(NO_REPLACEMENT)
    let answerCheck: (compatibility: DeploymentCompatibility) => void = () => {}
    vi.mocked(workspaceApi.checkDeploymentCompatibility).mockReturnValue(
      new Promise((resolve) => {
        answerCheck = resolve
      })
    )
    renderNotice()
    await waitFor(() =>
      expect(workspaceApi.checkDeploymentCompatibility).toHaveBeenCalled()
    )
    expect(customDeploymentOffer()).toBeNull()

    answerCheck(answer([], [plain, agencyA]))

    expect(
      await screen.findByTestId('error-overlay-custom-deployment-offer')
    ).toHaveTextContent('Run it on a custom deployment')
  })

  it('offers no custom deployment to a workspace with deployments when the check fails', async () => {
    onComfyCloud([plain, agencyA])
    useMissingNodesErrorStore().setMissingNodeTypes(NO_REPLACEMENT)
    vi.mocked(workspaceApi.checkDeploymentCompatibility).mockRejectedValue(
      new Error('404')
    )
    renderNotice()
    await compatibilityAnswered()

    expect(customDeploymentOffer()).toBeNull()
  })

  it.for([
    {
      finds: 'a deployment it could not check',
      compatibility: {
        deployments: [
          {
            deployment_id: plain.deployment_id,
            missing_node_types: [RGTHREE],
            unknown: false
          },
          {
            deployment_id: agencyA.deployment_id,
            missing_node_types: [],
            unknown: true
          }
        ],
        cloud: { missing_node_types: [RGTHREE] }
      }
    },
    {
      finds: 'an answer that leaves a deployment out',
      compatibility: answer([], [plain])
    },
    {
      finds: 'that Comfy Cloud runs the workflow',
      compatibility: {
        ...answer([], [plain, agencyA]),
        cloud: { missing_node_types: [] }
      }
    }
  ] satisfies {
    finds: string
    compatibility: DeploymentCompatibility
  }[])(
    'offers no custom deployment when the check finds $finds',
    async ({ compatibility }) => {
      onComfyCloud([plain, agencyA])
      useMissingNodesErrorStore().setMissingNodeTypes(NO_REPLACEMENT)
      vi.mocked(workspaceApi.checkDeploymentCompatibility).mockResolvedValue(
        compatibility
      )
      renderNotice()
      await compatibilityAnswered()

      expect(customDeploymentOffer()).toBeNull()
    }
  )

  it('offers Switch instead of a custom deployment when a deployment runs the workflow', async () => {
    onComfyCloud([plain, agencyA])
    useMissingNodesErrorStore().setMissingNodeTypes(NO_REPLACEMENT)
    vi.mocked(workspaceApi.checkDeploymentCompatibility).mockResolvedValue(
      answer([agencyA], [plain])
    )
    renderNotice()

    await screen.findByTestId('error-overlay-deployment-offer')
    expect(customDeploymentOffer()).toBeNull()
  })

  it.for([
    {
      when: 'the editor runs on a deployment',
      listing: () => {
        useDeploymentPickStore().state = readyOn([plain])
        useDeploymentPickStore().bootDeployment = plain
      },
      nodes: NO_REPLACEMENT
    },
    {
      when: 'the deployments listing was not served',
      listing: () => {
        useDeploymentPickStore().state = { phase: 'hidden' }
        useDeploymentPickStore().bootDeployment = null
      },
      nodes: NO_REPLACEMENT
    },
    {
      when: 'every missing node has a replacement',
      listing: () => onComfyCloud([]),
      nodes: [{ type: 'OldSampler', isReplaceable: true }]
    }
  ] satisfies {
    when: string
    listing: () => void
    nodes: MissingNodeType[]
  }[])('offers no custom deployment when $when', async ({ listing, nodes }) => {
    listing()
    useMissingNodesErrorStore().setMissingNodeTypes(nodes)
    vi.mocked(workspaceApi.checkDeploymentCompatibility).mockResolvedValue(
      answer([], [plain])
    )
    renderNotice()
    await nextTick()

    expect(customDeploymentOffer()).toBeNull()
  })
})
