import { fromPartial } from '@total-typescript/shoehorn'
import type * as DistributionModule from '@/platform/distribution/types'
import type { ComfyApp } from '@/scripts/app'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useMissingModelStore } from './missingModelStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import type {
  ComfyWorkflowJSON,
  ModelFile
} from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  refreshMissingModelPipeline,
  runMissingModelPipeline
} from '@/platform/missingModel/missingModelPipeline'
import { createNodeExecutionId } from '@/types/nodeIdentification'

const { mockHandles } = vi.hoisted(() => {
  const isAncestorPathActive = vi.fn((_graph: LGraph, _nodeId: string) => true)
  const isCandidateScopeActive = vi.fn(
    (graph: LGraph, candidate: MissingModelCandidate) => {
      const executionId = candidate.sourceExecutionId ?? candidate.nodeId
      return (
        executionId == null || isAncestorPathActive(graph, String(executionId))
      )
    }
  )
  const state = {
    enrichedCandidates: [] as MissingModelCandidate[]
  }

  return {
    mockHandles: {
      state,
      scanAllModelCandidates: vi.fn(
        (
          _graph: LGraph,
          _isAssetSupported: (nodeType: string, widgetName: string) => boolean,
          _getDirectory?: (nodeType: string) => string | undefined
        ): MissingModelCandidate[] => []
      ),
      enrichWithEmbeddedMetadata: vi.fn(
        (
          _candidates: readonly MissingModelCandidate[],
          _graphData: ComfyWorkflowJSON
        ) => state.enrichedCandidates
      ),
      verifyAssetSupportedCandidates: vi.fn(
        async (
          _candidates: readonly MissingModelCandidate[],
          _signal: AbortSignal
        ) => undefined
      ),
      assetService: {
        shouldUseWidgetAssetPicker: vi.fn()
      },
      api: {
        getFolderPaths: vi.fn()
      },
      fetchModelMetadata: vi.fn(),
      isAncestorPathActive,
      isCandidateScopeActive,
      isMissingCandidateActive: vi.fn(
        (_graph: LGraph, _candidate: MissingModelCandidate) => true
      )
    }
  }
})

vi.mock(import('@/platform/distribution/types'), async (importOriginal) => ({
  ...(await importOriginal<typeof DistributionModule>()),
  isCloud: false
}))

vi.mock<unknown>(import('@/platform/assets/services/assetService'), () => ({
  assetService: {
    shouldUseWidgetAssetPicker: (nodeType: string, widgetName: string) =>
      mockHandles.assetService.shouldUseWidgetAssetPicker(nodeType, widgetName)
  }
}))

beforeEach(() => {
  vi.mocked(useExecutionErrorStore().surfaceMissingModels).mockImplementation(
    () => undefined
  )
  vi.mocked(useToastStore().add).mockImplementation(() => undefined)
})

vi.mock<unknown>(import('@/platform/missingModel/missingModelScan'), () => ({
  scanAllModelCandidates: (
    graph: LGraph,
    isAssetSupported: (nodeType: string, widgetName: string) => boolean,
    getDirectory?: (nodeType: string) => string | undefined
  ) =>
    mockHandles.scanAllModelCandidates(graph, isAssetSupported, getDirectory),
  enrichWithEmbeddedMetadata: (
    candidates: readonly MissingModelCandidate[],
    graphData: ComfyWorkflowJSON
  ) => mockHandles.enrichWithEmbeddedMetadata(candidates, graphData),
  verifyAssetSupportedCandidates: (
    candidates: readonly MissingModelCandidate[],
    signal: AbortSignal
  ) => mockHandles.verifyAssetSupportedCandidates(candidates, signal)
}))

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    getFolderPaths: () => mockHandles.api.getFolderPaths()
  }
}))

vi.mock(import('@/platform/missingModel/missingModelDownload'), () => ({
  fetchModelMetadata: (url: string) => mockHandles.fetchModelMetadata(url)
}))

vi.mock<unknown>(import('@/utils/graphTraversalUtil'), () => ({
  isAncestorPathActive: (graph: LGraph, nodeId: string) =>
    mockHandles.isAncestorPathActive(graph, nodeId),
  isCandidateScopeActive: (graph: LGraph, candidate: MissingModelCandidate) =>
    mockHandles.isCandidateScopeActive(graph, candidate),
  isMissingCandidateActive: (graph: LGraph, candidate: MissingModelCandidate) =>
    mockHandles.isMissingCandidateActive(graph, candidate)
}))

function createWorkflowGraphData(): ComfyWorkflowJSON {
  return {
    last_node_id: 0,
    last_link_id: 0,
    nodes: [],
    links: [],
    groups: [],
    config: {},
    extra: {},
    version: 0.4
  }
}

function createGraph(graphData = createWorkflowGraphData()): LGraph {
  return {
    serialize: vi.fn(() => graphData)
  } as unknown as LGraph
}

describe('missingModelPipeline', () => {
  beforeEach(() => {
    mockHandles.state.enrichedCandidates = []
    useMissingModelStore().missingModelCandidates = null
    useWorkflowStore().activeWorkflow = null
    vi.mocked(
      useMissingModelStore().createVerificationAbortController
    ).mockImplementation(() => new AbortController())
    vi.mocked(useModelToNodeStore().getCategoryForNodeType).mockReturnValue(
      undefined
    )
    mockHandles.scanAllModelCandidates.mockReturnValue([])
    mockHandles.api.getFolderPaths.mockResolvedValue({})
    mockHandles.fetchModelMetadata.mockResolvedValue({
      fileSize: null,
      gatedRepoUrl: null
    })
    mockHandles.isAncestorPathActive.mockReturnValue(true)
    mockHandles.isCandidateScopeActive.mockImplementation(
      (graph: LGraph, candidate: MissingModelCandidate) => {
        const executionId = candidate.sourceExecutionId ?? candidate.nodeId
        return (
          executionId == null ||
          mockHandles.isAncestorPathActive(graph, String(executionId))
        )
      }
    )
    mockHandles.isMissingCandidateActive.mockReturnValue(true)
  })

  describe('refreshMissingModelPipeline', () => {
    it('reloads node definitions before scanning the current graph', async () => {
      const order: string[] = []
      const graph = createGraph()
      let resolveReload: () => void = () => {}
      const reloadNodeDefs = vi.fn(async () => {
        order.push('reload:start')
        await new Promise<void>((resolve) => {
          resolveReload = resolve
        })
        order.push('reload:end')
      })
      mockHandles.scanAllModelCandidates.mockImplementation(() => {
        order.push('scan')
        return []
      })

      const refreshPromise = refreshMissingModelPipeline({
        graph,
        reloadNodeDefs,
        missingModelStore: useMissingModelStore()
      })

      expect(order).toEqual(['reload:start'])
      resolveReload()
      await refreshPromise

      expect(order).toEqual(['reload:start', 'reload:end', 'scan'])
    })

    it('scans the current graph when node definition reload is omitted', async () => {
      await refreshMissingModelPipeline({
        graph: createGraph(),
        missingModelStore: useMissingModelStore()
      })

      expect(mockHandles.scanAllModelCandidates).toHaveBeenCalled()
    })

    it('reuses active workflow model metadata when refreshing the current graph', async () => {
      const activeModels: ModelFile[] = [
        {
          name: 'embedded.safetensors',
          url: 'https://example.com/embedded.safetensors',
          directory: 'checkpoints'
        }
      ]
      useWorkflowStore().activeWorkflow = fromPartial({
        activeState: { models: activeModels },
        pendingWarnings: null
      })
      useMissingModelStore().missingModelCandidates = [
        {
          nodeId: '1',
          nodeType: 'CheckpointLoaderSimple',
          widgetName: 'ckpt_name',
          name: 'candidate.safetensors',
          url: 'https://example.com/candidate.safetensors',
          directory: 'checkpoints',
          isMissing: true,
          isAssetSupported: true
        }
      ]

      await refreshMissingModelPipeline({
        graph: createGraph(),
        reloadNodeDefs: vi.fn(),
        missingModelStore: useMissingModelStore(),
        silent: false
      })

      expect(mockHandles.enrichWithEmbeddedMetadata).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ models: activeModels })
      )
      expect(
        useExecutionErrorStore().surfaceMissingModels
      ).toHaveBeenCalledWith([], { silent: false })
    })

    it('falls back to current missing model metadata when workflow state has no models', async () => {
      useMissingModelStore().missingModelCandidates = [
        {
          nodeId: '1',
          nodeType: 'CheckpointLoaderSimple',
          widgetName: 'ckpt_name',
          name: 'candidate.safetensors',
          url: 'https://example.com/candidate.safetensors',
          directory: 'checkpoints',
          hash: 'abc123',
          hashType: 'sha256',
          isMissing: true,
          isAssetSupported: true
        },
        {
          nodeId: '2',
          nodeType: 'CheckpointLoaderSimple',
          widgetName: 'ckpt_name',
          name: 'missing-url.safetensors',
          directory: 'checkpoints',
          isMissing: true,
          isAssetSupported: true
        }
      ]

      await refreshMissingModelPipeline({
        graph: createGraph(),
        reloadNodeDefs: vi.fn(),
        missingModelStore: useMissingModelStore()
      })

      expect(mockHandles.enrichWithEmbeddedMetadata).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          models: [
            {
              name: 'candidate.safetensors',
              url: 'https://example.com/candidate.safetensors',
              directory: 'checkpoints',
              hash: 'abc123',
              hash_type: 'sha256'
            }
          ]
        })
      )
      expect(
        useExecutionErrorStore().surfaceMissingModels
      ).toHaveBeenCalledWith([], { silent: true })
    })

    it('does not add model metadata when no active workflow or current candidate metadata exists', async () => {
      const graphData = createWorkflowGraphData()

      await refreshMissingModelPipeline({
        graph: createGraph(graphData),
        reloadNodeDefs: vi.fn(),
        missingModelStore: useMissingModelStore()
      })

      expect(mockHandles.enrichWithEmbeddedMetadata).toHaveBeenCalledWith(
        expect.any(Array),
        graphData
      )
    })

    it('rejects when injected node definition reload fails', async () => {
      const error = new Error('object_info failed')

      await expect(
        refreshMissingModelPipeline({
          graph: createGraph(),
          reloadNodeDefs: vi.fn().mockRejectedValue(error),
          missingModelStore: useMissingModelStore()
        })
      ).rejects.toThrow(error)

      expect(mockHandles.scanAllModelCandidates).not.toHaveBeenCalled()
    })
  })

  describe('runMissingModelPipeline', () => {
    it('returns confirmed missing models and caches pending warning candidates', async () => {
      const confirmedCandidate = {
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        name: 'missing.safetensors',
        url: 'https://example.com/missing.safetensors',
        directory: 'checkpoints',
        isMissing: true,
        isAssetSupported: true
      } satisfies MissingModelCandidate
      const installedCandidate = {
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        name: 'installed.safetensors',
        directory: 'checkpoints',
        isMissing: false,
        isAssetSupported: true
      } satisfies MissingModelCandidate
      const activeWorkflow = {
        activeState: createWorkflowGraphData(),
        pendingWarnings: null
      }
      mockHandles.state.enrichedCandidates = [
        confirmedCandidate,
        installedCandidate
      ]
      useWorkflowStore().activeWorkflow = fromPartial(activeWorkflow)

      const result = await runMissingModelPipeline({
        graph: createGraph(),
        graphData: createWorkflowGraphData(),
        missingModelStore: useMissingModelStore(),
        missingNodeTypes: ['MissingCustomNode']
      })
      await vi.dynamicImportSettled()

      expect(result).toEqual({
        missingModels: [
          {
            name: 'missing.safetensors',
            url: 'https://example.com/missing.safetensors',
            directory: 'checkpoints',
            hash: undefined,
            hash_type: undefined
          }
        ],
        confirmedCandidates: [confirmedCandidate]
      })
      expect(activeWorkflow.pendingWarnings).toEqual({
        missingNodeTypes: ['MissingCustomNode'],
        missingModelCandidates: [confirmedCandidate],
        missingMediaCandidates: undefined
      })
    })

    it('does not expose downloadable model metadata without a directory', async () => {
      const confirmedCandidate = {
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        name: 'missing.safetensors',
        url: 'https://example.com/missing.safetensors',
        isMissing: true,
        isAssetSupported: true
      } satisfies MissingModelCandidate
      mockHandles.state.enrichedCandidates = [confirmedCandidate]

      const result = await runMissingModelPipeline({
        graph: createGraph(),
        graphData: createWorkflowGraphData(),
        missingModelStore: useMissingModelStore()
      })

      expect(result).toEqual({
        missingModels: [],
        confirmedCandidates: [confirmedCandidate]
      })
    })

    it('fetches file sizes only for candidates with complete download metadata', async () => {
      const downloadableCandidate = {
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        name: 'downloadable.safetensors',
        url: 'https://example.com/downloadable.safetensors',
        directory: 'checkpoints',
        isMissing: true,
        isAssetSupported: true
      } satisfies MissingModelCandidate
      const urlOnlyCandidate = {
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        name: 'url-only.safetensors',
        url: 'https://example.com/url-only.safetensors',
        isMissing: true,
        isAssetSupported: true
      } satisfies MissingModelCandidate
      mockHandles.state.enrichedCandidates = [
        downloadableCandidate,
        urlOnlyCandidate
      ]
      mockHandles.fetchModelMetadata.mockResolvedValue({
        fileSize: 1024,
        gatedRepoUrl: null
      })

      await runMissingModelPipeline({
        graph: createGraph(),
        graphData: createWorkflowGraphData(),
        missingModelStore: useMissingModelStore()
      })
      await vi.dynamicImportSettled()

      expect(mockHandles.fetchModelMetadata).toHaveBeenCalledOnce()
      expect(mockHandles.fetchModelMetadata).toHaveBeenCalledWith(
        'https://example.com/downloadable.safetensors'
      )
      expect(useMissingModelStore().setFileSize).toHaveBeenCalledWith(
        'https://example.com/downloadable.safetensors',
        1024
      )
    })

    it('stores gated repo URLs for candidates with complete download metadata', async () => {
      const downloadableCandidate = {
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        name: 'gated.safetensors',
        url: 'https://huggingface.co/bfl/FLUX.1/resolve/main/gated.safetensors',
        directory: 'checkpoints',
        isMissing: true,
        isAssetSupported: true
      } satisfies MissingModelCandidate
      mockHandles.state.enrichedCandidates = [downloadableCandidate]
      mockHandles.fetchModelMetadata.mockResolvedValue({
        fileSize: null,
        gatedRepoUrl: 'https://huggingface.co/bfl/FLUX.1'
      })

      await runMissingModelPipeline({
        graph: createGraph(),
        graphData: createWorkflowGraphData(),
        missingModelStore: useMissingModelStore()
      })
      await vi.dynamicImportSettled()

      expect(useMissingModelStore().setGatedRepoUrl).toHaveBeenCalledWith(
        'https://huggingface.co/bfl/FLUX.1/resolve/main/gated.safetensors',
        'https://huggingface.co/bfl/FLUX.1'
      )
      expect(useMissingModelStore().setFileSize).not.toHaveBeenCalled()
    })

    it('does not store gated repo URLs after verification is aborted', async () => {
      const controller = new AbortController()
      const downloadableCandidate = {
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        name: 'gated.safetensors',
        url: 'https://huggingface.co/bfl/FLUX.1/resolve/main/gated.safetensors',
        directory: 'checkpoints',
        isMissing: true,
        isAssetSupported: true
      } satisfies MissingModelCandidate
      mockHandles.state.enrichedCandidates = [downloadableCandidate]
      vi.mocked(
        useMissingModelStore().createVerificationAbortController
      ).mockReturnValueOnce(controller)
      mockHandles.fetchModelMetadata.mockResolvedValue({
        fileSize: null,
        gatedRepoUrl: 'https://huggingface.co/bfl/FLUX.1'
      })
      controller.abort()

      await runMissingModelPipeline({
        graph: createGraph(),
        graphData: createWorkflowGraphData(),
        missingModelStore: useMissingModelStore()
      })
      await vi.dynamicImportSettled()

      expect(mockHandles.fetchModelMetadata).toHaveBeenCalledWith(
        'https://huggingface.co/bfl/FLUX.1/resolve/main/gated.safetensors'
      )
      expect(useMissingModelStore().setGatedRepoUrl).not.toHaveBeenCalled()
    })

    it('clears surfaced and cached missing models when no candidates are confirmed missing', async () => {
      const installedCandidate = {
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        name: 'installed.safetensors',
        directory: 'checkpoints',
        isMissing: false,
        isAssetSupported: true
      } satisfies MissingModelCandidate
      const activeWorkflow = {
        activeState: createWorkflowGraphData(),
        pendingWarnings: {
          missingModelCandidates: [
            {
              nodeType: 'CheckpointLoaderSimple',
              widgetName: 'ckpt_name',
              name: 'stale.safetensors',
              directory: 'checkpoints',
              isMissing: true,
              isAssetSupported: true
            }
          ],
          missingNodeTypes: undefined,
          missingMediaCandidates: undefined
        }
      }
      mockHandles.state.enrichedCandidates = [installedCandidate]
      useWorkflowStore().activeWorkflow = fromPartial(activeWorkflow)

      await runMissingModelPipeline({
        graph: createGraph(),
        graphData: createWorkflowGraphData(),
        missingModelStore: useMissingModelStore()
      })

      expect(
        useExecutionErrorStore().surfaceMissingModels
      ).toHaveBeenCalledWith([], { silent: false })
      expect(activeWorkflow.pendingWarnings).toBeNull()
    })

    it('drops candidates whose ancestor path is inactive', async () => {
      const activeCandidate = {
        nodeId: '1',
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        name: 'active.safetensors',
        directory: 'checkpoints',
        isMissing: true,
        isAssetSupported: true
      } satisfies MissingModelCandidate
      const inactiveCandidate = {
        nodeId: '2',
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        name: 'inactive.safetensors',
        directory: 'checkpoints',
        isMissing: true,
        isAssetSupported: true
      } satisfies MissingModelCandidate
      const activeWorkflow = {
        activeState: createWorkflowGraphData(),
        pendingWarnings: null
      }
      const graph = createGraph()
      mockHandles.state.enrichedCandidates = [
        activeCandidate,
        inactiveCandidate
      ]
      useWorkflowStore().activeWorkflow = fromPartial(activeWorkflow)
      mockHandles.isAncestorPathActive.mockImplementation(
        (_graph: LGraph, nodeId: string) => nodeId !== '2'
      )

      const result = await runMissingModelPipeline({
        graph,
        graphData: createWorkflowGraphData(),
        missingModelStore: useMissingModelStore()
      })

      expect(result.confirmedCandidates).toEqual([activeCandidate])
      expect(activeWorkflow.pendingWarnings).toEqual({
        missingNodeTypes: undefined,
        missingModelCandidates: [activeCandidate],
        missingMediaCandidates: undefined
      })
    })

    it('drops host-keyed promoted candidates whose source path is inactive', async () => {
      const promotedCandidate = {
        nodeId: '65',
        sourceExecutionId: createNodeExecutionId([65, 77, 42]),
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'outer_ckpt',
        name: 'inactive-source.safetensors',
        directory: 'checkpoints',
        isMissing: true,
        isAssetSupported: true
      }
      const activeWorkflow = {
        activeState: createWorkflowGraphData(),
        pendingWarnings: null
      }
      const graph = createGraph()
      mockHandles.state.enrichedCandidates = [promotedCandidate]
      useWorkflowStore().activeWorkflow = fromPartial(activeWorkflow)
      mockHandles.isAncestorPathActive.mockImplementation(
        (_graph: LGraph, nodeId: string) => nodeId !== '65:77:42'
      )

      const result = await runMissingModelPipeline({
        graph,
        graphData: createWorkflowGraphData(),
        missingModelStore: useMissingModelStore()
      })

      expect(result.confirmedCandidates).toEqual([])
      expect(activeWorkflow.pendingWarnings).toBeNull()
    })

    it('skips post-fetch surface when folder path refresh is aborted', async () => {
      const controller = new AbortController()
      const confirmedCandidate = {
        nodeId: '1',
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        name: 'missing.safetensors',
        directory: 'checkpoints',
        isMissing: true,
        isAssetSupported: true
      } satisfies MissingModelCandidate
      let resolveFolderPaths!: (paths: Record<string, string[]>) => void
      const folderPathsPromise = new Promise<Record<string, string[]>>(
        (resolve) => {
          resolveFolderPaths = resolve
        }
      )
      mockHandles.state.enrichedCandidates = [confirmedCandidate]
      vi.mocked(
        useMissingModelStore().createVerificationAbortController
      ).mockReturnValueOnce(controller)
      mockHandles.api.getFolderPaths.mockReturnValueOnce(folderPathsPromise)

      await runMissingModelPipeline({
        graph: createGraph(),
        graphData: createWorkflowGraphData(),
        missingModelStore: useMissingModelStore()
      })

      controller.abort()
      resolveFolderPaths({ checkpoints: ['/models/checkpoints'] })
      await folderPathsPromise
      // Settle both .then() and .finally() microtasks on getFolderPaths().
      await Promise.resolve()
      await Promise.resolve()

      expect(useMissingModelStore().setFolderPaths).not.toHaveBeenCalled()
      expect(
        useExecutionErrorStore().surfaceMissingModels
      ).not.toHaveBeenCalled()
    })
  })
})

vi.mock(import('@/scripts/app'), async () => {
  const { fromPartial } = await import('@total-typescript/shoehorn')
  return { app: fromPartial<ComfyApp>({}) }
})

vi.mock(import('firebase/auth'), async (importOriginal) => ({
  ...(await importOriginal()),
  setPersistence: vi.fn().mockResolvedValue(undefined),
  onAuthStateChanged: vi.fn(),
  onIdTokenChanged: vi.fn()
}))
