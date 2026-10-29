import type { IComboWidget } from '@comfyorg/graph-model/widgets'
import type { WorkspaceDeployment } from '@comfyorg/ingest-types'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { getComboWidgetInventory } from '@/core/graph/widgets/comboWidgetInventory'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
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

    function settle() {
      return new Promise<void>((resolve) => setTimeout(resolve))
    }

    function models(...names: string[]): string[] {
      return names
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

    function onWorkspace(workspaceId: string | null) {
      Object.assign(useTeamWorkspaceStore(), { workspaceId })
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
      library.set('loras', models('my_style_v2.safetensors'))
      const widget = loraWidget()
      await settle()

      expect(assetService.getWorkspaceLibraryModels).not.toHaveBeenCalled()
      expect(widget.options.values).toEqual(['release.safetensors'])
      expect(getComboWidgetInventory(widget)?.getStatus()).toBe('ready')
    })

    it('follows the flag when it flips while the page is open', async () => {
      vi.mocked(useFeatureFlags().flags).runtimeLibraryModelsEnabled = false
      library.set('loras', models('my_style_v2.safetensors'))
      const widget = loraWidget()
      await settle()

      vi.mocked(useFeatureFlags().flags).runtimeLibraryModelsEnabled = true
      expect(widget.options.values).toEqual(['release.safetensors'])
      await settle()
      expect(widget.options.values).toEqual([
        'release.safetensors',
        'my_style_v2.safetensors'
      ])

      vi.mocked(useFeatureFlags().flags).runtimeLibraryModelsEnabled = false
      widget.options.values = ['release.safetensors']
      await settle()
      expect(widget.options.values).toEqual(['release.safetensors'])
      expect(assetService.getWorkspaceLibraryModels).toHaveBeenCalledOnce()
    })

    it('lists the Release models first, then library models not already listed', async () => {
      library.set(
        'loras',
        models('my_style_v2.safetensors', 'release.safetensors')
      )
      const widget = loraWidget(['release.safetensors', 'other.safetensors'])

      expect(widget.options.values).toEqual([
        'release.safetensors',
        'other.safetensors'
      ])
      await settle()

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
      answer(models('my_style_v2.safetensors'))
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

      onWorkspace('ws-2')
      library.set('loras', models('b_lora.safetensors'))
      expect(widget.options.values).toEqual(['release.safetensors'])
      answerA(models('a_lora.safetensors'))
      await settle()

      expect(widget.options.values).toEqual([
        'release.safetensors',
        'b_lora.safetensors'
      ])
    })

    it('drops the library while signed out of every workspace', async () => {
      library.set('loras', models('a_lora.safetensors'))
      const widget = loraWidget()
      await settle()

      onWorkspace(null)
      await settle()

      expect(widget.options.values).toEqual(['release.safetensors'])
    })

    it('reads the library again when the Release options are refreshed', async () => {
      const widget = loraWidget()
      await settle()
      library.set('loras', models('uploaded.safetensors'))

      widget.options.values = ['release.safetensors', 'release_v2.safetensors']
      await settle()

      expect(widget.options.values).toEqual([
        'release.safetensors',
        'release_v2.safetensors',
        'uploaded.safetensors'
      ])
    })

    it('reads the library again when a model upload into its folder completes', async () => {
      const widget = loraWidget()
      await settle()
      library.set('loras', models('uploaded.safetensors'))

      useAssetDownloadStore().lastCompletedDownload = {
        taskId: 'task-1',
        modelType: 'loras',
        timestamp: 1
      }
      await settle()

      expect(widget.options.values).toContain('uploaded.safetensors')
    })

    it('lets the newest read of the library win when an older one answers last', async () => {
      let answerOlder: (names: string[]) => void = () => {}
      vi.mocked(assetService.getWorkspaceLibraryModels).mockReturnValueOnce(
        new Promise((resolve) => {
          answerOlder = resolve
        })
      )
      const widget = loraWidget()
      library.set('loras', models('uploaded.safetensors'))
      useDeploymentLibraryModelsStore().refresh('loras')
      await settle()

      answerOlder(models('before_upload.safetensors'))
      await settle()

      expect(widget.options.values).toEqual([
        'release.safetensors',
        'uploaded.safetensors'
      ])
    })

    it('drops a deleted model from the dropdown once the deletion succeeds', async () => {
      library.set(
        'loras',
        models('my_style_v2.safetensors', 'teammate_portrait.safetensors')
      )
      const widget = loraWidget()
      await settle()
      expect(widget.options.values).toContain('my_style_v2.safetensors')

      vi.mocked(api.fetchApi).mockResolvedValueOnce(
        new Response(null, { status: 204 })
      )
      library.set('loras', models('teammate_portrait.safetensors'))
      await assetService.deleteAsset('3f0b6c1e-0000-4000-8000-000000000001')
      await settle()

      expect(widget.options.values).toEqual([
        'release.safetensors',
        'teammate_portrait.safetensors'
      ])
    })

    it('settles a missing-model wait on the new workspace without waiting for the old one', async () => {
      vi.mocked(assetService.getWorkspaceLibraryModels).mockReturnValueOnce(
        new Promise(() => {})
      )
      const widget = loraWidget()
      const inventory = getComboWidgetInventory(widget)
      let settled = false
      void inventory?.waitForSettled().then(() => {
        settled = true
      })

      library.set('loras', models('new_workspace.safetensors'))
      onWorkspace('ws-2')
      expect(widget.options.values).toEqual(['release.safetensors'])
      await settle()

      expect(inventory?.getStatus()).toBe('ready')
      expect(widget.options.values).toEqual([
        'release.safetensors',
        'new_workspace.safetensors'
      ])
      expect(settled).toBe(true)
    })

    it('keeps the Release models and reports when the library cannot be read', async () => {
      vi.mocked(assetService.getWorkspaceLibraryModels).mockRejectedValueOnce(
        new Error('Server returned 500')
      )
      const widget = loraWidget()
      await settle()

      expect(widget.options.values).toEqual(['release.safetensors'])
      expect(getComboWidgetInventory(widget)?.getStatus()).toBe('error')
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ errorType: 'error_loading_library_models' })
      )
    })
  })
})
