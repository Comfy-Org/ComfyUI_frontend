import { getActivePinia } from 'pinia'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { downloadBlob } from '@/base/common/downloadUtil'
import { useToast } from '@/components/ui/toast/toastStore'
import type { useExternalLink } from '@/composables/useExternalLink'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import type { MissingModelCandidate } from '@/platform/workflowErrors/missingModel/types'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'
import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import type {
  DeploymentCompatibilityMark,
  useDeploymentCompatibility
} from '@/platform/workspace/composables/useDeploymentCompatibility'
import {
  loadedEvent,
  reduceDeploymentPick
} from '@/platform/workspace/deploymentPickState'
import { trackDeploymentLinkClicked } from '@/platform/workspace/platformFrame/customDeploymentTelemetry'
import { usePlatformFrameStore } from '@/platform/workspace/platformFrame/platformFrameStore'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { testI18n } from '@/utils/__tests__/testI18n'

import WorkflowNeedsDeploymentCard from './WorkflowNeedsDeploymentCard.vue'

const marks = vi.hoisted(
  () => new Map<string, DeploymentCompatibilityMark | null>()
)
vi.mock(
  import('@/platform/workspace/composables/useDeploymentCompatibility'),
  () => ({
    workflowNodeTypes: vi.fn(() => []),
    useDeploymentCompatibility: () =>
      fromPartial<ReturnType<typeof useDeploymentCompatibility>>({
        markFor: (id: string | null) => marks.get(id ?? '') ?? null
      })
  })
)

vi.mock(import('@/platform/workspace/openWorkflowForCheck'), () => ({
  openWorkflowForCheck: (missingNodes) => {
    const missingNodeTypes = missingNodes.map((node) =>
      typeof node === 'string' ? node : node.type
    )
    return { nodeTypes: [...missingNodeTypes, 'SaveImage'], missingNodeTypes }
  }
}))

vi.mock(import('@/base/common/downloadUtil'), () => ({
  downloadBlob: vi.fn()
}))

vi.mock(import('@/platform/workspace/platformFrame/customDeploymentTelemetry'))

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

vi.mock(import('@/composables/useExternalLink'), () => ({
  useExternalLink: () =>
    fromPartial<ReturnType<typeof useExternalLink>>({
      buildDocsUrl: (path: string) => `https://docs.comfy.org${path}`
    })
}))

const missingNodeTypes: MissingNodeType[] = [
  { type: 'BiRefNet', cnrId: 'comfyui-birefnet', isReplaceable: false },
  { type: 'RMBG', cnrId: 'comfyui-rmbg', isReplaceable: false },
  { type: 'Impact', cnrId: 'comfyui-impact-pack', isReplaceable: false },
  { type: 'KJ', cnrId: 'comfyui-kjnodes', isReplaceable: false },
  { type: 'QwenImage21Cache', isReplaceable: false },
  { type: 'OldSampler', cnrId: 'comfyui-old', isReplaceable: true }
]

function checkpoint(name: string): MissingModelCandidate {
  return {
    nodeType: 'CheckpointLoaderSimple',
    widgetName: 'ckpt_name',
    name,
    directory: 'checkpoints',
    isMissing: true,
    isAssetSupported: false
  }
}

function deployment(id: string): WorkspaceDeployment {
  return {
    deployment_id: id,
    deployment_name: id,
    build_name: 'Acme Studio pipeline',
    release_id: `rel-${id}`,
    status: 'ready',
    created_at: '2026-10-01T00:00:00Z',
    can_start: false
  }
}

function renderCard({
  checked = {},
  nodeTypes = missingNodeTypes,
  models = [checkpoint('sd_xl_base_1.0.safetensors')]
}: {
  checked?: Record<string, DeploymentCompatibilityMark | null>
  nodeTypes?: MissingNodeType[]
  models?: MissingModelCandidate[]
} = {}) {
  const pinia = getActivePinia()!
  marks.clear()
  for (const [id, mark] of Object.entries(checked)) marks.set(id, mark)
  if (marks.size > 0) {
    marks.set('', {
      kind: 'missing',
      nodeTypes: ['BiRefNet', 'RMBG', 'Impact', 'KJ', 'QwenImage21Cache']
    })
  }
  useDeploymentPickStore(pinia).state = reduceDeploymentPick(
    { phase: 'idle' },
    loadedEvent({
      builds_visible: true,
      items: Object.keys(checked).map(deployment)
    })
  )
  useMissingNodesErrorStore(pinia).surfaceMissingNodes(nodeTypes)
  useMissingModelStore(pinia).setMissingModels(models)
  const user = userEvent.setup({ pointerEventsCheck: 0 })
  render(WorkflowNeedsDeploymentCard, {
    global: { plugins: [pinia, testI18n] }
  })
  return user
}

async function copyPrompt(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('custom-deployment-agent'))
  await user.click(await screen.findByRole('menuitem', { name: 'Copy prompt' }))
  await waitFor(() =>
    expect(screen.getByTestId('custom-deployment-agent')).toHaveTextContent(
      /^Copied/
    )
  )
}

describe('WorkflowNeedsDeploymentCard', () => {
  it('names what the workflow lacks under the custom deployment pitch, without a video', () => {
    renderCard()

    expect(
      screen.getByRole('heading', {
        name: 'Install your missing custom nodes'
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/^Deploy a custom Build to add the custom nodes/)
    ).toBeVisible()
    expect(screen.getByTestId('custom-deployment-missing')).toHaveTextContent(
      [
        '4 missing node packs',
        'comfyui-birefnet, comfyui-rmbg, comfyui-impact-pack, and 1 more',
        '1 missing node',
        'QwenImage21Cache',
        '1 missing model',
        'sd_xl_base_1.0.safetensors'
      ].join('')
    )
    expect(
      screen.queryByTestId('custom-deployment-missing')
    ).not.toHaveTextContent('comfyui-old')
    expect(
      screen.getByRole('link', { name: /Build on Platform/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('custom-deployment-video')
    ).not.toBeInTheDocument()
  })

  it('opens the platform build wizard for the open workflow from Build on Platform on Cloud', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    const user = renderCard()
    useWorkflowStore().activeWorkflow = fromPartial({
      filename: 'portrait',
      activeState: { nodes: [{ id: 1, type: 'BiRefNet' }] },
      changeTracker: { prepareForSave: vi.fn() }
    })
    let reads = 0
    const open = vi.spyOn(window, 'open').mockReturnValue(
      fromPartial<Window>({
        get closed() {
          return reads++ > 0
        }
      })
    )

    await user.click(screen.getByRole('link', { name: /Build on Platform/ }))

    expect(open).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('/profile/builds/new?step=import&handoff='),
      '_blank'
    )
    expect(trackDeploymentLinkClicked).toHaveBeenCalledExactlyOnceWith(
      'build_on_platform'
    )
  })

  it('shows names as written in a row that lists more than three', () => {
    renderCard({
      nodeTypes: [
        { type: 'BiRefNet', cnrId: 'comfyui-birefnet', isReplaceable: false }
      ],
      models: [
        checkpoint('SDXL/base.safetensors'),
        checkpoint("SDXL/Tom's=refiner.safetensors"),
        checkpoint('SDXL/a&b.safetensors'),
        checkpoint('SDXL/turbo.safetensors')
      ]
    })

    expect(screen.getByTestId('custom-deployment-missing')).toHaveTextContent(
      "SDXL/base.safetensors, SDXL/Tom's=refiner.safetensors, SDXL/a&b.safetensors, and 1 more"
    )
  })

  it('offers to switch to a deployment that runs the workflow, saying what the others lack', async () => {
    const user = renderCard({
      checked: {
        experiments: { kind: 'missing', nodeTypes: ['RMBG'] },
        production: { kind: 'runs' }
      }
    })

    const runOn = screen.getByRole('combobox', { name: 'Run on' })
    expect(runOn).toHaveTextContent('production')
    expect(screen.getByRole('button', { name: 'Switch' })).toBeInTheDocument()
    expect(
      screen.queryByTestId('custom-deployment-agent')
    ).not.toBeInTheDocument()

    await user.click(runOn)

    expect(
      await screen.findByRole('option', { name: /experiments/ })
    ).toHaveTextContent('Missing 1 node')
  })

  it('says no deployment runs it when the check finds each one lacks nodes', () => {
    renderCard({
      checked: {
        production: { kind: 'missing', nodeTypes: ['BiRefNet'] },
        experiments: { kind: 'missing', nodeTypes: ['RMBG'] }
      }
    })

    expect(
      screen.getByRole('heading', {
        name: 'Create a deployment to run this workflow on Comfy Cloud'
      })
    ).toBeInTheDocument()
    expect(screen.getByTestId('custom-deployment-note')).toHaveTextContent(
      'No deployment in this workspace has all of these nodes.'
    )
  })

  it('asks for a Custom Build when no deployment runs it and the build opens in the editor', () => {
    vi.spyOn(usePlatformFrameStore(), 'isAvailable').mockReturnValue(true)

    renderCard({
      checked: {
        production: { kind: 'missing', nodeTypes: ['BiRefNet'] }
      }
    })

    expect(
      screen.getByRole('heading', {
        name: 'Create a Custom Build to run this workflow on Comfy Cloud'
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Create a custom build' })
    ).toBeInTheDocument()
  })

  it('copies a brief that lists every missing pack, node and model', async () => {
    const user = renderCard({
      nodeTypes: [
        { type: 'KJ', cnrId: 'comfyui-kjnodes', isReplaceable: false },
        { type: 'QwenImage21Cache', isReplaceable: false },
        { type: 'OldSampler', cnrId: 'comfyui-old', isReplaceable: true }
      ]
    })

    await copyPrompt(user)

    const brief = await navigator.clipboard.readText()
    expect(brief).toContain('- Pack `comfyui-kjnodes`: `KJ`')
    expect(brief).toContain('- Pack unknown: `QwenImage21Cache`')
    expect(brief).toContain(
      '- `sd_xl_base_1.0.safetensors` in `models/checkpoints`'
    )
    expect(brief).not.toContain('OldSampler')
  })

  it('downloads the open workflow under the file name the brief gives the agent', async () => {
    const activeState = { nodes: [{ id: 1, type: 'KJ' }] }
    useWorkflowStore().activeWorkflow = fromPartial({
      filename: 'portrait upscale.json',
      activeState,
      changeTracker: { prepareForSave: vi.fn() }
    })
    const user = renderCard()

    await copyPrompt(user)

    expect(await navigator.clipboard.readText()).toContain(
      'The browser downloaded the workflow as `portrait upscale.json`'
    )
    const [fileName, blob] = vi.mocked(downloadBlob).mock.calls[0]
    expect(fileName).toBe('portrait upscale.json')
    expect(JSON.parse(await blob.text())).toEqual(activeState)
  })

  it('keeps downloading the workflow it opened for after another becomes active', async () => {
    const activeState = { nodes: [{ id: 1, type: 'KJ' }] }
    useWorkflowStore().activeWorkflow = fromPartial({
      filename: 'portrait.json',
      activeState,
      changeTracker: { prepareForSave: vi.fn() }
    })
    const user = renderCard()
    useWorkflowStore().activeWorkflow = fromPartial({
      filename: 'other.json',
      activeState: { nodes: [] },
      changeTracker: { prepareForSave: vi.fn() }
    })
    useMissingModelStore().setMissingModels([checkpoint('other.safetensors')])
    await nextTick()

    await copyPrompt(user)

    const [fileName, blob] = vi.mocked(downloadBlob).mock.calls[0]
    expect(fileName).toBe('portrait.json')
    expect(JSON.parse(await blob.text())).toEqual(activeState)
    const brief = await navigator.clipboard.readText()
    expect(brief).toContain('sd_xl_base_1.0.safetensors')
    expect(brief).not.toContain('other.safetensors')
  })

  it('names the file as the browser saves it', async () => {
    useWorkflowStore().activeWorkflow = fromPartial({
      filename: '.SDXL: portrait?\u202E.json',
      activeState: {},
      changeTracker: { prepareForSave: vi.fn() }
    })
    const user = renderCard()

    await copyPrompt(user)

    expect(vi.mocked(downloadBlob).mock.calls[0][0]).toBe(
      'SDXL_ portrait_.json'
    )
    expect(await navigator.clipboard.readText()).toContain(
      'downloaded the workflow as `SDXL_ portrait_.json`'
    )
  })

  it('reports a failure and downloads nothing when its workflow is no longer loaded', async () => {
    useWorkflowStore().activeWorkflow = fromPartial({
      filename: 'portrait.json',
      activeState: {},
      changeTracker: { prepareForSave: vi.fn() }
    })
    const user = renderCard()
    Object.assign(useWorkflowStore().activeWorkflow ?? {}, {
      activeState: null,
      changeTracker: null
    })

    await user.click(screen.getByTestId('custom-deployment-agent'))
    await user.click(
      await screen.findByRole('menuitem', { name: 'Copy prompt' })
    )

    await waitFor(() =>
      expect(useToast().toasts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            description:
              'The brief for your agent could not be prepared. Try again.'
          })
        ])
      )
    )
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('names no workflow file and downloads nothing when no workflow is open', async () => {
    useWorkflowStore().activeWorkflow = null
    const user = renderCard()

    await copyPrompt(user)

    expect(await navigator.clipboard.readText()).not.toContain(
      'The browser downloaded the workflow'
    )
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('lists and briefs a model Comfy Cloud finds missing after the dialog opens', async () => {
    const user = renderCard({ models: [] })
    expect(
      screen.getByTestId('custom-deployment-missing')
    ).not.toHaveTextContent('missing model')

    useMissingModelStore().setMissingModels([
      checkpoint('sd_xl_base_1.0.safetensors')
    ])
    await nextTick()

    expect(screen.getByTestId('custom-deployment-missing')).toHaveTextContent(
      '1 missing modelsd_xl_base_1.0.safetensors'
    )
    await copyPrompt(user)
    expect(await navigator.clipboard.readText()).toContain(
      '- `sd_xl_base_1.0.safetensors` in `models/checkpoints`'
    )
  })
})
