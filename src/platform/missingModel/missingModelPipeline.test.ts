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

const {
  mockMissingModelStore,
  mockWorkspaceWorkflow,
  mockExecutionErrorStore,
  mockModelStore,
  mockModelToNodeStore,
  mockScanAllModelCandidates,
  mockEnrichWithEmbeddedMetadata,
  mockVerifyAssetSupportedCandidates,
  mockToastStore,
  mockAssetService,
  mockApi,
  mockIsAncestorPathActive,
  mockIsMissingCandidateActive,
  state
} = vi.hoisted(() => {
  const state = {
    enrichedCandidates: [] as MissingModelCandidate[]
  }

  return {
    state,
    mockMissingModelStore: {
      missingModelCandidates: null as MissingModelCandidate[] | null,
      createVerificationAbortController: vi.fn(() => new AbortController()),
      setFolderPaths: vi.fn(),
      setFileSize: vi.fn()
    },
    mockWorkspaceWorkflow: {
      activeWorkflow: null as {
        activeState?: Pick<ComfyWorkflowJSON, 'models'> | null
        pendingWarnings?: unknown
      } | null
    },
    mockExecutionErrorStore: {
      surfaceMissingModels: vi.fn()
    },
    mockModelStore: {
      loadModelFolders: vi.fn(),
      getLoadedModelFolder: vi.fn()
    },
    mockModelToNodeStore: {
      getCategoryForNodeType: vi.fn()
    },
    mockScanAllModelCandidates: vi.fn(),
    mockEnrichWithEmbeddedMetadata: vi.fn(async () => state.enrichedCandidates),
    mockVerifyAssetSupportedCandidates: vi.fn(),
    mockToastStore: {
      add: vi.fn()
    },
    mockAssetService: {
      shouldUseAssetBrowser: vi.fn()
    },
    mockApi: {
      getFolderPaths: vi.fn()
    },
    mockIsAncestorPathActive: vi.fn(),
    mockIsMissingCandidateActive: vi.fn()
  }
})

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: mockAssetService
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => ({
    workflow: mockWorkspaceWorkflow
  })
}))

vi.mock('@/stores/executionErrorStore', () => ({
  useExecutionErrorStore: () => mockExecutionErrorStore
}))

vi.mock('@/stores/modelStore', () => ({
  useModelStore: () => mockModelStore
}))

vi.mock('@/stores/modelToNodeStore', () => ({
  useModelToNodeStore: () => mockModelToNodeStore
}))

vi.mock('@/platform/missingModel/missingModelScan', () => ({
  scanAllModelCandidates: mockScanAllModelCandidates,
  enrichWithEmbeddedMetadata: mockEnrichWithEmbeddedMetadata,
  verifyAssetSupportedCandidates: mockVerifyAssetSupportedCandidates
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => mockToastStore
}))

vi.mock('@/scripts/api', () => ({
  api: mockApi
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  isAncestorPathActive: mockIsAncestorPathActive,
  isMissingCandidateActive: mockIsMissingCandidateActive
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
    vi.clearAllMocks()
    state.enrichedCandidates = []
    mockMissingModelStore.missingModelCandidates = null
    mockWorkspaceWorkflow.activeWorkflow = null
    mockModelStore.loadModelFolders.mockResolvedValue(undefined)
    mockModelStore.getLoadedModelFolder.mockResolvedValue(undefined)
    mockModelToNodeStore.getCategoryForNodeType.mockReturnValue(undefined)
    mockScanAllModelCandidates.mockReturnValue([])
    mockApi.getFolderPaths.mockResolvedValue({})
    mockIsAncestorPathActive.mockReturnValue(true)
    mockIsMissingCandidateActive.mockReturnValue(true)
  })

  describe('refreshMissingModelPipeline', () => {
    it('reloads node definitions before scanning the current graph', async () => {
      const order: string[] = []
      const graph = createGraph()
      const reloadNodeDefs = vi.fn(async () => {
        order.push('reload')
      })
      mockScanAllModelCandidates.mockImplementation(() => {
        order.push('scan')
        return []
      })

      await refreshMissingModelPipeline({
        graph,
        reloadNodeDefs,
        missingModelStore: mockMissingModelStore
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
      mockWorkspaceWorkflow.activeWorkflow = {
        activeState: { models: activeModels },
        pendingWarnings: null
      }
      mockMissingModelStore.missingModelCandidates = [
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
        missingModelStore: mockMissingModelStore,
        silent: false
      })

      expect(mockEnrichWithEmbeddedMetadata).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ models: activeModels }),
        expect.any(Function),
        undefined
      )
      expect(mockExecutionErrorStore.surfaceMissingModels).toHaveBeenCalledWith(
        [],
        { silent: false }
      )
    })

    it('falls back to current missing model metadata when workflow state has no models', async () => {
      mockMissingModelStore.missingModelCandidates = [
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
        missingModelStore: mockMissingModelStore
      })

      expect(mockEnrichWithEmbeddedMetadata).toHaveBeenCalledWith(
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
      expect(mockExecutionErrorStore.surfaceMissingModels).toHaveBeenCalledWith(
        [],
        { silent: true }
      )
    })

    it('does not add model metadata when no active workflow or current candidate metadata exists', async () => {
      const graphData = createWorkflowGraphData()

      await refreshMissingModelPipeline({
        graph: createGraph(graphData),
        reloadNodeDefs: vi.fn(),
        missingModelStore: mockMissingModelStore
      })

      expect(mockEnrichWithEmbeddedMetadata).toHaveBeenCalledWith(
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
          missingModelStore: mockMissingModelStore
        })
      ).rejects.toThrow(error)

      expect(mockScanAllModelCandidates).not.toHaveBeenCalled()
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
      state.enrichedCandidates = [confirmedCandidate, installedCandidate]
      mockWorkspaceWorkflow.activeWorkflow = activeWorkflow

      const result = await runMissingModelPipeline({
        graph: createGraph(),
        graphData: createWorkflowGraphData(),
        missingModelStore: mockMissingModelStore,
        missingNodeTypes: ['MissingCustomNode']
      })

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
      state.enrichedCandidates = [confirmedCandidate]

      const result = await runMissingModelPipeline({
        graph: createGraph(),
        graphData: createWorkflowGraphData(),
        missingModelStore: mockMissingModelStore
      })

      expect(result).toEqual({
        missingModels: [],
        confirmedCandidates: [confirmedCandidate]
      })
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
      state.enrichedCandidates = [installedCandidate]
      mockWorkspaceWorkflow.activeWorkflow = activeWorkflow

      await runMissingModelPipeline({
        graph: createGraph(),
        graphData: createWorkflowGraphData(),
        missingModelStore: mockMissingModelStore
      })

      expect(mockExecutionErrorStore.surfaceMissingModels).toHaveBeenCalledWith(
        [],
        { silent: false }
      )
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
      state.enrichedCandidates = [activeCandidate, inactiveCandidate]
      mockWorkspaceWorkflow.activeWorkflow = activeWorkflow
      mockIsAncestorPathActive.mockImplementation(
        (_graph: LGraph, nodeId: string) => nodeId !== '2'
      )

      const result = await runMissingModelPipeline({
        graph,
        graphData: createWorkflowGraphData(),
        missingModelStore: mockMissingModelStore
      })

      expect(mockIsAncestorPathActive).toHaveBeenCalledWith(graph, '1')
      expect(mockIsAncestorPathActive).toHaveBeenCalledWith(graph, '2')
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
      state.enrichedCandidates = [confirmedCandidate]
      mockMissingModelStore.createVerificationAbortController.mockReturnValueOnce(
        controller
      )
      mockApi.getFolderPaths.mockReturnValueOnce(folderPathsPromise)

      await runMissingModelPipeline({
        graph: createGraph(),
        graphData: createWorkflowGraphData(),
        missingModelStore: mockMissingModelStore
      })

      controller.abort()
      resolveFolderPaths({ checkpoints: ['/models/checkpoints'] })
      await folderPathsPromise
      await Promise.resolve()

      expect(mockMissingModelStore.setFolderPaths).not.toHaveBeenCalled()
      expect(
        mockExecutionErrorStore.surfaceMissingModels
      ).not.toHaveBeenCalled()
    })
  })
})
