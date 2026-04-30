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

const { mockHandles, createMocks } = vi.hoisted(() => {
  function createMocks() {
    const state = {
      enrichedCandidates: [] as MissingModelCandidate[]
    }

    return {
      state,
      missingModelStore: {
        missingModelCandidates: null as MissingModelCandidate[] | null,
        createVerificationAbortController: vi.fn(() => new AbortController()),
        setFolderPaths: vi.fn(),
        setFileSize: vi.fn()
      },
      workspaceWorkflow: {
        activeWorkflow: null as {
          activeState?: Pick<ComfyWorkflowJSON, 'models'> | null
          pendingWarnings?: unknown
        } | null
      },
      executionErrorStore: {
        surfaceMissingModels: vi.fn()
      },
      modelStore: {
        loadModelFolders: vi.fn(),
        getLoadedModelFolder: vi.fn()
      },
      modelToNodeStore: {
        getCategoryForNodeType: vi.fn()
      },
      scanAllModelCandidates: vi.fn(
        (
          _graph: LGraph,
          _isAssetSupported: (nodeType: string, widgetName: string) => boolean,
          _getDirectory?: (nodeType: string) => string | undefined
        ): MissingModelCandidate[] => []
      ),
      enrichWithEmbeddedMetadata: vi.fn(
        async (
          _candidates: readonly MissingModelCandidate[],
          _graphData: ComfyWorkflowJSON,
          _checkModelInstalled: (
            name: string,
            directory: string
          ) => Promise<boolean>,
          _isAssetSupported?: (nodeType: string, widgetName: string) => boolean
        ) => state.enrichedCandidates
      ),
      verifyAssetSupportedCandidates: vi.fn(
        async (
          _candidates: readonly MissingModelCandidate[],
          _signal: AbortSignal
        ) => undefined
      ),
      toastStore: {
        add: vi.fn()
      },
      assetService: {
        shouldUseAssetBrowser: vi.fn()
      },
      api: {
        getFolderPaths: vi.fn()
      },
      fetchModelMetadata: vi.fn(),
      isAncestorPathActive: vi.fn((_graph: LGraph, _nodeId: string) => true),
      isMissingCandidateActive: vi.fn(
        (_graph: LGraph, _candidate: MissingModelCandidate) => true
      )
    }
  }

  return {
    createMocks,
    mockHandles: createMocks()
  }
})

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    shouldUseAssetBrowser: (nodeType: string, widgetName: string) =>
      mockHandles.assetService.shouldUseAssetBrowser(nodeType, widgetName)
  }
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => ({
    workflow: mockHandles.workspaceWorkflow
  })
}))

vi.mock('@/stores/executionErrorStore', () => ({
  useExecutionErrorStore: () => mockHandles.executionErrorStore
}))

vi.mock('@/stores/modelStore', () => ({
  useModelStore: () => mockHandles.modelStore
}))

vi.mock('@/stores/modelToNodeStore', () => ({
  useModelToNodeStore: () => mockHandles.modelToNodeStore
}))

vi.mock('@/platform/missingModel/missingModelScan', () => ({
  scanAllModelCandidates: (
    graph: LGraph,
    isAssetSupported: (nodeType: string, widgetName: string) => boolean,
    getDirectory?: (nodeType: string) => string | undefined
  ) =>
    mockHandles.scanAllModelCandidates(graph, isAssetSupported, getDirectory),
  enrichWithEmbeddedMetadata: (
    candidates: readonly MissingModelCandidate[],
    graphData: ComfyWorkflowJSON,
    checkModelInstalled: (name: string, directory: string) => Promise<boolean>,
    isAssetSupported?: (nodeType: string, widgetName: string) => boolean
  ) =>
    mockHandles.enrichWithEmbeddedMetadata(
      candidates,
      graphData,
      checkModelInstalled,
      isAssetSupported
    ),
  verifyAssetSupportedCandidates: (
    candidates: readonly MissingModelCandidate[],
    signal: AbortSignal
  ) => mockHandles.verifyAssetSupportedCandidates(candidates, signal)
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => mockHandles.toastStore
}))

vi.mock('@/scripts/api', () => ({
  api: {
    getFolderPaths: () => mockHandles.api.getFolderPaths()
  }
}))

vi.mock('@/platform/missingModel/missingModelDownload', () => ({
  fetchModelMetadata: (url: string) => mockHandles.fetchModelMetadata(url)
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  isAncestorPathActive: (graph: LGraph, nodeId: string) =>
    mockHandles.isAncestorPathActive(graph, nodeId),
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
    Object.assign(mockHandles, createMocks())
    mockHandles.modelStore.loadModelFolders.mockResolvedValue(undefined)
    mockHandles.modelStore.getLoadedModelFolder.mockResolvedValue(undefined)
    mockHandles.modelToNodeStore.getCategoryForNodeType.mockReturnValue(
      undefined
    )
    mockHandles.scanAllModelCandidates.mockReturnValue([])
    mockHandles.api.getFolderPaths.mockResolvedValue({})
    mockHandles.fetchModelMetadata.mockResolvedValue({ fileSize: null })
    mockHandles.isAncestorPathActive.mockReturnValue(true)
    mockHandles.isMissingCandidateActive.mockReturnValue(true)
  })

  describe('refreshMissingModelPipeline', () => {
    it('reloads node definitions before scanning the current graph', async () => {
      const order: string[] = []
      const graph = createGraph()
      const reloadNodeDefs = vi.fn(async () => {
        order.push('reload')
      })
      mockHandles.scanAllModelCandidates.mockImplementation(() => {
        order.push('scan')
        return []
      })

      await refreshMissingModelPipeline({
        graph,
        reloadNodeDefs,
        missingModelStore: mockHandles.missingModelStore
      })

      expect(order).toEqual(['reload', 'scan'])
    })

    it('reuses active workflow model metadata when refreshing the current graph', async () => {
      const activeModels: ModelFile[] = [
        {
          name: 'embedded.safetensors',
          url: 'https://example.com/embedded.safetensors',
          directory: 'checkpoints'
        }
      ]
      mockHandles.workspaceWorkflow.activeWorkflow = {
        activeState: { models: activeModels },
        pendingWarnings: null
      }
      mockHandles.missingModelStore.missingModelCandidates = [
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
        missingModelStore: mockHandles.missingModelStore,
        silent: false
      })

      expect(mockHandles.enrichWithEmbeddedMetadata).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ models: activeModels }),
        expect.any(Function),
        undefined
      )
      expect(
        mockHandles.executionErrorStore.surfaceMissingModels
      ).toHaveBeenCalledWith([], { silent: false })
    })

    it('falls back to current missing model metadata when workflow state has no models', async () => {
      mockHandles.missingModelStore.missingModelCandidates = [
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
        missingModelStore: mockHandles.missingModelStore
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
        }),
        expect.any(Function),
        undefined
      )
      expect(
        mockHandles.executionErrorStore.surfaceMissingModels
      ).toHaveBeenCalledWith([], { silent: true })
    })

    it('does not add model metadata when no active workflow or current candidate metadata exists', async () => {
      const graphData = createWorkflowGraphData()

      await refreshMissingModelPipeline({
        graph: createGraph(graphData),
        reloadNodeDefs: vi.fn(),
        missingModelStore: mockHandles.missingModelStore
      })

      expect(mockHandles.enrichWithEmbeddedMetadata).toHaveBeenCalledWith(
        expect.any(Array),
        graphData,
        expect.any(Function),
        undefined
      )
    })

    it('rejects when injected node definition reload fails', async () => {
      const error = new Error('object_info failed')

      await expect(
        refreshMissingModelPipeline({
          graph: createGraph(),
          reloadNodeDefs: vi.fn().mockRejectedValue(error),
          missingModelStore: mockHandles.missingModelStore
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
        activeState: null,
        pendingWarnings: null
      }
      mockHandles.state.enrichedCandidates = [
        confirmedCandidate,
        installedCandidate
      ]
      mockHandles.workspaceWorkflow.activeWorkflow = activeWorkflow

      const result = await runMissingModelPipeline({
        graph: createGraph(),
        graphData: createWorkflowGraphData(),
        missingModelStore: mockHandles.missingModelStore,
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
        missingModelStore: mockHandles.missingModelStore
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
      mockHandles.fetchModelMetadata.mockResolvedValue({ fileSize: 1024 })

      await runMissingModelPipeline({
        graph: createGraph(),
        graphData: createWorkflowGraphData(),
        missingModelStore: mockHandles.missingModelStore
      })
      await vi.dynamicImportSettled()

      expect(mockHandles.fetchModelMetadata).toHaveBeenCalledOnce()
      expect(mockHandles.fetchModelMetadata).toHaveBeenCalledWith(
        'https://example.com/downloadable.safetensors'
      )
      expect(mockHandles.missingModelStore.setFileSize).toHaveBeenCalledWith(
        'https://example.com/downloadable.safetensors',
        1024
      )
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
        activeState: null,
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
      mockHandles.workspaceWorkflow.activeWorkflow = activeWorkflow

      await runMissingModelPipeline({
        graph: createGraph(),
        graphData: createWorkflowGraphData(),
        missingModelStore: mockHandles.missingModelStore
      })

      expect(
        mockHandles.executionErrorStore.surfaceMissingModels
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
        activeState: null,
        pendingWarnings: null
      }
      const graph = createGraph()
      mockHandles.state.enrichedCandidates = [
        activeCandidate,
        inactiveCandidate
      ]
      mockHandles.workspaceWorkflow.activeWorkflow = activeWorkflow
      mockHandles.isAncestorPathActive.mockImplementation(
        (_graph: LGraph, nodeId: string) => nodeId !== '2'
      )

      const result = await runMissingModelPipeline({
        graph,
        graphData: createWorkflowGraphData(),
        missingModelStore: mockHandles.missingModelStore
      })

      expect(result.confirmedCandidates).toEqual([activeCandidate])
      expect(activeWorkflow.pendingWarnings).toEqual({
        missingNodeTypes: undefined,
        missingModelCandidates: [activeCandidate],
        missingMediaCandidates: undefined
      })
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
      mockHandles.missingModelStore.createVerificationAbortController.mockReturnValueOnce(
        controller
      )
      mockHandles.api.getFolderPaths.mockReturnValueOnce(folderPathsPromise)

      await runMissingModelPipeline({
        graph: createGraph(),
        graphData: createWorkflowGraphData(),
        missingModelStore: mockHandles.missingModelStore
      })

      controller.abort()
      resolveFolderPaths({ checkpoints: ['/models/checkpoints'] })
      await folderPathsPromise
      // Let the getFolderPaths().then().finally() chain settle so this fails
      // if the abort guards are removed from either continuation.
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(
        mockHandles.missingModelStore.setFolderPaths
      ).not.toHaveBeenCalled()
      expect(
        mockHandles.executionErrorStore.surfaceMissingModels
      ).not.toHaveBeenCalled()
    })
  })
})
