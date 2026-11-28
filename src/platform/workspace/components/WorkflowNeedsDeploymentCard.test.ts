import { getActivePinia } from 'pinia'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { CustomDeploymentEntry } from '@comfyorg/telemetry/types'
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
  models = [checkpoint('sd_xl_base_1.0.safetensors')],
  entry
}: {
  entry?: CustomDeploymentEntry
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
    props: entry ? { entry } : {},
    global: { plugins: [pinia, testI18n] }
  })
  return user
}

describe('WorkflowNeedsDeploymentCard', () => {
  it('names what the workflow lacks under the custom deployment pitch, without a video', () => {
    renderCard()

    expect(
      screen.getByRole('heading', {
        name: 'Create a Custom Build to run this workflow'
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'A Custom Build adds what Comfy Cloud is missing, so this workflow just runs.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('listitem').map((point) => point.textContent.trim())
    ).toEqual([
      "Use custom nodes and models that aren't on Comfy Cloud",
      'Work in ComfyUI on the GPU you choose',
      'Pay only while the GPU is running, plus storage'
    ])
    expect(screen.getByTestId('custom-deployment-missing')).toHaveTextContent(
      [
        '4 missing node packs',
        'comfyui-birefnet',
        '+3 more',
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
      screen.getByRole('link', { name: /Create a Custom Build/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('custom-deployment-video')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('custom-deployment-agent')
    ).not.toBeInTheDocument()
  })

  it('opens the platform build wizard in a new tab when the editor has no Platform frame', async () => {
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

    await user.click(
      screen.getByRole('link', { name: /Create a Custom Build/ })
    )

    expect(open).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('/profile/builds/new?step=import&handoff='),
      '_blank'
    )
    expect(trackDeploymentLinkClicked).toHaveBeenCalledExactlyOnceWith(
      'build_on_platform'
    )
  })

  it('shows the first name as written and counts the rest in a row that lists several', () => {
    renderCard({
      nodeTypes: [
        { type: 'BiRefNet', cnrId: 'comfyui-birefnet', isReplaceable: false }
      ],
      models: [
        checkpoint("SDXL/Tom's=a&b.safetensors"),
        checkpoint('SDXL/base.safetensors'),
        checkpoint('SDXL/a&b.safetensors'),
        checkpoint('SDXL/turbo.safetensors')
      ]
    })

    expect(screen.getByTestId('custom-deployment-missing')).toHaveTextContent(
      "4 missing modelsSDXL/Tom's=a&b.safetensors+3 more"
    )
    expect(screen.getByRole('button', { name: '+3 more' })).toHaveAttribute(
      'title',
      'SDXL/base.safetensors, SDXL/a&b.safetensors, SDXL/turbo.safetensors'
    )
  })

  it('lists every missing name in the row when "+N more" is opened, and hides them again', async () => {
    const user = renderCard({
      models: [
        checkpoint('SDXL/first.safetensors'),
        checkpoint('SDXL/second.safetensors'),
        checkpoint('SDXL/third.safetensors')
      ]
    })

    await user.click(screen.getByRole('button', { name: '+2 more' }))

    expect(screen.getByTestId('missing-items-names')).toHaveTextContent(
      'SDXL/first.safetensors, SDXL/second.safetensors, SDXL/third.safetensors'
    )

    await user.click(screen.getByRole('button', { name: 'Show less' }))

    expect(screen.queryByTestId('missing-items-names')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+2 more' })).toHaveAttribute(
      'aria-expanded',
      'false'
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

  it('asks for a Custom Build under the same title when the check finds each deployment lacks nodes', () => {
    renderCard({
      checked: {
        production: { kind: 'missing', nodeTypes: ['BiRefNet'] },
        experiments: { kind: 'missing', nodeTypes: ['RMBG'] }
      }
    })

    expect(
      screen.getByRole('heading', {
        name: 'Create a Custom Build to run this workflow'
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Create a Custom Build/ })
    ).toBeInTheDocument()
  })

  it.for([
    { openedFrom: undefined, frameEntry: 'workflow_dialog' },
    { openedFrom: 'errors_panel', frameEntry: 'errors_panel' }
  ] as const)(
    'opens the Platform frame from Create a Custom Build as $frameEntry when the editor has one',
    async ({ openedFrom, frameEntry }) => {
      const frames = usePlatformFrameStore()
      vi.spyOn(frames, 'isAvailable').mockReturnValue(true)
      const openFrame = vi.spyOn(frames, 'open').mockReturnValue(true)
      const openTab = vi.spyOn(window, 'open')
      const user = renderCard({ entry: openedFrom })

      await user.click(
        screen.getByRole('link', { name: 'Create a Custom Build' })
      )

      expect(openFrame).toHaveBeenCalledExactlyOnceWith(
        expect.anything(),
        frameEntry
      )
      expect(openTab).not.toHaveBeenCalled()
    }
  )

  it('asks for a Custom Build when no deployment runs it and the build opens in the editor', () => {
    vi.spyOn(usePlatformFrameStore(), 'isAvailable').mockReturnValue(true)

    renderCard({
      checked: {
        production: { kind: 'missing', nodeTypes: ['BiRefNet'] }
      }
    })

    expect(
      screen.getByRole('heading', {
        name: 'Create a Custom Build to run this workflow'
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Create a Custom Build' })
    ).toBeInTheDocument()
  })

  it('lists a model Comfy Cloud finds missing after the dialog opens', async () => {
    renderCard({ models: [] })
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
  })
})
