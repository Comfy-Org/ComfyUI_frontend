import { useToast } from '@/components/ui/toast'
import { fromPartial } from '@total-typescript/shoehorn'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useMissingModelStore } from './missingModelStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { LGraphNode, LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { promoteValueWidgetViaSubgraphInput } from '@/core/graph/subgraph/promotionUtils'
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
import { toNodeId } from '@/types/nodeId'
import { t } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

vi.mock(import('@/platform/telemetry/reportError'))

import * as graphTraversal from '@/utils/graphTraversalUtil'

vi.mock(import('@/utils/graphTraversalUtil'), { spy: true })

const { mockHandles } = vi.hoisted(() => {
  const state = {
    enrichedCandidates: [] as MissingModelCandidate[]
  }

  return {
    mockHandles: {
      state,
      distribution: { isCloud: false },
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
      hasPendingVerification: vi.fn(
        (_candidate: MissingModelCandidate) => false
      ),
      verifyAssetSupportedCandidates: vi.fn(
        async (
          _candidates: readonly MissingModelCandidate[],
          _signal: AbortSignal
        ) => undefined
      ),
      toastStore: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
        loading: vi.fn(),
        custom: vi.fn()
      },
      assetService: {
        shouldUseWidgetAssetPicker: vi.fn()
      },
      api: {
        getFolderPaths: vi.fn()
      },
      fetchModelMetadata: vi.fn()
    }
  }
})

vi.mock(import('@/platform/distribution/types'), () => mockHandles.distribution)

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
})

vi.mock<unknown>(import('@/platform/missingModel/missingModelScan'), () => ({
  hasPendingVerification: (candidate: MissingModelCandidate) =>
    mockHandles.hasPendingVerification(candidate),
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

beforeEach(() => {
  vi.mocked(useToast().success).mockImplementation(
    mockHandles.toastStore.success
  )
  vi.mocked(useToast().error).mockImplementation(mockHandles.toastStore.error)
  vi.mocked(useToast().info).mockImplementation(mockHandles.toastStore.info)
  vi.mocked(useToast().warning).mockImplementation(
    mockHandles.toastStore.warning
  )
  vi.mocked(useToast().loading).mockImplementation(
    mockHandles.toastStore.loading
  )
  vi.mocked(useToast().custom).mockImplementation(mockHandles.toastStore.custom)
})

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    getFolderPaths: () => mockHandles.api.getFolderPaths()
  }
}))

vi.mock(import('@/platform/missingModel/missingModelDownload'), () => ({
  fetchModelMetadata: (url: string) => mockHandles.fetchModelMetadata(url)
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

function deferModelVerification() {
  let resolveVerification: (() => void) | undefined
  const pending = new Promise<void>((resolve) => {
    resolveVerification = resolve
  })
  mockHandles.verifyAssetSupportedCandidates.mockImplementationOnce(
    async (candidates) => {
      await pending
      for (const candidate of candidates) candidate.isMissing = true
    }
  )
  if (!resolveVerification) throw new Error('Expected pending verification')
  return resolveVerification
}

describe('missingModelPipeline', () => {
  beforeEach(() => {
    mockHandles.distribution.isCloud = false
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
    mockHandles.verifyAssetSupportedCandidates.mockResolvedValue(undefined)
    mockHandles.hasPendingVerification.mockReturnValue(false)
    vi.mocked(graphTraversal.getNodeByExecutionId).mockReturnValue(null)
    mockHandles.api.getFolderPaths.mockResolvedValue({})
    mockHandles.fetchModelMetadata.mockResolvedValue({
      fileSize: null,
      gatedRepoUrl: null
    })
    vi.mocked(graphTraversal.isCandidateScopeActive).mockReturnValue(true)
    vi.mocked(graphTraversal.isMissingCandidateActive).mockImplementation(
      (graph, candidate) =>
        candidate.isMissing === true &&
        vi.mocked(graphTraversal.isCandidateScopeActive)(graph, candidate)
    )
  })

  it.for([
    { isCloud: true, outcome: 'verified', resolvedMissing: true },
    { isCloud: true, outcome: 'verified', resolvedMissing: false },
    { isCloud: true, outcome: 'failed', resolvedMissing: undefined },
    { isCloud: true, outcome: 'aborted', resolvedMissing: undefined },
    { isCloud: false, outcome: 'verified', resolvedMissing: true },
    { isCloud: false, outcome: 'verified', resolvedMissing: false },
    { isCloud: false, outcome: 'failed', resolvedMissing: undefined },
    { isCloud: false, outcome: 'aborted', resolvedMissing: undefined }
  ] as const)(
    'reports verification completion without waiting in the load: cloud=$isCloud, $outcome, missing=$resolvedMissing',
    async ({ isCloud, outcome, resolvedMissing }) => {
      mockHandles.distribution.isCloud = isCloud
      mockHandles.hasPendingVerification.mockReturnValue(true)
      const candidate: MissingModelCandidate = {
        nodeId: createNodeExecutionId([1]),
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        name: 'model.safetensors',
        isAssetSupported: true,
        isMissing: undefined
      }
      mockHandles.state.enrichedCandidates = [candidate]
      const node = new LGraphNode(candidate.nodeType)
      node.widgets = fromPartial([
        { name: candidate.widgetName, value: candidate.name }
      ])
      vi.mocked(graphTraversal.getNodeByExecutionId).mockReturnValue(node)
      let finishVerification = () => {}
      const pending = new Promise<void>((resolve) => {
        finishVerification = resolve
      })
      mockHandles.verifyAssetSupportedCandidates.mockImplementationOnce(
        async () => {
          await pending
          if (outcome === 'failed') throw new Error('asset service unavailable')
          candidate.isMissing = resolvedMissing
        }
      )
      const controller = new AbortController()
      const missingModelStore = useMissingModelStore()
      vi.mocked(
        missingModelStore.createVerificationAbortController
      ).mockReturnValue(controller)
      const onVerified = vi.fn()

      await runMissingModelPipeline({
        graph: createGraph(),
        graphData: createWorkflowGraphData(),
        missingModelStore,
        onVerified
      })
      expect(onVerified).not.toHaveBeenCalled()
      if (outcome === 'aborted') controller.abort()
      finishVerification()
      await vi.runAllTimersAsync()

      if (outcome === 'verified')
        expect(onVerified).toHaveBeenCalledWith([
          { ...candidate, isMissing: resolvedMissing }
        ])
      else expect(onVerified).not.toHaveBeenCalled()
      if (outcome === 'failed') {
        expect(useToast().warning).toHaveBeenCalledWith(
          t('toastMessages.missingModelVerificationFailed'),
          { duration: 5000 }
        )
        expect(reportError).toHaveBeenCalledWith(
          new Error('asset service unavailable'),
          { errorType: 'missing_model_verification_failed' }
        )
      } else {
        expect(useToast().warning).not.toHaveBeenCalled()
        expect(reportError).not.toHaveBeenCalled()
      }
    }
  )

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
    it.for([
      { change: 'removed', widgets: [] },
      {
        change: 'renamed',
        widgets: [{ name: 'renamed_ckpt', value: 'missing.safetensors' }]
      },
      {
        change: 'changed',
        widgets: [{ name: 'ckpt_name', value: 'replacement.safetensors' }]
      }
    ])(
      'excludes a candidate whose widget was $change during verification',
      async ({ widgets }) => {
        mockHandles.distribution.isCloud = true
        const candidate: MissingModelCandidate = {
          nodeId: '7',
          nodeType: 'CheckpointLoaderSimple',
          widgetName: 'ckpt_name',
          name: 'missing.safetensors',
          isMissing: undefined,
          isAssetSupported: true
        }
        const node = new LGraphNode(candidate.nodeType)
        node.widgets = fromPartial([
          { name: candidate.widgetName, value: candidate.name }
        ])
        mockHandles.state.enrichedCandidates = [candidate]
        vi.mocked(graphTraversal.getNodeByExecutionId).mockReturnValue(node)
        const finishVerification = deferModelVerification()
        const onVerified = vi.fn()

        await runMissingModelPipeline({
          graph: createGraph(),
          graphData: createWorkflowGraphData(),
          missingModelStore: useMissingModelStore(),
          onVerified
        })
        expect(onVerified).not.toHaveBeenCalled()
        node.widgets = fromPartial(widgets)
        finishVerification()

        await vi.waitFor(() => {
          expect(onVerified).toHaveBeenCalledWith([])
          expect(
            useExecutionErrorStore().surfaceMissingModels
          ).toHaveBeenCalledWith([], { silent: false })
        })
      }
    )

    it.for([
      {
        selected: 'missing.safetensors',
        consumerMode: LGraphEventMode.ALWAYS,
        retained: true
      },
      {
        selected: 'replacement.safetensors',
        consumerMode: LGraphEventMode.ALWAYS,
        retained: false
      },
      {
        selected: 'missing.safetensors',
        consumerMode: LGraphEventMode.NEVER,
        retained: false
      },
      {
        selected: 'missing.safetensors',
        consumerMode: LGraphEventMode.BYPASS,
        retained: false
      }
    ])(
      'checks the promoted selection and active consumer despite a bypassed owner: $selected, mode=$consumerMode',
      async ({ selected, consumerMode, retained }) => {
        mockHandles.distribution.isCloud = true
        vi.mocked(graphTraversal.getNodeByExecutionId).mockReset()
        vi.mocked(graphTraversal.isCandidateScopeActive).mockReset()
        vi.mocked(graphTraversal.isMissingCandidateActive).mockReset()
        const subgraph = createTestSubgraph()
        const host = createTestSubgraphNode(subgraph, { id: 65 })
        subgraph.rootGraph.add(host)
        const [storedOwner, activeConsumer] = [42, 43].map((id) => {
          const node = new LGraphNode('CheckpointLoaderSimple')
          node.id = toNodeId(id)
          const input = node.addInput('ckpt_name', 'COMBO')
          const widget = node.addWidget(
            'combo',
            'ckpt_name',
            'missing.safetensors',
            () => {},
            { values: ['missing.safetensors', 'replacement.safetensors'] }
          )
          input.widget = { name: widget.name }
          subgraph.add(node)
          return { node, input, widget }
        })
        expect(
          promoteValueWidgetViaSubgraphInput(
            host,
            storedOwner.node,
            storedOwner.widget
          ).ok
        ).toBe(true)
        expect(
          subgraph.inputNode.slots[0].connect(
            activeConsumer.input,
            activeConsumer.node
          )
        ).toBeTruthy()
        storedOwner.node.mode = LGraphEventMode.BYPASS
        host.widgets[0].value = 'missing.safetensors'
        const candidate: MissingModelCandidate = {
          nodeId: createNodeExecutionId([65]),
          sourceExecutionId: createNodeExecutionId([65, 42]),
          promotedSources: [
            {
              executionId: createNodeExecutionId([65, 43]),
              widgetName: 'ckpt_name'
            }
          ],
          nodeType: 'CheckpointLoaderSimple',
          widgetName: 'ckpt_name',
          name: 'missing.safetensors',
          isMissing: undefined,
          isAssetSupported: true
        }
        mockHandles.state.enrichedCandidates = [candidate]
        const finishVerification = deferModelVerification()
        const onVerified = vi.fn()

        await runMissingModelPipeline({
          graph: subgraph.rootGraph,
          graphData: createWorkflowGraphData(),
          missingModelStore: useMissingModelStore(),
          onVerified
        })
        expect(onVerified).not.toHaveBeenCalled()
        host.widgets[0].value = selected
        activeConsumer.node.mode = consumerMode
        finishVerification()

        await vi.waitFor(() => {
          expect(onVerified).toHaveBeenCalledWith(retained ? [candidate] : [])
          expect(
            useExecutionErrorStore().surfaceMissingModels
          ).toHaveBeenCalledWith(retained ? [candidate] : [], { silent: false })
        })
      }
    )

    it('surfaces a verified remote candidate without waiting for its download metadata', async () => {
      const remoteCandidate: MissingModelCandidate = {
        nodeType: 'RemoteFileNode',
        widgetName: 'file_name',
        name: 'selected.safetensors',
        url: 'https://example.com/selected.safetensors',
        directory: 'checkpoints',
        isMissing: undefined,
        isAssetSupported: false
      }
      let finishMetadata = () => {}
      mockHandles.fetchModelMetadata.mockReturnValue(
        new Promise((resolve) => {
          finishMetadata = () =>
            resolve({
              fileSize: 2048,
              gatedRepoUrl: 'https://example.com/gated-repo'
            })
        })
      )
      mockHandles.state.enrichedCandidates = [remoteCandidate]
      mockHandles.hasPendingVerification.mockImplementation(
        (candidate) => candidate === remoteCandidate
      )
      mockHandles.verifyAssetSupportedCandidates.mockImplementation(
        async () => {
          remoteCandidate.isMissing = true
        }
      )
      mockHandles.api.getFolderPaths.mockResolvedValue({
        checkpoints: ['/models/checkpoints']
      })

      await runMissingModelPipeline({
        graph: createGraph(),
        graphData: createWorkflowGraphData(),
        missingModelStore: useMissingModelStore()
      })
      await vi.dynamicImportSettled()

      expect(useMissingModelStore().setFolderPaths).toHaveBeenCalledWith({
        checkpoints: ['/models/checkpoints']
      })
      expect(
        useExecutionErrorStore().surfaceMissingModels
      ).toHaveBeenCalledTimes(1)
      expect(
        useExecutionErrorStore().surfaceMissingModels
      ).toHaveBeenCalledWith([remoteCandidate], { silent: false })

      finishMetadata()
      await vi.waitFor(() => {
        expect(useMissingModelStore().setFileSize).toHaveBeenCalledWith(
          remoteCandidate.url,
          2048
        )
        expect(useMissingModelStore().setGatedRepoUrl).toHaveBeenCalledWith(
          remoteCandidate.url,
          'https://example.com/gated-repo'
        )
      })
    })

    it('drops a candidate whose selection changed while folder paths were loading', async () => {
      const confirmedCandidate = {
        nodeId: '7',
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        name: 'missing.safetensors',
        isMissing: true,
        isAssetSupported: false
      } satisfies MissingModelCandidate
      mockHandles.state.enrichedCandidates = [confirmedCandidate]
      const widget = { name: 'ckpt_name', value: 'missing.safetensors' }
      vi.mocked(graphTraversal.getNodeByExecutionId).mockReturnValue({
        widgets: [widget]
      } as unknown as LGraphNode)
      let resolveFolderPaths: (paths: Record<string, string[]>) => void = () =>
        undefined
      mockHandles.api.getFolderPaths.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFolderPaths = resolve
        })
      )

      await runMissingModelPipeline({
        graph: createGraph(),
        graphData: createWorkflowGraphData(),
        missingModelStore: useMissingModelStore()
      })
      widget.value = 'installed.safetensors'
      resolveFolderPaths({})
      await vi.dynamicImportSettled()

      expect(
        useExecutionErrorStore().surfaceMissingModels
      ).toHaveBeenLastCalledWith([], { silent: false })
    })

    it('drops a candidate that became inactive while folder paths were loading', async () => {
      const confirmedCandidate = {
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        name: 'missing.safetensors',
        isMissing: true,
        isAssetSupported: false
      } satisfies MissingModelCandidate
      mockHandles.state.enrichedCandidates = [confirmedCandidate]
      let resolveFolderPaths: (paths: Record<string, string[]>) => void = () =>
        undefined
      mockHandles.api.getFolderPaths.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFolderPaths = resolve
        })
      )

      await runMissingModelPipeline({
        graph: createGraph(),
        graphData: createWorkflowGraphData(),
        missingModelStore: useMissingModelStore()
      })
      vi.mocked(graphTraversal.isMissingCandidateActive).mockReturnValue(false)
      resolveFolderPaths({})
      await vi.dynamicImportSettled()

      expect(
        useExecutionErrorStore().surfaceMissingModels
      ).toHaveBeenLastCalledWith([], { silent: false })
    })

    it('clears warnings without fetching folder paths when a deferred remote combo verifies present', async () => {
      const remoteCandidate: MissingModelCandidate = {
        nodeType: 'RemoteFileNode',
        widgetName: 'file_name',
        name: 'selected.safetensors',
        isMissing: undefined,
        isAssetSupported: false
      }
      mockHandles.state.enrichedCandidates = [remoteCandidate]
      mockHandles.hasPendingVerification.mockImplementation(
        (candidate) => candidate === remoteCandidate
      )
      mockHandles.verifyAssetSupportedCandidates.mockImplementation(
        async () => {
          remoteCandidate.isMissing = false
        }
      )

      await runMissingModelPipeline({
        graph: createGraph(),
        graphData: createWorkflowGraphData(),
        missingModelStore: useMissingModelStore()
      })
      await vi.dynamicImportSettled()

      expect(mockHandles.api.getFolderPaths).not.toHaveBeenCalled()
      expect(
        useExecutionErrorStore().surfaceMissingModels
      ).toHaveBeenCalledWith([], { silent: false })
    })

    it('surfaces static and deferred remote candidates together after verification', async () => {
      const staticCandidate = {
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        name: 'missing.safetensors',
        isMissing: true,
        isAssetSupported: false
      } satisfies MissingModelCandidate
      const remoteCandidate: MissingModelCandidate = {
        nodeType: 'RemoteFileNode',
        widgetName: 'file_name',
        name: 'selected.safetensors',
        isMissing: undefined,
        isAssetSupported: false
      }
      mockHandles.state.enrichedCandidates = [staticCandidate, remoteCandidate]
      mockHandles.hasPendingVerification.mockImplementation(
        (candidate) => candidate === remoteCandidate
      )
      mockHandles.verifyAssetSupportedCandidates.mockImplementation(
        async () => {
          remoteCandidate.isMissing = true
        }
      )

      const result = await runMissingModelPipeline({
        graph: createGraph(),
        graphData: createWorkflowGraphData(),
        missingModelStore: useMissingModelStore()
      })
      await vi.dynamicImportSettled()

      expect(result.confirmedCandidates).toEqual([staticCandidate])
      expect(
        useExecutionErrorStore().surfaceMissingModels
      ).toHaveBeenCalledTimes(1)
      expect(
        useExecutionErrorStore().surfaceMissingModels
      ).toHaveBeenCalledWith([staticCandidate, remoteCandidate], {
        silent: false
      })
    })

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

    it('does not store gated repo URLs when verification is aborted during metadata retrieval', async () => {
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
      let finishMetadata = () => {}
      mockHandles.fetchModelMetadata.mockReturnValue(
        new Promise((resolve) => {
          finishMetadata = () =>
            resolve({
              fileSize: null,
              gatedRepoUrl: 'https://huggingface.co/bfl/FLUX.1'
            })
        })
      )

      await runMissingModelPipeline({
        graph: createGraph(),
        graphData: createWorkflowGraphData(),
        missingModelStore: useMissingModelStore()
      })
      await vi.dynamicImportSettled()

      expect(mockHandles.fetchModelMetadata).toHaveBeenCalledWith(
        'https://huggingface.co/bfl/FLUX.1/resolve/main/gated.safetensors'
      )
      controller.abort()
      finishMetadata()
      await vi.dynamicImportSettled()

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
      vi.mocked(graphTraversal.isCandidateScopeActive).mockImplementation(
        (_graph, candidate) => candidate.nodeId !== '2'
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

vi.mock(import('@/scripts/app'))
vi.mock(import('firebase/auth'))
