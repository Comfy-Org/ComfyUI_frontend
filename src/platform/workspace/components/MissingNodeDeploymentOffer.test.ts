import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { createTestRootGraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import enMessages from '@/locales/en/main.json'
import { useToast } from '@/components/ui/toast/toastStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { takeLeavePromptSkip } from '@/platform/workflow/management/leavePrompt'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type {
  DeploymentCompatibility,
  WorkspaceDeployment
} from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type { DeploymentPickState } from '@/platform/workspace/deploymentPickState'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogService } from '@/services/dialogService'

import MissingNodeDeploymentOffer from './MissingNodeDeploymentOffer.vue'

vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/services/dialogService'))
vi.mock(import('@/platform/workflow/core/services/workflowService'))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

const hoisted = vi.hoisted(() => ({
  rootGraph: undefined as unknown
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
const agencyD = deployment('dep-agency-d', 'Agency D sdxl')
const plain = deployment('dep-plain', 'Plain')

function readyOn(
  deployments: WorkspaceDeployment[],
  pickedDeploymentId: string | null = plain.deployment_id
): DeploymentPickState {
  return {
    phase: 'ready',
    deployments,
    pickedDeploymentId,
    pickSource: pickedDeploymentId === null ? null : 'browser',
    defaultDeploymentId: null,
    gonePickedDeploymentId: null,
    goneDefaultDeploymentId: null,
    buildsVisible: true
  }
}

function answer(
  runIt: WorkspaceDeployment[],
  missing: WorkspaceDeployment[],
  cloudRunsIt = false
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
    cloud: { missing_node_types: cloudRunsIt ? [] : [RGTHREE] }
  }
}

function renderOffer() {
  return render(MissingNodeDeploymentOffer, { global: { plugins: [i18n] } })
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

describe('MissingNodeDeploymentOffer', () => {
  const reload = vi.fn()

  beforeEach(() => {
    hoisted.rootGraph = workflowWith('KSampler', RGTHREE)
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    vi.mocked(useFeatureFlags().flags).deploymentCompatibilityMarksEnabled =
      true
    Object.defineProperty(window, 'location', {
      value: { reload, origin: 'http://localhost' },
      writable: true,
      configurable: true
    })
  })

  it('offers the deployment that has every node, and choosing it picks it and reloads', async () => {
    useDeploymentPickStore().state = readyOn([plain, agencyA])
    vi.mocked(workspaceApi.checkDeploymentCompatibility).mockResolvedValue(
      answer([agencyA], [plain])
    )
    renderOffer()

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Agency A krea · dep-agency-a'
      })
    )

    expect(
      screen.getByTestId('missing-node-deployment-offer')
    ).toHaveTextContent('Runs on:')
    expect(workspaceApi.pickDeployment).toHaveBeenCalledWith('ws-1', {
      deployment_id: agencyA.deployment_id
    })
    expect(reload).toHaveBeenCalledOnce()
    expect(useDialogService().confirm).not.toHaveBeenCalled()
  })

  describe('with unsaved workflows', () => {
    const portrait = fromPartial<ComfyWorkflow>({
      path: 'workflows/portrait.json',
      isLoaded: true,
      isModified: true
    })
    const offeredAgencyA = () =>
      screen.findByRole('button', { name: 'Agency A krea · dep-agency-a' })

    beforeEach(() => {
      takeLeavePromptSkip()
      Object.assign(useWorkflowStore(), { modifiedWorkflows: [portrait] })
      vi.mocked(useWorkflowService().saveWorkflow).mockResolvedValue(true)
      useDeploymentPickStore().state = readyOn([plain, agencyA])
      vi.mocked(workspaceApi.checkDeploymentCompatibility).mockResolvedValue(
        answer([agencyA], [plain])
      )
    })

    it('asks to save them first, the same as the Run-bar switcher, and changes nothing on Cancel', async () => {
      vi.mocked(useDialogService().confirm).mockResolvedValueOnce(null)
      renderOffer()

      await userEvent.click(await offeredAgencyA())

      await waitFor(() =>
        expect(useDialogService().confirm).toHaveBeenCalledWith(
          expect.objectContaining({
            message:
              "Switching to Agency A krea · dep-agency-a reloads the tab. These workflows have changes that aren't saved yet.",
            itemList: ['workflows/portrait.json']
          })
        )
      )
      expect(workspaceApi.pickDeployment).not.toHaveBeenCalled()
      expect(reload).not.toHaveBeenCalled()
      expect(takeLeavePromptSkip()).toBe(false)
    })

    it.for([
      { choice: 'Save and switch', answer: true, saved: [portrait] },
      { choice: 'Switch without saving', answer: false, saved: [] }
    ])(
      'switches on $choice, and that reload skips the leave prompt',
      async ({ answer, saved }) => {
        vi.mocked(useDialogService().confirm).mockResolvedValueOnce(answer)
        renderOffer()

        await userEvent.click(await offeredAgencyA())

        await waitFor(() => expect(reload).toHaveBeenCalledOnce())
        expect(
          vi
            .mocked(useWorkflowService().saveWorkflow)
            .mock.calls.map(([workflow]) => workflow)
        ).toEqual(saved)
        expect(workspaceApi.pickDeployment).toHaveBeenCalledWith('ws-1', {
          deployment_id: agencyA.deployment_id
        })
        expect(takeLeavePromptSkip()).toBe(true)
      }
    )
  })

  it('offers Comfy Cloud when it has every node, and never the deployment this browser runs on', async () => {
    useDeploymentPickStore().state = readyOn(
      [plain, agencyA],
      agencyA.deployment_id
    )
    vi.mocked(workspaceApi.checkDeploymentCompatibility).mockResolvedValue(
      answer([plain, agencyA], [], true)
    )
    renderOffer()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Comfy Cloud' })
    )

    expect(
      screen.getByRole('button', { name: 'Plain · dep-plain' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Agency A krea · dep-agency-a' })
    ).toBeNull()
    expect(workspaceApi.clearDeployment).toHaveBeenCalledWith('ws-1')
  })

  it('names three and opens the switcher for the rest', async () => {
    useDeploymentPickStore().state = readyOn([
      plain,
      agencyA,
      agencyB,
      agencyC,
      agencyD
    ])
    vi.mocked(workspaceApi.checkDeploymentCompatibility).mockResolvedValue(
      answer([agencyA, agencyB, agencyC, agencyD], [plain], true)
    )
    renderOffer()

    await userEvent.click(
      await screen.findByRole('button', { name: 'and 2 more' })
    )

    expect(
      screen.getAllByRole('button').map((button) => button.textContent.trim())
    ).toEqual([
      'Comfy Cloud',
      'Agency A krea · dep-agency-a',
      'Agency B flux · dep-agency-b',
      'and 2 more'
    ])
    expect(useDeploymentPickStore().switcherOpenAsks).toBe(1)
  })

  it('says no deployment has all of the nodes, with no button, when none does', async () => {
    useDeploymentPickStore().state = readyOn([plain, agencyA])
    vi.mocked(workspaceApi.checkDeploymentCompatibility).mockResolvedValue(
      answer([], [plain, agencyA])
    )
    renderOffer()

    expect(
      await screen.findByText(
        'No deployment in this workspace has all of these nodes.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows the server refusal as a toast and does not reload', async () => {
    useDeploymentPickStore().state = readyOn([plain, agencyA])
    vi.mocked(workspaceApi.checkDeploymentCompatibility).mockResolvedValue(
      answer([agencyA], [plain])
    )
    vi.mocked(workspaceApi.pickDeployment).mockRejectedValue(
      new Error('deployment is gone')
    )
    renderOffer()

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Agency A krea · dep-agency-a'
      })
    )

    await waitFor(() =>
      expect(useToast().toasts).toContainEqual(
        expect.objectContaining({
          kind: 'error',
          title: 'Could not switch',
          description: 'deployment is gone'
        })
      )
    )
    expect(reload).not.toHaveBeenCalled()
  })

  it('renders nothing and sends no check when the switcher is not shown', async () => {
    useDeploymentPickStore().state = { phase: 'hidden' }
    vi.mocked(workspaceApi.checkDeploymentCompatibility).mockResolvedValue(
      answer([agencyA], [])
    )
    renderOffer()
    await nextTick()

    expect(workspaceApi.checkDeploymentCompatibility).not.toHaveBeenCalled()
    expect(screen.queryByTestId('missing-node-deployment-offer')).toBeNull()
  })

  it('renders nothing when the check fails', async () => {
    useDeploymentPickStore().state = readyOn([plain, agencyA])
    vi.mocked(workspaceApi.checkDeploymentCompatibility).mockRejectedValue(
      new Error('404')
    )
    renderOffer()
    await compatibilityAnswered()

    expect(screen.queryByTestId('missing-node-deployment-offer')).toBeNull()
  })

  it.for([
    {
      when: 'ingest could not check a deployment',
      check: {
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
      when: 'the answer leaves a deployment out',
      check: {
        deployments: [
          {
            deployment_id: plain.deployment_id,
            missing_node_types: [RGTHREE],
            unknown: false
          }
        ],
        cloud: { missing_node_types: [RGTHREE] }
      }
    }
  ] satisfies { when: string; check: DeploymentCompatibility }[])(
    'does not say no deployment has the nodes when $when',
    async ({ check }) => {
      useDeploymentPickStore().state = readyOn([plain, agencyA])
      vi.mocked(workspaceApi.checkDeploymentCompatibility).mockResolvedValue(
        check
      )
      renderOffer()
      await compatibilityAnswered()

      expect(screen.queryByTestId('missing-node-deployment-offer')).toBeNull()
    }
  )

  it('offers no deployment in an API-key session, where the Run bar hides the switcher', async () => {
    useCurrentUser().isApiKeyLogin = computed(() => true)
    useDeploymentPickStore().state = readyOn([plain, agencyA])
    vi.mocked(workspaceApi.checkDeploymentCompatibility).mockResolvedValue(
      answer([agencyA], [plain], true)
    )
    renderOffer()
    await compatibilityAnswered()

    expect(screen.queryAllByRole('button')).toEqual([])
  })
})
