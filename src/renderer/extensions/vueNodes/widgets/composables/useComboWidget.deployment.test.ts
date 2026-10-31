import type { IComboWidget } from '@comfyorg/graph-model/widgets'
import type { WorkspaceDeployment } from '@comfyorg/ingest-types'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { getComboWidgetInventory } from '@/core/graph/widgets/comboWidgetInventory'
import { syncPromotedComboHostOptions } from '@/core/graph/widgets/syncPromotedComboHostOptions'
import { LGraph, LGraphNode } from '@comfyorg/litegraph/litegraph'
import type { Subgraph } from '@comfyorg/litegraph/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@comfyorg/litegraph/subgraph/__fixtures__/subgraphHelpers'
import { assetService } from '@/platform/assets/services/assetService'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useDeploymentLibraryModelsStore } from '@/platform/workspace/stores/deploymentLibraryModelsStore'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAssetDownloadStore } from '@/stores/assetDownloadStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import { ComfyWidgets } from '@/scripts/widgets'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/platform/assets/composables/useAssetBrowserDialog'), () => ({
  registerAssetBrowserModalComponent: vi.fn(),
  useAssetBrowserDialog: () => ({ show: vi.fn(), browse: vi.fn() })
}))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@comfyorg/telemetry/reportError'), { spy: true })
vi.mock(import('@/core/graph/widgets/syncPromotedComboHostOptions'), {
  spy: true
})
vi.mock(import('@/platform/distribution/types'), () => ({
  DISTRIBUTION: 'localhost' as const,
  isDesktop: false,
  isNightly: false,
  isCloud: true
}))

const deployment: WorkspaceDeployment = {
  deployment_id: 'dep-1',
  release_id: 'release-1',
  status: 'ready',
  can_start: false,
  created_at: '2026-10-01T00:00:00Z'
}

describe('model widgets on a deployment', () => {
  beforeEach(() => {
    useNodeDefStore().nodeDefsByName = {
      CheckpointLoaderSimple: fromPartial({ name: 'CheckpointLoaderSimple' }),
      LoraLoader: fromPartial({ name: 'LoraLoader' })
    }
  })

  it.for([
    { nodeType: 'CheckpointLoaderSimple', input: 'ckpt_name' },
    { nodeType: 'LoraLoader', input: 'lora_name' },
    { nodeType: 'VAELoader', input: 'vae_name' },
    { nodeType: 'UNETLoader', input: 'unet_name' },
    { nodeType: 'DualCLIPLoader', input: 'clip_name1' },
    { nodeType: 'CustomModelLoader', input: 'custom_model' }
  ])(
    'constructs $nodeType with the catalog options and default',
    ({ nodeType, input }) => {
      useDeploymentPickStore().bootDeployment = deployment
      const node = new LGraphNode(nodeType)
      node.comfyClass = nodeType
      const { widget } = ComfyWidgets.COMBO(
        node,
        input,
        [['release.safetensors', 'other.safetensors'], {}],
        app
      )

      expect(widget.type).toBe('combo')
      expect(widget.options.values).toEqual([
        'release.safetensors',
        'other.safetensors'
      ])
      expect(widget.value).toBe('release.safetensors')
    }
  )

  it('keeps the Cloud asset picker when the page booted without a deployment', () => {
    useDeploymentPickStore().bootDeployment = null
    const node = new LGraphNode('CheckpointLoaderSimple')
    node.comfyClass = 'CheckpointLoaderSimple'
    const { widget } = ComfyWidgets.COMBO(
      node,
      'ckpt_name',
      [['catalog.safetensors'], {}],
      app
    )

    expect(widget.type).toBe('asset')
  })

  describe('the workspace library', () => {
    const library = new Map<string, string[]>()

    async function libraryAnswered() {
      await vi
        .mocked(assetService.getWorkspaceLibraryModels)
        .mock.results.at(-1)?.value
      await nextTick()
    }

    function libraryLoaded(widget: IComboWidget) {
      return getComboWidgetInventory(widget)?.waitForSettled()
    }

    function loraWidget(options = ['release.safetensors']) {
      const node = new LGraphNode('LoraLoader')
      node.comfyClass = 'LoraLoader'
      const { widget } = ComfyWidgets.COMBO(
        node,
        'lora_name',
        [options, {}],
        app
      )
      return widget as IComboWidget
    }

    function loaderNode(nodeType: string, input: string) {
      const node = new LGraphNode(nodeType)
      node.comfyClass = nodeType
      ComfyWidgets.COMBO(node, input, [['release.safetensors'], {}], app)
      return node
    }

    function onWorkspace(workspaceId: string | null) {
      Object.assign(useTeamWorkspaceStore(), { workspaceId })
    }

    function promotedLoader(subgraph: Subgraph) {
      const node = new LGraphNode('LoraLoader')
      node.comfyClass = 'LoraLoader'
      const input = node.addInput('lora_name', 'COMBO')
      const { widget } = ComfyWidgets.COMBO(
        node,
        'lora_name',
        [['release.safetensors'], {}],
        app
      )
      input.widget = { name: widget.name }
      subgraph.add(node)
      subgraph.inputNode.slots[0].connect(input, node)
      const host = createTestSubgraphNode(subgraph)
      subgraph.rootGraph.add(host)
      return host.widgets[0]
    }

    beforeEach(() => {
      library.clear()
      vi.mocked(reportError).mockImplementation(() => undefined)
      vi.spyOn(assetService, 'getWorkspaceLibraryModels').mockImplementation(
        async (folder) => library.get(folder) ?? []
      )
      onWorkspace('ws-1')
      useDeploymentPickStore().bootDeployment = deployment
      vi.mocked(useFeatureFlags().flags).runtimeLibraryModelsEnabled = true
    })

    it('leaves the dropdown as the Release lists it and asks for no library while the flag is off', async () => {
      vi.mocked(useFeatureFlags().flags).runtimeLibraryModelsEnabled = false
      library.set('loras', ['my_style_v2.safetensors'])
      const widget = loraWidget()

      expect(assetService.getWorkspaceLibraryModels).not.toHaveBeenCalled()
      expect(widget.options.values).toEqual(['release.safetensors'])
      expect(getComboWidgetInventory(widget)?.getStatus()).toBe('ready')
    })

    it('follows the flag when it flips while the page is open', async () => {
      vi.mocked(useFeatureFlags().flags).runtimeLibraryModelsEnabled = false
      library.set('loras', ['my_style_v2.safetensors'])
      const widget = loraWidget()

      vi.mocked(useFeatureFlags().flags).runtimeLibraryModelsEnabled = true
      expect(widget.options.values).toEqual(['release.safetensors'])
      await libraryLoaded(widget)
      expect(widget.options.values).toEqual([
        'release.safetensors',
        'my_style_v2.safetensors'
      ])

      vi.mocked(useFeatureFlags().flags).runtimeLibraryModelsEnabled = false
      widget.options.values = ['release.safetensors']
      expect(widget.options.values).toEqual(['release.safetensors'])
      expect(assetService.getWorkspaceLibraryModels).toHaveBeenCalledOnce()
    })

    it('lists the Release models first, then library models not already listed', async () => {
      library.set('loras', ['my_style_v2.safetensors', 'release.safetensors'])
      const widget = loraWidget(['release.safetensors', 'other.safetensors'])

      expect(widget.options.values).toEqual([
        'release.safetensors',
        'other.safetensors'
      ])
      await libraryLoaded(widget)

      expect(assetService.getWorkspaceLibraryModels).toHaveBeenCalledWith(
        'loras'
      )
      expect(widget.options.values).toEqual([
        'release.safetensors',
        'other.safetensors',
        'my_style_v2.safetensors'
      ])
      expect(widget.options.values).toBe(widget.options.values)
    })

    it('names no library folder when the page booted without a deployment', () => {
      const library = useDeploymentLibraryModelsStore()
      expect(library.folderFor('LoraLoader', 'lora_name')).toBe('loras')

      useDeploymentPickStore().bootDeployment = null

      expect(library.folderFor('LoraLoader', 'lora_name')).toBeUndefined()
    })

    it('offers no library models in a custom-node folder the deployment worker does not stage', async () => {
      useNodeDefStore().nodeDefsByName = {
        IPAdapterModelLoader: fromPartial({ name: 'IPAdapterModelLoader' })
      }
      expect(
        assetService.isAssetBrowserEligible(
          'IPAdapterModelLoader',
          'ipadapter_file'
        )
      ).toBe(true)
      library.set('ipadapter', ['ip_style.safetensors'])
      const node = new LGraphNode('IPAdapterModelLoader')
      node.comfyClass = 'IPAdapterModelLoader'
      const { widget } = ComfyWidgets.COMBO(
        node,
        'ipadapter_file',
        [['release_ipadapter.safetensors'], {}],
        app
      )
      await libraryAnswered()

      expect(
        useDeploymentLibraryModelsStore().folderFor(
          'IPAdapterModelLoader',
          'ipadapter_file'
        )
      ).toBeUndefined()
      expect(assetService.getWorkspaceLibraryModels).not.toHaveBeenCalled()
      expect(widget.options.values).toEqual(['release_ipadapter.safetensors'])
    })

    it('offers only the library models a deployment can download: a bare .safetensors file name', async () => {
      library.set('loras', [
        'my_style.ckpt',
        'my_style.pt',
        'nested/my_style.safetensors',
        'flux..v2.safetensors',
        '.hidden.safetensors',
        'Upper_Case.SAFETENSORS'
      ])
      const widget = loraWidget()
      await libraryLoaded(widget)

      expect(widget.options.values).toEqual([
        'release.safetensors',
        'Upper_Case.SAFETENSORS'
      ])
    })

    it('reads nothing from the network when a dropdown or the missing-model check only looks', () => {
      const library = useDeploymentLibraryModelsStore()

      expect(library.namesIn('loras')).toEqual([])
      expect(library.statusOf('loras')).toBe('ready')
      expect(assetService.getWorkspaceLibraryModels).not.toHaveBeenCalled()
    })

    it.for([
      {
        removal: 'its node is deleted',
        remove: (node: LGraphNode) => node.graph?.remove(node)
      },
      {
        removal: 'its widget is removed',
        remove: (node: LGraphNode) => {
          const [widget] = node.widgets ?? []
          node.removeWidget(widget)
        }
      }
    ])(
      'stops reading the library for a loader once $removal',
      async ({ remove }) => {
        const graph = new LGraph()
        const loras = [
          loaderNode('LoraLoader', 'lora_name'),
          loaderNode('LoraLoader', 'lora_name')
        ]
        const checkpoint = loaderNode('CheckpointLoaderSimple', 'ckpt_name')
        for (const node of [...loras, checkpoint]) graph.add(node)
        await Promise.all(
          vi
            .mocked(assetService.getWorkspaceLibraryModels)
            .mock.results.map((result) => result.value)
        )

        remove(loras[0])
        remove(checkpoint)
        vi.mocked(assetService.getWorkspaceLibraryModels).mockClear()
        onWorkspace('ws-2')
        await nextTick()

        expect(
          vi.mocked(assetService.getWorkspaceLibraryModels).mock.calls
        ).toEqual([['loras']])
      }
    )

    it.for([
      {
        change: 'an upload into its folder completes',
        apply: () => {
          useAssetDownloadStore().lastCompletedDownload = {
            taskId: 'task-1',
            modelType: 'loras',
            timestamp: 1
          }
        }
      },
      {
        change: 'the workspace changes',
        apply: () => onWorkspace('ws-2')
      }
    ])(
      'keeps a loader deleted and added back in step with the library when $change',
      async ({ apply }) => {
        const graph = new LGraph()
        const node = loaderNode('LoraLoader', 'lora_name')
        graph.add(node)
        await libraryAnswered()
        graph.remove(node)
        graph.add(node)
        vi.mocked(syncPromotedComboHostOptions).mockClear()

        library.set('loras', ['uploaded.safetensors'])
        apply()
        await nextTick()
        await libraryAnswered()

        expect(syncPromotedComboHostOptions).toHaveBeenLastCalledWith(
          graph.rootGraph
        )
      }
    )

    it('adds one removal handler to a node however many library dropdowns come and go', () => {
      const node = loaderNode('LoraLoader', 'lora_name')
      const { onRemoved } = node

      for (let row = 0; row < 3; row++) {
        const { widget } = ComfyWidgets.COMBO(
          node,
          'lora_name',
          [['release.safetensors'], {}],
          app
        )
        node.removeWidget(widget)
      }

      expect(node.onRemoved).toBe(onRemoved)
    })

    it('holds the missing-model check until the library answers', async () => {
      let answer: (names: string[]) => void = () => {}
      vi.mocked(assetService.getWorkspaceLibraryModels).mockReturnValueOnce(
        new Promise((resolve) => {
          answer = resolve
        })
      )
      const widget = loraWidget()
      const inventory = getComboWidgetInventory(widget)

      expect(inventory?.getStatus()).toBe('loading')
      const settled = inventory?.waitForSettled()
      answer(['my_style_v2.safetensors'])
      await settled

      expect(inventory?.getStatus()).toBe('ready')
      expect(widget.options.values).toContain('my_style_v2.safetensors')
    })

    it('shows the new workspace library, never the previous one, after a workspace change', async () => {
      let answerA: (names: string[]) => void = () => {}
      vi.mocked(assetService.getWorkspaceLibraryModels).mockReturnValueOnce(
        new Promise((resolve) => {
          answerA = resolve
        })
      )
      const widget = loraWidget()

      library.set('loras', ['b_lora.safetensors'])
      onWorkspace('ws-2')
      expect(widget.options.values).toEqual(['release.safetensors'])
      answerA(['a_lora.safetensors'])
      await libraryLoaded(widget)

      expect(widget.options.values).toEqual([
        'release.safetensors',
        'b_lora.safetensors'
      ])
    })

    it('drops the library while signed out of every workspace', async () => {
      library.set('loras', ['a_lora.safetensors'])
      const widget = loraWidget()
      await libraryLoaded(widget)

      onWorkspace(null)

      expect(widget.options.values).toEqual(['release.safetensors'])
    })

    it('reads the library again when the Release options are refreshed', async () => {
      const widget = loraWidget()
      await libraryLoaded(widget)
      library.set('loras', ['uploaded.safetensors'])

      widget.options.values = ['release.safetensors', 'release_v2.safetensors']
      await libraryAnswered()

      expect(widget.options.values).toEqual([
        'release.safetensors',
        'release_v2.safetensors',
        'uploaded.safetensors'
      ])
    })

    it('reads the library again when a model upload into its folder completes', async () => {
      const widget = loraWidget()
      await libraryLoaded(widget)
      library.set('loras', ['uploaded.safetensors'])

      useAssetDownloadStore().lastCompletedDownload = {
        taskId: 'task-1',
        modelType: 'loras',
        timestamp: 1
      }
      await nextTick()
      await libraryAnswered()

      expect(widget.options.values).toContain('uploaded.safetensors')
    })

    it.for([
      {
        answer: 'the model is already in storage (200)',
        response: () =>
          new Response(
            JSON.stringify({
              id: '3f0b6c1e-0000-4000-8000-000000000010',
              name: 'imported.safetensors',
              tags: ['models', 'loras'],
              created_at: '2026-10-29T00:00:00Z',
              updated_at: '2026-10-29T00:00:00Z'
            }),
            { status: 200 }
          )
      },
      {
        answer: 'the import task is already complete (202)',
        response: () =>
          new Response(
            JSON.stringify({ task_id: 'task-1', status: 'completed' }),
            { status: 202 }
          )
      }
    ])(
      'reads the library again when an import finishes at once because $answer',
      async ({ response }) => {
        const widget = loraWidget()
        await libraryLoaded(widget)
        library.set('loras', ['imported.safetensors'])

        vi.mocked(api.fetchApi).mockResolvedValueOnce(response())
        await assetService.uploadAssetAsync({
          source_url: 'https://civitai.com/api/download/models/1',
          tags: ['models', 'loras']
        })
        await libraryAnswered()

        expect(widget.options.values).toEqual([
          'release.safetensors',
          'imported.safetensors'
        ])
      }
    )

    it('lets the newest read of the library win when an older one answers last', async () => {
      let answerOlder: (names: string[]) => void = () => {}
      const olderRead = new Promise<string[]>((resolve) => {
        answerOlder = resolve
      })
      vi.mocked(assetService.getWorkspaceLibraryModels).mockReturnValueOnce(
        olderRead
      )
      const widget = loraWidget()
      library.set('loras', ['uploaded.safetensors'])
      useDeploymentLibraryModelsStore().refresh('loras')
      await libraryAnswered()

      answerOlder(['before_upload.safetensors'])
      await olderRead

      expect(widget.options.values).toEqual([
        'release.safetensors',
        'uploaded.safetensors'
      ])
    })

    it('drops a deleted model from the dropdown once the deletion succeeds', async () => {
      library.set('loras', [
        'my_style_v2.safetensors',
        'teammate_portrait.safetensors'
      ])
      const widget = loraWidget()
      await libraryLoaded(widget)
      expect(widget.options.values).toContain('my_style_v2.safetensors')

      vi.mocked(api.fetchApi).mockResolvedValueOnce(
        new Response(null, { status: 204 })
      )
      library.set('loras', ['teammate_portrait.safetensors'])
      await assetService.deleteAsset('3f0b6c1e-0000-4000-8000-000000000001')
      await libraryAnswered()

      expect(widget.options.values).toEqual([
        'release.safetensors',
        'teammate_portrait.safetensors'
      ])
    })

    it.for([
      {
        change: 'the workspace changes',
        expected: ['release.safetensors', 'newer.safetensors'],
        apply: () => onWorkspace('ws-2')
      },
      {
        change: 'the member signs out',
        expected: ['release.safetensors'],
        apply: () => onWorkspace(null)
      },
      {
        change: 'the flag turns off',
        expected: ['release.safetensors'],
        apply: () => {
          vi.mocked(useFeatureFlags().flags).runtimeLibraryModelsEnabled = false
        }
      },
      {
        change: 'an upload reads the folder again',
        expected: ['release.safetensors', 'newer.safetensors'],
        apply: () => {
          useAssetDownloadStore().lastCompletedDownload = {
            taskId: 'task-1',
            modelType: 'loras',
            timestamp: 1
          }
        }
      }
    ])(
      'settles a missing-model wait when $change while the first read never answers',
      async ({ expected, apply }) => {
        vi.mocked(assetService.getWorkspaceLibraryModels).mockReturnValueOnce(
          new Promise(() => {})
        )
        const widget = loraWidget()
        const settled = libraryLoaded(widget)
        await expect(
          Promise.race([
            settled?.then(() => 'settled'),
            nextTick(() => 'waiting')
          ])
        ).resolves.toBe('waiting')

        library.set('loras', ['newer.safetensors'])
        apply()
        await settled

        expect(getComboWidgetInventory(widget)?.getStatus()).toBe('ready')
        expect(widget.options.values).toEqual(expected)
      }
    )

    it('keeps a loader promoted out of a subgraph in step with the library', async () => {
      let answer: (names: string[]) => void = () => {}
      vi.mocked(assetService.getWorkspaceLibraryModels).mockReturnValueOnce(
        new Promise((resolve) => {
          answer = resolve
        })
      )
      const promoted = promotedLoader(
        createTestSubgraph({ inputs: [{ name: 'outer_lora', type: 'COMBO' }] })
      )
      expect(promoted.options.values).toEqual(['release.safetensors'])

      answer(['my_style_v2.safetensors'])
      await libraryAnswered()
      expect(promoted.options.values).toEqual([
        'release.safetensors',
        'my_style_v2.safetensors'
      ])

      vi.mocked(useFeatureFlags().flags).runtimeLibraryModelsEnabled = false
      await nextTick()
      expect(promoted.options.values).toEqual(['release.safetensors'])
    })

    it('copies a library change to every promoted loader in one pass over the graph', async () => {
      const first = createTestSubgraph({
        inputs: [{ name: 'outer_lora', type: 'COMBO' }]
      })
      const promoted = [
        first,
        ...[1, 2].map(() =>
          createTestSubgraph({
            rootGraph: first.rootGraph,
            inputs: [{ name: 'outer_lora', type: 'COMBO' }]
          })
        )
      ].map(promotedLoader)
      await libraryAnswered()
      vi.mocked(syncPromotedComboHostOptions).mockClear()

      library.set('loras', ['uploaded.safetensors'])
      useAssetDownloadStore().lastCompletedDownload = {
        taskId: 'task-1',
        modelType: 'loras',
        timestamp: 1
      }
      await nextTick()
      await libraryAnswered()

      expect(syncPromotedComboHostOptions).toHaveBeenCalledExactlyOnceWith(
        first.rootGraph
      )
      const withUpload = ['release.safetensors', 'uploaded.safetensors']
      expect(promoted.map((widget) => widget.options.values)).toEqual([
        withUpload,
        withUpload,
        withUpload
      ])
    })

    it('keeps the Release models and reports when the library cannot be read', async () => {
      vi.mocked(assetService.getWorkspaceLibraryModels).mockRejectedValueOnce(
        new Error('Server returned 500')
      )
      const widget = loraWidget()
      await libraryLoaded(widget)

      expect(widget.options.values).toEqual(['release.safetensors'])
      expect(getComboWidgetInventory(widget)?.getStatus()).toBe('error')
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ errorType: 'error_loading_library_models' })
      )
    })
  })
})
