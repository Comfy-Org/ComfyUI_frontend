import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CurveData } from '@/components/curve/types'
import { t } from '@/i18n'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { createMockChangeTracker } from '@/utils/__tests__/litegraphTestUtils'
import { useNodeReplacementStore } from '@/platform/nodeReplacement/nodeReplacementStore'
import type { NodeReplacement } from '@/platform/nodeReplacement/types'
import { ComfyApp, app as singletonApp } from './app'
import { createNode } from '@/utils/litegraphUtil'
import {
  pasteAudioNode,
  pasteAudioNodes,
  pasteImageNode,
  pasteImageNodes,
  pasteVideoNode,
  pasteVideoNodes
} from '@/composables/usePaste'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import { getWorkflowDataFromFile } from '@/scripts/metadata/parser'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { installErrorClearingHooks } from '@/composables/graph/useErrorClearingHooks'
import { setTelemetryRegistry } from '@/platform/telemetry'
import { TelemetryRegistry } from '@/platform/telemetry/TelemetryRegistry'
import * as executionContextUtils from '@/platform/telemetry/utils/getExecutionContext'
import { isCloud } from '@/platform/distribution/types'

import { PromptExecutionError, api } from '@/scripts/api'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useDialogStore } from '@/stores/dialogStore'
import type { NodeError } from '@/schemas/apiSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { createNodeExecutionId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { extractFilesFromDragEvent } from '@/utils/eventUtils'
import type { importA1111 } from './pnginfo'

type WorkflowService = ReturnType<typeof useWorkflowService>

const {
  mockApiKeyAuthStore,
  mockAuthStore,
  mockSettingStore,
  mockToastStore,
  mockExtensionService,
  mockNodeOutputStore,
  mockSubgraphNavigationStore,
  mockTeamWorkspaceStore,
  mockWorkspaceWorkflow,
  mockRefreshMissingModelPipeline,
  mockImportA1111,
  mockWorkflowService
} = vi.hoisted(() => ({
  mockApiKeyAuthStore: {
    getApiKey: vi.fn(),
    isAuthenticated: false
  },
  mockAuthStore: {
    getWorkspaceAuthToken: vi.fn(),
    currentUser: null as { uid: string } | null
  },
  mockSettingStore: {
    get: vi.fn()
  },
  mockToastStore: {
    addAlert: vi.fn(),
    add: vi.fn(),
    remove: vi.fn()
  },
  mockExtensionService: {
    invokeExtensions: vi.fn(),
    invokeExtensionsAsync: vi.fn()
  },
  mockNodeOutputStore: {
    refreshNodeOutputs: vi.fn(),
    replaceOutputsFromLegacy: vi.fn(),
    setOutputFromLegacy: vi.fn(),
    removeOutputFromLegacy: vi.fn(),
    resetAllOutputsAndPreviews: vi.fn(),
    stashPreviewsForWorkflow: vi.fn(),
    restorePreviewsForWorkflow: vi.fn(),
    discardPreviewsForWorkflow: vi.fn()
  },
  mockSubgraphNavigationStore: {
    saveCurrentViewport: vi.fn(),
    updateHash: vi.fn()
  },
  mockTeamWorkspaceStore: {
    activeWorkspaceId: 'workspace-a' as string | null,
    workspaceTransitionGeneration: 0,
    waitForWorkspaceSwitch: vi.fn(() => Promise.resolve())
  },
  mockWorkspaceWorkflow: {
    activeWorkflow: null as ComfyWorkflow | null,
    createNewTemporary: vi.fn(),
    openWorkflow: vi.fn(),
    getWorkflowByPath: vi.fn(() => null)
  },
  mockRefreshMissingModelPipeline: vi.fn(),
  mockImportA1111: vi.fn<typeof importA1111>(),
  mockWorkflowService: {
    beforeLoadNewGraph: vi.fn<WorkflowService['beforeLoadNewGraph']>(),
    afterLoadNewGraph: vi.fn<WorkflowService['afterLoadNewGraph']>(),
    showPendingWarnings: vi.fn<WorkflowService['showPendingWarnings']>()
  }
}))

vi.mock('@/utils/litegraphUtil', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/litegraphUtil')>()),
  createNode: vi.fn(),
  isImageNode: vi.fn(),
  isVideoNode: vi.fn(),
  isAudioNode: vi.fn(),
  executeWidgetsCallback: vi.fn()
}))

vi.mock('@/stores/apiKeyAuthStore', () => ({
  useApiKeyAuthStore: vi.fn(() => mockApiKeyAuthStore)
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => mockAuthStore)
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: vi.fn(() => mockTeamWorkspaceStore)
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => mockSettingStore)
}))

vi.mock('@/composables/usePaste', () => ({
  pasteAudioNode: vi.fn(),
  pasteAudioNodes: vi.fn(),
  pasteImageNode: vi.fn(),
  pasteImageNodes: vi.fn(),
  pasteVideoNode: vi.fn(),
  pasteVideoNodes: vi.fn()
}))

vi.mock('@/scripts/metadata/parser', () => ({
  getWorkflowDataFromFile: vi.fn()
}))

vi.mock('@/utils/eventUtils', async (importOriginal) => {
  const eventUtils = await importOriginal<typeof import('@/utils/eventUtils')>()
  return {
    ...eventUtils,
    extractFilesFromDragEvent: vi.fn()
  }
})

vi.mock('./pnginfo', () => ({
  importA1111: mockImportA1111
}))

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: vi.fn(() => mockWorkflowService)
}))

vi.mock('@/extensions/core/load3d/Load3dUtils', () => ({
  default: {
    uploadFile: vi.fn()
  }
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: vi.fn(() => mockToastStore)
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: vi.fn(() => mockExtensionService)
}))

vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: vi.fn(() => mockNodeOutputStore)
}))

vi.mock('@/stores/subgraphNavigationStore', () => ({
  useSubgraphNavigationStore: vi.fn(() => mockSubgraphNavigationStore)
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: vi.fn(() => ({
    workflow: mockWorkspaceWorkflow
  }))
}))

vi.mock('@/platform/missingModel/missingModelPipeline', () => ({
  refreshMissingModelPipeline: mockRefreshMissingModelPipeline,
  runMissingModelPipeline: vi.fn()
}))

function createMockNode(options: { [K in keyof LGraphNode]?: any } = {}) {
  return {
    id: 1,
    pos: [0, 0],
    size: [200, 100],
    type: 'LoadImage',
    connect: vi.fn(),
    getBounding: vi.fn(() => new Float64Array([0, 0, 200, 100])),
    ...options
  } as LGraphNode
}

function createMockCanvas(): Partial<LGraphCanvas> {
  const mockGraph: Partial<LGraph> = {
    change: vi.fn()
  }

  return {
    graph: mockGraph as LGraph,
    draw: vi.fn(),
    selectItems: vi.fn(),
    setDirty: vi.fn(),
    setGraph: vi.fn()
  }
}

function createTestFile(name: string, type: string): File {
  return new File([''], name, { type })
}

/**
 * Point the workflowService mock at the real implementation for tests that
 * exercise the load lifecycle itself rather than app.ts's calls into it.
 */
const actualWorkflowService = await vi.importActual<
  typeof import('@/platform/workflow/core/services/workflowService')
>('@/platform/workflow/core/services/workflowService')

async function useRealWorkflowService(): Promise<WorkflowService> {
  const real = actualWorkflowService.useWorkflowService()
  mockWorkflowService.beforeLoadNewGraph.mockImplementation(
    real.beforeLoadNewGraph
  )
  mockWorkflowService.afterLoadNewGraph.mockImplementation(
    real.afterLoadNewGraph
  )
  mockWorkflowService.showPendingWarnings.mockImplementation(
    real.showPendingWarnings
  )
  return real
}

function markLoaded(workflow: ComfyWorkflow): LoadedComfyWorkflow {
  workflow.changeTracker = createMockChangeTracker()
  workflow.content = '{}'
  workflow.originalContent = '{}'
  return workflow as LoadedComfyWorkflow
}

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

describe('ComfyApp', () => {
  let app: ComfyApp
  let mockCanvas: LGraphCanvas

  beforeEach(() => {
    app = new ComfyApp()
    mockCanvas = createMockCanvas() as LGraphCanvas
    app.canvas = mockCanvas as LGraphCanvas
    mockWorkspaceWorkflow.activeWorkflow = null
    const temporaryWorkflow = new ComfyWorkflow({
      path: 'workflows/temporary.json',
      modified: 0,
      size: 0
    })
    mockWorkspaceWorkflow.createNewTemporary.mockReturnValue(temporaryWorkflow)
    mockWorkspaceWorkflow.openWorkflow.mockImplementation(async (workflow) => {
      mockWorkspaceWorkflow.activeWorkflow = workflow
      return workflow
    })
    mockApiKeyAuthStore.getApiKey.mockReturnValue(undefined)
    mockApiKeyAuthStore.isAuthenticated = false
    mockAuthStore.currentUser = null
    mockAuthStore.getWorkspaceAuthToken.mockResolvedValue('workspace-token')
    mockTeamWorkspaceStore.activeWorkspaceId = 'workspace-a'
    mockTeamWorkspaceStore.workspaceTransitionGeneration = 0
    mockTeamWorkspaceStore.waitForWorkspaceSwitch.mockResolvedValue()
    mockExtensionService.invokeExtensions.mockReturnValue([])
    mockExtensionService.invokeExtensionsAsync.mockResolvedValue(undefined)
    vi.mocked(extractFilesFromDragEvent).mockResolvedValue([])
    mockImportA1111.mockResolvedValue('imported')
    mockWorkflowService.afterLoadNewGraph.mockResolvedValue()
    mockSettingStore.get.mockImplementation((key: string) =>
      key === 'Comfy.RightSidePanel.ShowErrorsTab' ? true : undefined
    )
  })

  describe('loadGraphData', () => {
    it('forwards clean and navigation intent to workflow navigation', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())

      await app.loadGraphData(createWorkflowGraphData(), false, true, null, {
        workflowNavigationId: 42
      })

      expect(mockWorkflowService.beforeLoadNewGraph).toHaveBeenCalledWith(false)
      expect(mockSubgraphNavigationStore.updateHash).toHaveBeenCalledWith(
        'workflow-load',
        42
      )
    })

    it('suppresses the workflow reset for a default clean load', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())

      await app.loadGraphData(createWorkflowGraphData())

      expect(mockWorkflowService.beforeLoadNewGraph).toHaveBeenCalledWith(true)
      expect(mockSubgraphNavigationStore.updateHash).toHaveBeenCalledWith(
        'workflow-load',
        undefined
      )
    })

    it('reports the load outcome explicitly: true on success', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())

      await expect(app.loadGraphData(createWorkflowGraphData())).resolves.toBe(
        true
      )
    })

    it('resolves false, not rejects, when graph configure fails', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      vi.spyOn(graph, 'configure').mockImplementation(() => {
        throw new Error('bad workflow json')
      })
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')

      await expect(
        app.loadGraphData(createWorkflowGraphData(), false, true, null, {
          workflowNavigationId: 7
        })
      ).resolves.toBe(false)

      expect(showDialog).toHaveBeenCalledOnce()
      // The finally still repairs the URL even on the handled-failure path.
      expect(mockSubgraphNavigationStore.updateHash).toHaveBeenCalledWith(
        'workflow-load',
        7
      )
    })

    it('never suppresses the workflow reset for an API JSON import', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())

      await app.loadApiJson({}, 'empty.json').catch(() => undefined)

      expect(mockWorkflowService.beforeLoadNewGraph).toHaveBeenCalledWith(false)
      expect(
        mockExtensionService.invokeExtensionsAsync.mock.calls
          .map(([hook]) => hook)
          .filter((hook) =>
            ['beforeLoadGraph', 'afterLoadGraph'].includes(hook)
          )
      ).toEqual(['beforeLoadGraph'])
    })

    it('notifies extensions once on each side of a graph load, in order', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())

      await app.loadGraphData(createWorkflowGraphData(), false)

      const loadHookCalls =
        mockExtensionService.invokeExtensionsAsync.mock.calls
          .map(([hook]) => hook)
          .filter((hook) =>
            [
              'beforeLoadGraph',
              'beforeConfigureGraph',
              'afterConfigureGraph',
              'afterLoadGraph'
            ].includes(hook)
          )
      expect(loadHookCalls).toEqual([
        'beforeLoadGraph',
        'beforeConfigureGraph',
        'afterConfigureGraph',
        'afterLoadGraph'
      ])
    })

    it('skips both after-hooks when graph configure fails', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      vi.spyOn(graph, 'configure').mockImplementation(() => {
        throw new Error('bad workflow json')
      })

      await expect(
        app.loadGraphData(createWorkflowGraphData(), false)
      ).resolves.toBe(false)

      const invokedHooks =
        mockExtensionService.invokeExtensionsAsync.mock.calls.map(
          ([hook]) => hook
        )
      expect(invokedHooks).toContain('beforeLoadGraph')
      expect(invokedHooks).not.toContain('afterConfigureGraph')
      expect(invokedHooks).not.toContain('afterLoadGraph')
    })
  })

  describe('nodeOutputs', () => {
    it('commits legacy property mutations to the output store', () => {
      app.vueAppReady = true
      const output = { images: [{ filename: 'legacy.png' }] }

      app.nodeOutputs['1'] = output
      expect(mockNodeOutputStore.setOutputFromLegacy).toHaveBeenCalledWith(
        '1',
        output
      )
      expect(
        mockNodeOutputStore.replaceOutputsFromLegacy
      ).not.toHaveBeenCalled()

      delete app.nodeOutputs['1']
      expect(mockNodeOutputStore.removeOutputFromLegacy).toHaveBeenCalledWith(
        '1'
      )
      expect(
        mockNodeOutputStore.replaceOutputsFromLegacy
      ).not.toHaveBeenCalled()
    })

    it('commits nested legacy output mutations to the output store', () => {
      app.vueAppReady = true
      app.nodeOutputs['1'] = { images: [{ filename: 'first.png' }] }
      mockNodeOutputStore.setOutputFromLegacy.mockClear()

      const output = app.nodeOutputs['1']
      output.images = [{ filename: 'second.png' }]
      expect(mockNodeOutputStore.setOutputFromLegacy).toHaveBeenCalledWith(
        '1',
        { images: [{ filename: 'second.png' }] }
      )

      mockNodeOutputStore.setOutputFromLegacy.mockClear()
      const images = output.images
      images?.push({ filename: 'third.png' })
      expect(mockNodeOutputStore.setOutputFromLegacy).toHaveBeenCalledWith(
        '1',
        {
          images: [{ filename: 'second.png' }, { filename: 'third.png' }]
        }
      )
      expect(app.nodeOutputs['1']).toBe(output)
      expect(output.images).toBe(images)

      mockNodeOutputStore.setOutputFromLegacy.mockClear()
      const image = images?.[0]
      if (!image) throw new Error('Expected a legacy output image')
      image.filename = 'mutated.png'
      expect(mockNodeOutputStore.setOutputFromLegacy).toHaveBeenCalledWith(
        '1',
        {
          images: [{ filename: 'mutated.png' }, { filename: 'third.png' }]
        }
      )
      expect(images?.[0]).toBe(image)
    })

    it('commits shared output mutations to the accessed entry', () => {
      app.vueAppReady = true
      const shared = { images: [{ filename: 'first.png' }] }
      app.nodeOutputs['1'] = shared
      app.nodeOutputs['2'] = shared
      void app.nodeOutputs['1']
      const second = app.nodeOutputs['2']
      mockNodeOutputStore.setOutputFromLegacy.mockClear()

      second.images = [{ filename: 'second.png' }]

      expect(mockNodeOutputStore.setOutputFromLegacy).toHaveBeenCalledOnce()
      expect(mockNodeOutputStore.setOutputFromLegacy).toHaveBeenCalledWith(
        '2',
        shared
      )
    })

    it('commits only the changed entry after whole-record assignment', () => {
      app.vueAppReady = true
      app.nodeOutputs = { '1': { images: [{ filename: 'first.png' }] } }
      mockNodeOutputStore.setOutputFromLegacy.mockClear()

      const second = { images: [{ filename: 'second.png' }] }
      app.nodeOutputs['2'] = second

      expect(mockNodeOutputStore.setOutputFromLegacy).toHaveBeenCalledOnce()
      expect(mockNodeOutputStore.setOutputFromLegacy).toHaveBeenCalledWith(
        '2',
        second
      )
    })
  })

  describe('queuePrompt', () => {
    function prepareEmptyPromptQueue() {
      const workflow = new ComfyWorkflow({
        path: 'workflows/review.json',
        modified: 0,
        size: 0
      })
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      Reflect.set(singletonApp, 'rootGraphInternal', graph)
      mockWorkspaceWorkflow.activeWorkflow = workflow
      vi.spyOn(app, 'graphToPrompt').mockResolvedValue({
        output: {},
        workflow: createWorkflowGraphData()
      })
      vi.spyOn(api, 'dispatchCustomEvent').mockImplementation(() => true)
    }

    it('waits for workspace authentication before submitting the prompt', async () => {
      prepareEmptyPromptQueue()
      let resolveToken: (token: string) => void = () => {}
      mockAuthStore.getWorkspaceAuthToken.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveToken = resolve
        })
      )
      const queuePrompt = vi
        .spyOn(api, 'queuePrompt')
        .mockImplementation(() => {
          expect(api.authToken).toBe('workspace-token')
          return Promise.resolve({ prompt_id: 'job-1', error: '' })
        })

      const submission = app.queuePrompt(0)
      await vi.waitFor(() =>
        expect(mockAuthStore.getWorkspaceAuthToken).toHaveBeenCalledOnce()
      )
      expect(queuePrompt).not.toHaveBeenCalled()

      resolveToken('workspace-token')
      await expect(submission).resolves.toBe(true)
      expect(queuePrompt).toHaveBeenCalledOnce()
    })

    it('waits for a workspace switch before selecting the billing context', async () => {
      prepareEmptyPromptQueue()
      let finishSwitch: () => void = () => {}
      mockTeamWorkspaceStore.waitForWorkspaceSwitch.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishSwitch = () => {
              mockTeamWorkspaceStore.activeWorkspaceId = 'workspace-b'
              resolve()
            }
          })
      )
      mockAuthStore.getWorkspaceAuthToken.mockResolvedValueOnce(
        'workspace-token-b'
      )
      const queuePrompt = vi
        .spyOn(api, 'queuePrompt')
        .mockImplementation(() => {
          expect(api.authToken).toBe('workspace-token-b')
          return Promise.resolve({ prompt_id: 'job-1', error: '' })
        })

      const submission = app.queuePrompt(0)
      await vi.waitFor(() =>
        expect(
          mockTeamWorkspaceStore.waitForWorkspaceSwitch
        ).toHaveBeenCalledOnce()
      )

      expect(mockAuthStore.getWorkspaceAuthToken).not.toHaveBeenCalled()
      expect(app.graphToPrompt).not.toHaveBeenCalled()
      expect(queuePrompt).not.toHaveBeenCalled()

      finishSwitch()
      await expect(submission).resolves.toBe(true)

      expect(mockAuthStore.getWorkspaceAuthToken).toHaveBeenCalledOnce()
      expect(queuePrompt).toHaveBeenCalledOnce()
    })

    it('does not submit when an in-progress workspace switch fails', async () => {
      prepareEmptyPromptQueue()
      mockTeamWorkspaceStore.waitForWorkspaceSwitch.mockRejectedValueOnce(
        new Error('Token exchange failed')
      )
      const queuePrompt = vi.spyOn(api, 'queuePrompt')
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')

      await expect(app.queuePrompt(0)).resolves.toBe(false)

      expect(mockAuthStore.getWorkspaceAuthToken).not.toHaveBeenCalled()
      expect(app.graphToPrompt).not.toHaveBeenCalled()
      expect(queuePrompt).not.toHaveBeenCalled()
      expect(showDialog).toHaveBeenCalledOnce()
    })

    it.skipIf(isCloud)(
      'uses a workspace initialized while local authentication is pending',
      async () => {
        prepareEmptyPromptQueue()
        mockTeamWorkspaceStore.activeWorkspaceId = null
        mockAuthStore.getWorkspaceAuthToken.mockImplementationOnce(async () => {
          mockTeamWorkspaceStore.activeWorkspaceId = 'workspace-a'
          return 'workspace-token'
        })
        const queuePrompt = vi
          .spyOn(api, 'queuePrompt')
          .mockImplementation(() => {
            expect(api.authToken).toBe('workspace-token')
            return Promise.resolve({ prompt_id: 'job-1', error: '' })
          })

        await expect(app.queuePrompt(0)).resolves.toBe(true)

        expect(queuePrompt).toHaveBeenCalledOnce()
      }
    )

    it.skipIf(!isCloud)(
      'does not submit when a cloud workspace appears during authentication',
      async () => {
        prepareEmptyPromptQueue()
        mockTeamWorkspaceStore.activeWorkspaceId = null
        mockAuthStore.getWorkspaceAuthToken.mockImplementationOnce(async () => {
          mockTeamWorkspaceStore.activeWorkspaceId = 'workspace-a'
          return 'firebase-token'
        })
        const queuePrompt = vi.spyOn(api, 'queuePrompt')
        const showDialog = vi.spyOn(useDialogStore(), 'showDialog')

        await expect(app.queuePrompt(0)).resolves.toBe(false)

        expect(queuePrompt).not.toHaveBeenCalled()
        expect(showDialog).toHaveBeenCalledOnce()
      }
    )

    it('does not submit when the workspace changes during authentication', async () => {
      prepareEmptyPromptQueue()
      mockAuthStore.getWorkspaceAuthToken.mockImplementationOnce(async () => {
        mockTeamWorkspaceStore.activeWorkspaceId = 'workspace-b'
        return 'workspace-token-a'
      })
      const queuePrompt = vi.spyOn(api, 'queuePrompt')
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')

      await expect(app.queuePrompt(0)).resolves.toBe(false)

      expect(queuePrompt).not.toHaveBeenCalled()
      expect(showDialog).toHaveBeenCalledOnce()
    })

    it('does not submit a prompt after the active workspace changes', async () => {
      prepareEmptyPromptQueue()
      let finishPromptBuild: () => void = () => {}
      vi.spyOn(app, 'graphToPrompt').mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishPromptBuild = () =>
              resolve({
                output: {},
                workflow: createWorkflowGraphData()
              })
          })
      )
      const queuePrompt = vi.spyOn(api, 'queuePrompt')
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')

      const submission = app.queuePrompt(0)
      await vi.waitFor(() => expect(app.graphToPrompt).toHaveBeenCalledOnce())
      mockTeamWorkspaceStore.activeWorkspaceId = 'workspace-b'
      finishPromptBuild()

      await expect(submission).resolves.toBe(false)
      expect(queuePrompt).not.toHaveBeenCalled()
      expect(showDialog).toHaveBeenCalledOnce()
    })

    it('does not fall back to an API key when workspace authentication fails', async () => {
      prepareEmptyPromptQueue()
      mockAuthStore.getWorkspaceAuthToken.mockResolvedValueOnce(undefined)
      mockApiKeyAuthStore.getApiKey.mockReturnValueOnce('api-key')
      const queuePrompt = vi.spyOn(api, 'queuePrompt')
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')

      await expect(app.queuePrompt(0)).resolves.toBe(false)
      expect(queuePrompt).not.toHaveBeenCalled()
      expect(showDialog).toHaveBeenCalledOnce()
    })

    it('does not accept the API key when a Firebase session lost its workspace token', async () => {
      prepareEmptyPromptQueue()
      mockAuthStore.currentUser = { uid: 'firebase-user' }
      mockApiKeyAuthStore.isAuthenticated = true
      mockApiKeyAuthStore.getApiKey.mockReturnValue('api-key')
      mockAuthStore.getWorkspaceAuthToken.mockResolvedValueOnce(undefined)
      const queuePrompt = vi.spyOn(api, 'queuePrompt')
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')

      await expect(app.queuePrompt(0)).resolves.toBe(false)
      expect(queuePrompt).not.toHaveBeenCalled()
      expect(showDialog).toHaveBeenCalledOnce()
    })

    it('submits with the validated API key when the key session has a workspace', async () => {
      prepareEmptyPromptQueue()
      mockApiKeyAuthStore.isAuthenticated = true
      mockApiKeyAuthStore.getApiKey.mockReturnValue('comfyui-valid-key')
      mockAuthStore.getWorkspaceAuthToken.mockResolvedValueOnce(undefined)
      const queuePrompt = vi
        .spyOn(api, 'queuePrompt')
        .mockImplementation(() => {
          expect(api.apiKey).toBe('comfyui-valid-key')
          return Promise.resolve({ prompt_id: 'job-1', error: '' })
        })

      await expect(app.queuePrompt(0)).resolves.toBe(true)
      expect(queuePrompt).toHaveBeenCalledOnce()
    })

    it('does not submit after switching away and back to the same workspace', async () => {
      prepareEmptyPromptQueue()
      mockAuthStore.getWorkspaceAuthToken.mockResolvedValueOnce(
        'workspace-token'
      )
      let finishPromptBuild: () => void = () => {}
      vi.spyOn(app, 'graphToPrompt').mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishPromptBuild = () =>
              resolve({
                output: {},
                workflow: createWorkflowGraphData()
              })
          })
      )
      const queuePrompt = vi.spyOn(api, 'queuePrompt')
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')

      const submission = app.queuePrompt(0)
      await vi.waitFor(() => expect(app.graphToPrompt).toHaveBeenCalledOnce())
      mockTeamWorkspaceStore.activeWorkspaceId = 'workspace-b'
      mockTeamWorkspaceStore.workspaceTransitionGeneration++
      mockTeamWorkspaceStore.activeWorkspaceId = 'workspace-a'
      mockTeamWorkspaceStore.workspaceTransitionGeneration++
      finishPromptBuild()

      await expect(submission).resolves.toBe(false)
      expect(queuePrompt).not.toHaveBeenCalled()
      expect(showDialog).toHaveBeenCalledOnce()
    })

    it('preserves missing node packs when submitting a prompt', async () => {
      prepareEmptyPromptQueue()
      const missingNodesStore = useMissingNodesErrorStore()
      const executionErrorStore = useExecutionErrorStore()
      missingNodesStore.setMissingNodeTypes(['test/UninstalledLiveNode'])
      executionErrorStore.recordExecutionError({
        prompt_id: 'previous-run',
        timestamp: 0,
        node_id: '1',
        node_type: 'Test',
        executed: [],
        exception_message: 'fail',
        exception_type: 'RuntimeError',
        traceback: []
      })
      vi.spyOn(api, 'queuePrompt').mockResolvedValue({
        prompt_id: 'job-1',
        error: ''
      })

      await app.queuePrompt(0)

      expect(missingNodesStore.missingNodesError?.nodeTypes).toEqual([
        'test/UninstalledLiveNode'
      ])
      expect(executionErrorStore.lastExecutionError).toBeNull()
    })

    it('shows the error overlay for successful prompt responses with node errors', async () => {
      const graph = new LGraph()
      const workflow = new ComfyWorkflow({
        path: 'workflows/review.json',
        modified: 0,
        size: 0
      })
      const promptOutput: ComfyApiWorkflow = {
        '1': {
          class_type: 'PreviewAny',
          inputs: {},
          _meta: { title: 'PreviewAny' }
        }
      }
      const nodeErrors: Record<string, NodeError> = {
        '1': {
          class_type: 'PreviewAny',
          dependent_outputs: ['1'],
          errors: [
            {
              type: 'required_input_missing',
              message: 'Required input is missing: source',
              details: '',
              extra_info: { input_name: 'source' }
            }
          ]
        }
      }
      Reflect.set(app, 'rootGraphInternal', graph)
      Reflect.set(singletonApp, 'rootGraphInternal', graph)
      mockWorkspaceWorkflow.activeWorkflow = workflow
      vi.spyOn(app, 'graphToPrompt').mockResolvedValue({
        output: promptOutput,
        workflow: createWorkflowGraphData()
      })
      vi.spyOn(api, 'dispatchCustomEvent').mockImplementation(() => true)
      vi.spyOn(api, 'queuePrompt').mockResolvedValue({
        prompt_id: 'job-1',
        node_errors: nodeErrors,
        error: ''
      })

      await expect(app.queuePrompt(0)).resolves.toBe(false)

      const errorStore = useExecutionErrorStore()
      const executionStore = useExecutionStore()
      expect(errorStore.lastNodeErrors).toEqual(nodeErrors)
      expect(errorStore.isErrorOverlayOpen).toBe(true)
      expect(executionStore.queuedJobs['job-1']?.nodes).toEqual({ '1': false })
      expect(executionStore.jobIdToSessionWorkflowPath.get('job-1')).toBe(
        'workflows/review.json'
      )
      expect(mockCanvas.draw).toHaveBeenCalledWith(true, true)
    })

    it('stores workflow telemetry metadata for every accepted batch submission', async () => {
      prepareEmptyPromptQueue()
      const registry = new TelemetryRegistry()
      registry.registerProvider({ trackExecutionOutcome: vi.fn() })
      setTelemetryRegistry(registry)
      vi.spyOn(api, 'queuePrompt')
        .mockResolvedValueOnce({
          prompt_id: 'job-1',
          error: ''
        })
        .mockResolvedValueOnce({
          prompt_id: 'job-2',
          error: ''
        })

      try {
        await app.queuePrompt(0, 2, {
          intent: { trigger_source: 'button' }
        })

        expect(useExecutionStore().queuedJobs['job-1']).toMatchObject({
          workflowExecutionIntent: {
            trigger_source: 'button'
          },
          workflowContext: {
            workflow_type: 'custom',
            view_mode: 'graph',
            execution_scope: 'full',
            total_node_count: 0,
            executable_node_count: 0,
            custom_node_count: 0,
            api_node_count: 0,
            subgraph_count: 0
          }
        })
        expect(useExecutionStore().queuedJobs['job-2']).toMatchObject({
          workflowExecutionIntent: {
            trigger_source: 'button'
          }
        })
      } finally {
        setTelemetryRegistry(null)
      }
    })

    it('tracks a resolved prompt rejection at the submission stage', async () => {
      prepareEmptyPromptQueue()
      const trackExecutionOutcome = vi.fn()
      const registry = new TelemetryRegistry()
      registry.registerProvider({ trackExecutionOutcome })
      setTelemetryRegistry(registry)
      const now = vi.spyOn(performance, 'now').mockReturnValue(42)
      vi.spyOn(api, 'queuePrompt').mockImplementation(async () => {
        now.mockReturnValue(62)
        return {
          error: 'Prompt rejected'
        }
      })

      try {
        await app.queuePrompt(0)

        expect(trackExecutionOutcome).toHaveBeenCalledExactlyOnceWith({
          startTime: 42,
          endTime: 62,
          success: false,
          failureReason: 'submission_rejected',
          trigger_source: 'unknown',
          workflowContext: {
            workflow_type: 'custom',
            view_mode: 'graph',
            execution_scope: 'full',
            total_node_count: 0,
            executable_node_count: 0,
            custom_node_count: 0,
            api_node_count: 0,
            subgraph_count: 0
          }
        })
      } finally {
        now.mockRestore()
        setTelemetryRegistry(null)
      }
    })

    it('tracks a rejected queue request at the submission stage', async () => {
      prepareEmptyPromptQueue()
      const trackExecutionOutcome = vi.fn()
      const registry = new TelemetryRegistry()
      registry.registerProvider({ trackExecutionOutcome })
      setTelemetryRegistry(registry)
      const now = vi.spyOn(performance, 'now').mockReturnValue(42)
      vi.spyOn(api, 'queuePrompt').mockImplementation(async () => {
        now.mockReturnValue(62)
        throw new PromptExecutionError({
          error: {
            type: 'prompt_no_outputs',
            message: 'Prompt has no outputs',
            details: ''
          }
        })
      })

      try {
        await app.queuePrompt(0)

        expect(trackExecutionOutcome).toHaveBeenCalledExactlyOnceWith({
          startTime: 42,
          endTime: 62,
          success: false,
          failureReason: 'submission_rejected',
          trigger_source: 'unknown',
          workflowContext: {
            workflow_type: 'custom',
            view_mode: 'graph',
            execution_scope: 'full',
            total_node_count: 0,
            executable_node_count: 0,
            custom_node_count: 0,
            api_node_count: 0,
            subgraph_count: 0
          }
        })
      } finally {
        now.mockRestore()
        setTelemetryRegistry(null)
      }
    })

    it('tracks prompt construction failures at the submission stage', async () => {
      prepareEmptyPromptQueue()
      const trackExecutionOutcome = vi.fn()
      const registry = new TelemetryRegistry()
      registry.registerProvider({ trackExecutionOutcome })
      setTelemetryRegistry(registry)
      const now = vi.spyOn(performance, 'now').mockReturnValue(42)
      vi.spyOn(app, 'graphToPrompt').mockImplementation(async () => {
        now.mockReturnValue(62)
        throw new Error('Prompt construction failed')
      })

      try {
        await expect(app.queuePrompt(0)).rejects.toThrow(
          'Prompt construction failed'
        )
        expect(trackExecutionOutcome).toHaveBeenCalledExactlyOnceWith({
          startTime: 42,
          endTime: 62,
          success: false,
          failureReason: 'prompt_build_failed',
          trigger_source: 'unknown'
        })
      } finally {
        now.mockRestore()
        setTelemetryRegistry(null)
      }
    })

    it('stores execution intent when workflow context collection fails', async () => {
      prepareEmptyPromptQueue()
      const registry = new TelemetryRegistry()
      registry.registerProvider({ trackExecutionOutcome: vi.fn() })
      setTelemetryRegistry(registry)
      vi.spyOn(
        executionContextUtils,
        'getExecutionContext'
      ).mockImplementationOnce(() => {
        throw new Error('Context unavailable')
      })
      vi.spyOn(api, 'queuePrompt').mockResolvedValue({
        prompt_id: 'job-1',
        error: ''
      })

      try {
        await app.queuePrompt(0, 1, {
          intent: { trigger_source: 'button' }
        })

        expect(useExecutionStore().queuedJobs['job-1']).toMatchObject({
          workflowExecutionIntent: {
            trigger_source: 'button'
          }
        })
        expect(
          useExecutionStore().queuedJobs['job-1']?.workflowContext
        ).toBeUndefined()
      } finally {
        setTelemetryRegistry(null)
      }
    })

    it('normalizes runtime queue intent from extension callers', async () => {
      prepareEmptyPromptQueue()
      const registry = new TelemetryRegistry()
      registry.registerProvider({ trackExecutionOutcome: vi.fn() })
      setTelemetryRegistry(registry)
      vi.spyOn(api, 'queuePrompt').mockResolvedValue({
        prompt_id: 'job-1',
        error: ''
      })

      try {
        await Reflect.apply(app.queuePrompt, app, [
          0,
          1,
          {
            intent: {
              trigger_source: 'private-workflow-name'
            }
          }
        ])

        expect(
          useExecutionStore().queuedJobs['job-1']?.workflowExecutionIntent
        ).toEqual({
          trigger_source: 'unknown'
        })
      } finally {
        setTelemetryRegistry(null)
      }
    })

    it('preserves legacy partial execution calls from extensions', async () => {
      prepareEmptyPromptQueue()
      vi.spyOn(api, 'queuePrompt').mockResolvedValue({
        prompt_id: 'job-1',
        error: ''
      })
      const queueNodeIds = [createNodeExecutionId([1])]

      await app.queuePrompt(0, 1, queueNodeIds)

      expect(api.queuePrompt).toHaveBeenCalledWith(
        0,
        expect.anything(),
        expect.objectContaining({
          partialExecutionTargets: queueNodeIds
        })
      )
    })

    it('skips workflow context collection without telemetry', async () => {
      prepareEmptyPromptQueue()
      const getExecutionContext = vi.spyOn(
        executionContextUtils,
        'getExecutionContext'
      )
      vi.spyOn(api, 'queuePrompt').mockResolvedValue({
        prompt_id: 'job-1',
        error: ''
      })

      await app.queuePrompt(0)

      expect(getExecutionContext).not.toHaveBeenCalled()
    })

    it('retains workflow telemetry metadata when the queue UI refresh fails', async () => {
      prepareEmptyPromptQueue()
      const registry = new TelemetryRegistry()
      registry.registerProvider({ trackExecutionOutcome: vi.fn() })
      setTelemetryRegistry(registry)
      vi.spyOn(api, 'queuePrompt').mockResolvedValue({
        prompt_id: 'job-1',
        error: ''
      })
      vi.spyOn(app.ui.queue, 'update').mockRejectedValue(
        new Error('Queue UI refresh failed')
      )

      try {
        await expect(
          app.queuePrompt(0, 1, {
            intent: { trigger_source: 'button' }
          })
        ).rejects.toThrow('Queue UI refresh failed')
        expect(useExecutionStore().queuedJobs['job-1']).toMatchObject({
          workflowExecutionIntent: {
            trigger_source: 'button'
          }
        })
      } finally {
        setTelemetryRegistry(null)
      }
    })

    it('preserves a failed result when prompt errors include an empty node error record', async () => {
      prepareEmptyPromptQueue()
      vi.spyOn(api, 'queuePrompt').mockRejectedValue(
        new PromptExecutionError({
          node_errors: {},
          error: {
            type: 'prompt_no_outputs',
            message: 'Prompt has no outputs',
            details: ''
          }
        })
      )

      await expect(app.queuePrompt(0)).resolves.toBe(false)

      const errorStore = useExecutionErrorStore()
      expect(errorStore.lastNodeErrors).toBeNull()
      expect(errorStore.lastPromptError).toMatchObject({
        type: 'prompt_no_outputs'
      })
    })

    it('surfaces governance 403 node errors without an access dialog', async () => {
      prepareEmptyPromptQueue()
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')
      const nodeErrors: Record<string, NodeError> = {
        '1': {
          class_type: 'KlingImage2VideoNode',
          dependent_outputs: [],
          errors: [
            {
              type: 'PARTNER_NODE_DISABLED',
              message: 'This node has been disabled by your workspace policy.',
              details: '',
              extra_info: { provider: 'kling' }
            }
          ]
        }
      }
      vi.spyOn(api, 'queuePrompt').mockRejectedValue(
        new PromptExecutionError(
          {
            node_errors: nodeErrors,
            error: {
              type: 'PARTNER_NODE_DISABLED',
              message: 'Workspace policy denied one or more partner nodes',
              details: ''
            }
          },
          403
        )
      )

      await expect(app.queuePrompt(0)).resolves.toBe(false)

      expect(useExecutionErrorStore().lastNodeErrors).toEqual(nodeErrors)
      expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
      expect(showDialog).not.toHaveBeenCalled()
    })

    it('keeps the access dialog for unrelated 403 responses', async () => {
      prepareEmptyPromptQueue()
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')
      vi.spyOn(api, 'queuePrompt').mockRejectedValue(
        new PromptExecutionError(
          {
            error: {
              type: 'access_denied',
              message: 'This workspace cannot run prompts',
              details: ''
            }
          },
          403
        )
      )

      await expect(app.queuePrompt(0)).resolves.toBe(true)

      expect(showDialog).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'global-error' })
      )
      expect(useExecutionErrorStore().lastNodeErrors).toBeNull()
    })

    it('preserves a successful result when prompt errors omit node errors', async () => {
      prepareEmptyPromptQueue()
      vi.spyOn(api, 'queuePrompt').mockRejectedValue(
        new PromptExecutionError({
          error: {
            type: 'prompt_no_outputs',
            message: 'Prompt has no outputs',
            details: ''
          }
        })
      )

      await expect(app.queuePrompt(0)).resolves.toBe(true)
    })

    it('uses the last processed queue item result after an earlier failure', async () => {
      prepareEmptyPromptQueue()
      let rejectFirst!: (reason?: unknown) => void
      const firstResponse = new Promise<never>((_, reject) => {
        rejectFirst = reject
      })
      vi.spyOn(api, 'queuePrompt')
        .mockImplementationOnce(() => firstResponse)
        .mockResolvedValueOnce({
          prompt_id: 'job-2',
          error: ''
        })

      const firstQueue = app.queuePrompt(0)
      await vi.waitFor(() => {
        expect(api.queuePrompt).toHaveBeenCalledTimes(1)
      })
      await expect(app.queuePrompt(0)).resolves.toBe(false)

      rejectFirst(
        new PromptExecutionError({
          node_errors: {},
          error: {
            type: 'prompt_no_outputs',
            message: 'Prompt has no outputs',
            details: ''
          }
        })
      )

      await expect(firstQueue).resolves.toBe(true)
      expect(useExecutionErrorStore().lastNodeErrors).toBeNull()
    })
  })

  describe('workflow lifecycle', () => {
    it('clears missing node packs before loading API JSON without missing nodes', async () => {
      const graph = new LGraph()
      const activeSubgraph = createTestSubgraph({ rootGraph: graph })
      Reflect.set(app, 'rootGraphInternal', graph)
      Reflect.set(singletonApp, 'rootGraphInternal', graph)
      Reflect.set(mockCanvas, 'graph', activeSubgraph)
      Reflect.set(mockCanvas, 'subgraph', activeSubgraph)
      vi.mocked(mockCanvas.setGraph).mockImplementation((nextGraph) => {
        Reflect.set(mockCanvas, 'graph', nextGraph)
        Reflect.set(mockCanvas, 'subgraph', null)
      })
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes(['MissingGroupNode'])
      const nodeType = 'test/RegisteredApiNode'
      class RegisteredApiNode extends LGraphNode {}
      LiteGraph.registerNodeType(nodeType, RegisteredApiNode)

      try {
        await app.loadApiJson(
          {
            '1': {
              class_type: nodeType,
              inputs: {},
              _meta: { title: 'Registered API Node' }
            }
          },
          ''
        )

        expect(missingNodesStore.missingNodesError).toBeNull()
        expect(mockCanvas.setGraph).toHaveBeenCalledWith(graph)
        expect(mockCanvas.graph).toBe(graph)
        expect(mockCanvas.subgraph).toBeNull()
        expect(
          mockExtensionService.invokeExtensionsAsync.mock.calls
            .map(([hook]) => hook)
            .filter((hook) =>
              [
                'beforeLoadGraph',
                'beforeConfigureGraph',
                'afterConfigureGraph',
                'afterLoadGraph'
              ].includes(hook)
            )
        ).toEqual([
          'beforeLoadGraph',
          'beforeConfigureGraph',
          'afterConfigureGraph',
          'afterLoadGraph'
        ])
      } finally {
        LiteGraph.unregisterNodeType(nodeType)
      }
    })

    it('remaps flattened subgraph ids to colon-free local ids', async () => {
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      Reflect.set(singletonApp, 'rootGraphInternal', graph)
      const cleanupErrorHooks = installErrorClearingHooks(graph)
      const missingNodesStore = useMissingNodesErrorStore()
      const nodeReplacementStore = useNodeReplacementStore()
      vi.spyOn(nodeReplacementStore, 'load').mockResolvedValue()
      const sourceType = 'test/FlattenedSourceNode'
      const targetType = 'test/FlattenedTargetNode'
      class FlattenedSourceNode extends LGraphNode {
        constructor(title = 'FlattenedSourceNode') {
          super(title)
          this.addOutput('out', 'LATENT')
        }
      }
      class FlattenedTargetNode extends LGraphNode {
        constructor(title = 'FlattenedTargetNode') {
          super(title)
          this.addInput('samples', 'LATENT')
        }
      }
      LiteGraph.registerNodeType(sourceType, FlattenedSourceNode)
      LiteGraph.registerNodeType(targetType, FlattenedTargetNode)

      try {
        await app.loadApiJson(
          {
            '194:45': {
              class_type: sourceType,
              inputs: {},
              _meta: { title: 'Inner source' }
            },
            '7': {
              class_type: targetType,
              inputs: { samples: ['194:45', 0] },
              _meta: { title: 'Root target' }
            },
            '194:46': {
              class_type: 'UninstalledInnerNode',
              inputs: {},
              _meta: { title: 'Missing inner' }
            },
            '194_45': {
              class_type: targetType,
              inputs: { samples: ['194:45', 0] },
              _meta: { title: 'Occupies the remap target' }
            }
          },
          ''
        )

        expect(graph.nodes.every((n) => !String(n.id).includes(':'))).toBe(true)
        // "194_45" was already taken by a literal id, so the remap suffixes.
        expect(graph.getNodeById(toNodeId('194_45'))?.type).toBe(targetType)
        expect(graph.getNodeById(toNodeId('194_45_'))?.type).toBe(sourceType)
        expect(graph.links.size).toBe(2)
        expect(missingNodesStore.missingNodesError?.nodeTypes).toEqual([
          expect.objectContaining({
            type: 'UninstalledInnerNode',
            nodeId: '194_46'
          })
        ])
      } finally {
        cleanupErrorHooks()
        LiteGraph.unregisterNodeType(sourceType)
        LiteGraph.unregisterNodeType(targetType)
      }
    })

    it('unwraps exported widget values on API JSON import', async () => {
      const graph = new LGraph()
      const previousAppGraph = app.rootGraph
      const previousSingletonGraph = singletonApp.rootGraph
      const missingNodesStore = useMissingNodesErrorStore()
      const previousMissingNodeTypes =
        missingNodesStore.missingNodesError?.nodeTypes ?? []
      Reflect.set(app, 'rootGraphInternal', graph)
      Reflect.set(singletonApp, 'rootGraphInternal', graph)
      const widgetNodeType = 'test/ApiCurveNode'
      const curveCallback = vi.fn()
      class ApiCurveNode extends LGraphNode {
        constructor(title = 'ApiCurveNode') {
          super(title)
          this.addWidget(
            'curve',
            'curve',
            { points: [], interpolation: 'linear' },
            curveCallback
          )
          this.addWidget('text', 'points', '', null)
        }
      }
      LiteGraph.registerNodeType(widgetNodeType, ApiCurveNode)
      const curve: CurveData = {
        points: [
          [0, 0],
          [0.5, 1]
        ],
        interpolation: 'linear'
      }
      const points = [
        [0, 0],
        [0.5, 1]
      ]

      try {
        await app.loadApiJson(
          {
            '1': {
              class_type: widgetNodeType,
              inputs: {
                curve: { __type__: 'CURVE', __value__: curve },
                points: { __value__: points }
              },
              _meta: { title: 'Curve' }
            },
            '2': {
              class_type: 'Uninstalled/CurveNode',
              inputs: {
                curve: { __type__: 'CURVE', __value__: curve },
                points: { __value__: points }
              },
              _meta: { title: 'Missing Curve' }
            }
          },
          ''
        )

        const [widgetNode] = graph.nodes.filter(
          (n) => n.type === widgetNodeType
        )
        expect(widgetNode?.widgets?.[0].value).toEqual(curve)
        expect(widgetNode?.widgets?.[1].value).toEqual(points)
        expect(curveCallback).toHaveBeenCalledWith(curve)

        const [placeholder] = graph.nodes.filter(
          (n) => n.type === 'Uninstalled/CurveNode'
        )
        expect(placeholder?.last_serialization?.widgets_values).toEqual([
          curve,
          points
        ])
        expect(
          placeholder?.last_serialization?.widgets_values_named
        ).toMatchObject({ curve, points })

        const passthrough = { __value__: 'not-the-wrapper', other: 1 }
        await app.loadApiJson(
          {
            '1': {
              class_type: widgetNodeType,
              inputs: { points: passthrough },
              _meta: { title: 'Curve' }
            }
          },
          ''
        )
        const passthroughNode = graph.nodes
          .filter((n) => n.type === widgetNodeType)
          .at(-1)
        expect(passthroughNode?.widgets?.[1].value).toEqual(passthrough)
      } finally {
        missingNodesStore.setMissingNodeTypes(previousMissingNodeTypes)
        Reflect.set(app, 'rootGraphInternal', previousAppGraph)
        Reflect.set(singletonApp, 'rootGraphInternal', previousSingletonGraph)
        LiteGraph.unregisterNodeType(widgetNodeType)
      }
    })

    it('creates a removable placeholder for an API JSON missing node', async () => {
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      Reflect.set(singletonApp, 'rootGraphInternal', graph)
      const cleanupErrorHooks = installErrorClearingHooks(graph)
      const missingNodesStore = useMissingNodesErrorStore()
      const missingNodeType = 'Uninstalled<&Node>'
      const replacement: NodeReplacement = {
        new_node_id: 'ReplacementNode',
        old_node_id: missingNodeType,
        old_widget_ids: null,
        input_mapping: null,
        output_mapping: null
      }
      const nodeReplacementStore = useNodeReplacementStore()
      const loadReplacements = vi
        .spyOn(nodeReplacementStore, 'load')
        .mockResolvedValue()
      const getReplacement = vi
        .spyOn(nodeReplacementStore, 'getReplacementFor')
        .mockReturnValue(replacement)
      const apiData: unknown = {
        '-1': {
          class_type: missingNodeType,
          inputs: {}
        }
      }
      if (!app.isApiJson(apiData)) throw new Error('Expected valid API JSON')

      try {
        await app.loadApiJson(apiData, 'api-missing')

        const placeholder = graph.nodes[0]
        if (!placeholder) throw new Error('Expected missing-node placeholder')
        expect(placeholder).toMatchObject({
          type: 'UninstalledNode',
          title: missingNodeType,
          has_errors: true
        })
        expect(placeholder.id).not.toBe(toNodeId(-1))
        expect(placeholder.serialize()).toMatchObject({
          id: placeholder.id,
          type: missingNodeType,
          title: missingNodeType
        })
        expect(missingNodesStore.missingNodesError?.nodeTypes).toEqual([
          {
            type: missingNodeType,
            nodeId: String(placeholder.id),
            isReplaceable: true,
            replacement
          }
        ])
        expect(loadReplacements).toHaveBeenCalledOnce()
        expect(getReplacement).toHaveBeenCalled()
        expect(loadReplacements.mock.invocationCallOrder[0]).toBeLessThan(
          getReplacement.mock.invocationCallOrder[0]
        )

        graph.remove(placeholder)
        expect(missingNodesStore.missingNodesError).toBeNull()
      } finally {
        cleanupErrorHooks()
      }
    })

    it('preserves API JSON inputs on a missing node across reload', async () => {
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      Reflect.set(singletonApp, 'rootGraphInternal', graph)
      const sourceNodeType = 'test/ApiJsonSourceNode'
      const missingNodeType = 'UninstalledInputNode'
      class ApiJsonSourceNode extends LGraphNode {
        constructor() {
          super('API JSON source')
          this.addOutput('images', 'IMAGE')
        }
      }
      class InstalledInputNode extends LGraphNode {
        constructor() {
          super('Installed input node')
          this.addInput('images', 'IMAGE')
          this.addWidget('number', 'width', 0, null, {})
          this.addWidget('text', 'caption', '', null, {})
        }
      }
      LiteGraph.registerNodeType(sourceNodeType, ApiJsonSourceNode)
      let installedTypeRegistered = false
      const nodeReplacementStore = useNodeReplacementStore()
      vi.spyOn(nodeReplacementStore, 'load').mockResolvedValue()
      vi.spyOn(nodeReplacementStore, 'getReplacementFor').mockReturnValue(null)

      try {
        await app.loadApiJson(
          {
            '3': {
              class_type: missingNodeType,
              inputs: {
                images: ['4', 0],
                width: 512,
                caption: 'preserved caption'
              },
              _meta: { title: 'Missing input node' }
            },
            '4': {
              class_type: sourceNodeType,
              inputs: {},
              _meta: { title: 'API JSON source' }
            }
          },
          'api-inputs'
        )

        const placeholder = graph.getNodeById(toNodeId(3))
        if (!placeholder) throw new Error('Expected missing-node placeholder')
        const imageInput = placeholder.inputs.find(
          (input) => input.name === 'images'
        )
        expect(imageInput).toMatchObject({ name: 'images', type: '*' })
        expect(imageInput?.link).not.toBeNull()
        if (imageInput?.link == null) throw new Error('Expected input link')
        expect(graph.links.get(imageInput.link)).toMatchObject({
          origin_id: toNodeId(4),
          target_id: toNodeId(3)
        })

        const serializedGraph = graph.serialize()
        const serializedPlaceholder = serializedGraph.nodes.find(
          (node) => node.id === placeholder.id
        )
        expect(serializedPlaceholder).toMatchObject({
          widgets_values: [512, 'preserved caption'],
          widgets_values_named: {
            width: 512,
            caption: 'preserved caption'
          }
        })

        const roundTripGraph = new LGraph()
        roundTripGraph.configure({
          ...serializedGraph,
          id: roundTripGraph.id
        })
        const roundTripPlaceholder = roundTripGraph.getNodeById(toNodeId(3))
        expect(roundTripPlaceholder?.inputs[0]).toMatchObject({
          name: 'images',
          type: '*',
          link: imageInput.link
        })
        expect(roundTripPlaceholder?.serialize()).toMatchObject({
          widgets_values: [512, 'preserved caption'],
          widgets_values_named: {
            width: 512,
            caption: 'preserved caption'
          }
        })

        LiteGraph.registerNodeType(missingNodeType, InstalledInputNode)
        installedTypeRegistered = true
        const installedGraph = new LGraph()
        installedGraph.configure({
          ...serializedGraph,
          id: installedGraph.id
        })
        expect(
          installedGraph
            .getNodeById(toNodeId(3))
            ?.widgets?.map((widget) => widget.value)
        ).toEqual([512, 'preserved caption'])
      } finally {
        LiteGraph.unregisterNodeType(sourceNodeType)
        if (installedTypeRegistered) {
          LiteGraph.unregisterNodeType(missingNodeType)
        }
      }
    })

    it('defers API JSON missing node warnings until they are flushed', async () => {
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      Reflect.set(singletonApp, 'rootGraphInternal', graph)
      const nodeReplacementStore = useNodeReplacementStore()
      vi.spyOn(nodeReplacementStore, 'load').mockResolvedValue()
      vi.spyOn(nodeReplacementStore, 'getReplacementFor').mockReturnValue(null)
      const missingNodesStore = useMissingNodesErrorStore()
      const workflowService = await useRealWorkflowService()
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
        prompt: {
          '1': {
            class_type: 'UninstalledDeferredNode',
            inputs: {},
            _meta: { title: 'Deferred missing node' }
          }
        }
      })

      await app.handleFile(
        createTestFile('deferred.json', 'application/json'),
        'file_drop',
        { deferWarnings: true }
      )

      const deferredWorkflow = mockWorkspaceWorkflow.activeWorkflow
      expect(missingNodesStore.missingNodesError).toBeNull()
      expect(deferredWorkflow?.pendingWarnings?.missingNodeTypes).toEqual([
        expect.objectContaining({ type: 'UninstalledDeferredNode' })
      ])

      workflowService.showPendingWarnings(deferredWorkflow)

      expect(missingNodesStore.missingNodesError?.nodeTypes).toEqual([
        expect.objectContaining({ type: 'UninstalledDeferredNode' })
      ])
    })
  })
  describe('A1111 import', () => {
    it('clears missing node packs, which its graph swap skips clean() for', async () => {
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes(['OutgoingMissingNode'])
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
        parameters: 'positive\nNegative prompt: negative\nSteps: 20'
      })
      mockImportA1111.mockImplementation(
        async (_graph, _parameters, beforeGraphClear) => {
          await beforeGraphClear?.()
          return 'imported'
        }
      )

      await app.handleFile(createTestFile('a1111.png', 'image/png'))

      expect(missingNodesStore.missingNodesError).toBeNull()
    })

    it.for(['not-a1111', 'core-nodes-unavailable'] as const)(
      'keeps missing node packs when the import fails with %s',
      async (outcome) => {
        const graph = new LGraph()
        Reflect.set(app, 'rootGraphInternal', graph)
        const missingNodesStore = useMissingNodesErrorStore()
        missingNodesStore.setMissingNodeTypes(['OutgoingMissingNode'])
        vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
          parameters: 'positive\nNegative prompt: negative\nSteps: 20'
        })
        mockImportA1111.mockResolvedValue(outcome)

        await app.handleFile(createTestFile('a1111.png', 'image/png'))

        expect(missingNodesStore.missingNodesError?.nodeTypes).toEqual([
          'OutgoingMissingNode'
        ])
      }
    )
  })

  describe('clean', () => {
    it('clears missing node packs when the graph is discarded', () => {
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      const missingNodesStore = useMissingNodesErrorStore()
      const executionErrorStore = useExecutionErrorStore()
      missingNodesStore.setMissingNodeTypes(['MissingGroupNode'])
      executionErrorStore.recordExecutionError({
        prompt_id: 'previous-run',
        timestamp: 0,
        node_id: '1',
        node_type: 'Test',
        executed: [],
        exception_message: 'fail',
        exception_type: 'RuntimeError',
        traceback: []
      })

      app.clean()

      expect(missingNodesStore.missingNodesError).toBeNull()
      expect(executionErrorStore.lastExecutionError).toBeNull()
    })
  })

  describe('refreshComboInNodes', () => {
    it('shows success toast and removes the pending toast after node defs reload', async () => {
      app.vueAppReady = true
      vi.spyOn(app, 'reloadNodeDefs').mockResolvedValue()

      await app.refreshComboInNodes()

      expect(mockToastStore.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'info' })
      )
      expect(mockToastStore.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success' })
      )
      expect(mockToastStore.remove).toHaveBeenCalledWith(
        mockToastStore.add.mock.calls[0][0]
      )
    })

    it('shows failure toast, removes the pending toast, and rethrows reload failures', async () => {
      app.vueAppReady = true
      const error = new Error('object_info failed')
      vi.spyOn(app, 'reloadNodeDefs').mockRejectedValue(error)

      await expect(app.refreshComboInNodes()).rejects.toThrow(error)

      expect(mockToastStore.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
      expect(mockToastStore.remove).toHaveBeenCalledWith(
        mockToastStore.add.mock.calls[0][0]
      )
    })
  })

  describe('reloadNodeDefs', () => {
    it('syncs refreshed combo options into promoted combo host state', async () => {
      const initialOptions = ['missing.safetensors']
      const refreshedOptions = ['missing.safetensors', 'present.safetensors']

      const rootGraph = createTestRootGraph()
      const subgraph = createTestSubgraph({
        rootGraph,
        inputs: [{ name: 'ckpt_name', type: '*' }]
      })

      const interiorNode = new LGraphNode(
        'CheckpointLoaderSimple',
        'CheckpointLoaderSimple'
      )
      const interiorInput = interiorNode.addInput('ckpt_name', '*')
      interiorInput.widget = { name: 'ckpt_name' }
      const interiorWidget = interiorNode.addWidget(
        'combo',
        'ckpt_name',
        'missing.safetensors',
        () => {},
        { values: initialOptions }
      )
      subgraph.add(interiorNode)
      subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

      const host = createTestSubgraphNode(subgraph)
      rootGraph.add(host)

      const hostWidgetId = host.inputs[0].widgetId
      if (!hostWidgetId) throw new Error('Expected a promoted host widgetId')

      const widgetValueStore = useWidgetValueStore()
      expect(widgetValueStore.getWidget(hostWidgetId)?.options).toEqual({
        values: initialOptions
      })

      const defs: Record<string, ComfyNodeDef> = {
        CheckpointLoaderSimple: {
          name: 'CheckpointLoaderSimple',
          display_name: 'CheckpointLoaderSimple',
          category: 'loaders',
          python_module: 'nodes',
          description: '',
          input: {
            required: {
              ckpt_name: [refreshedOptions, {}]
            },
            optional: {}
          },
          output: [],
          output_name: [],
          output_tooltips: [],
          output_node: false,
          deprecated: false,
          experimental: false
        }
      }
      Reflect.set(app, 'rootGraphInternal', rootGraph)
      vi.spyOn(app, 'getNodeDefs').mockResolvedValue(defs)
      vi.spyOn(app, 'registerNodeDef').mockResolvedValue(undefined)

      await app.reloadNodeDefs()

      expect(interiorWidget.options.values).toEqual(refreshedOptions)
      expect(widgetValueStore.getWidget(hostWidgetId)?.options.values).toEqual(
        refreshedOptions
      )
      expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
        'refreshComboInNodes',
        defs
      )
    })
  })

  describe('refreshMissingModels', () => {
    it('delegates to the app-independent missing model refresh pipeline', async () => {
      const graph = {
        nodes: [],
        serialize: vi.fn(() => createWorkflowGraphData())
      }
      const result = {
        missingModels: [],
        confirmedCandidates: []
      }
      Reflect.set(app, 'rootGraphInternal', graph)
      vi.spyOn(app, 'reloadNodeDefs').mockResolvedValue()
      mockRefreshMissingModelPipeline.mockResolvedValue(result)

      await expect(app.refreshMissingModels({ silent: false })).resolves.toBe(
        result
      )

      expect(mockRefreshMissingModelPipeline).toHaveBeenCalledWith({
        graph,
        reloadNodeDefs: expect.any(Function),
        missingModelStore: useMissingModelStore(),
        silent: false
      })

      await mockRefreshMissingModelPipeline.mock.calls[0][0].reloadNodeDefs()
      expect(app.reloadNodeDefs).toHaveBeenCalled()
    })

    it('omits the node definition reload when reloadDefs is false', async () => {
      const graph = {
        nodes: [],
        serialize: vi.fn(() => createWorkflowGraphData())
      }
      Reflect.set(app, 'rootGraphInternal', graph)
      vi.spyOn(app, 'reloadNodeDefs').mockResolvedValue()
      mockRefreshMissingModelPipeline.mockResolvedValue({
        missingModels: [],
        confirmedCandidates: []
      })

      await app.refreshMissingModels({ reloadDefs: false })

      expect(mockRefreshMissingModelPipeline).toHaveBeenCalledWith({
        graph,
        reloadNodeDefs: undefined,
        missingModelStore: useMissingModelStore(),
        silent: true
      })
      expect(app.reloadNodeDefs).not.toHaveBeenCalled()
    })
  })

  describe('handleFileList', () => {
    it('should create image nodes for each file in the list', async () => {
      const mockNode1 = createMockNode({ id: 1 })
      const mockNode2 = createMockNode({ id: 2 })
      const mockBatchNode = createMockNode({ id: 3, type: 'BatchImagesNode' })

      vi.mocked(pasteImageNodes).mockResolvedValue([mockNode1, mockNode2])
      vi.mocked(createNode).mockResolvedValue(mockBatchNode)

      const file1 = createTestFile('test1.png', 'image/png')
      const file2 = createTestFile('test2.jpg', 'image/jpeg')
      const files = [file1, file2]

      await app.handleFileList(files)

      expect(pasteImageNodes).toHaveBeenCalledWith(mockCanvas, files)
      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'BatchImagesNode')
      expect(mockCanvas.selectItems).toHaveBeenCalledWith([
        mockNode1,
        mockNode2,
        mockBatchNode
      ])
      expect(mockNode1.connect).toHaveBeenCalledWith(0, mockBatchNode, 0)
      expect(mockNode2.connect).toHaveBeenCalledWith(0, mockBatchNode, 1)
    })

    it('should select single image node without batch node', async () => {
      const mockNode1 = createMockNode({ id: 1 })
      vi.mocked(pasteImageNodes).mockResolvedValue([mockNode1])

      const file = createTestFile('test.png', 'image/png')

      await app.handleFileList([file])

      expect(createNode).not.toHaveBeenCalled()
      expect(mockCanvas.selectItems).toHaveBeenCalledWith([mockNode1])
      expect(mockNode1.connect).not.toHaveBeenCalled()
    })

    it('should handle empty file list', async () => {
      await app.handleFileList([])

      expect(pasteImageNodes).not.toHaveBeenCalled()
      expect(createNode).not.toHaveBeenCalled()
    })

    it('should not process unsupported file types', async () => {
      const invalidFile = createTestFile('test.pdf', 'application/pdf')

      await app.handleFileList([invalidFile])

      expect(pasteImageNodes).not.toHaveBeenCalled()
      expect(createNode).not.toHaveBeenCalled()
    })
  })

  describe('handleAudioFileList', () => {
    it('should create audio nodes and select them', async () => {
      const mockNode1 = createMockNode({ id: 1, type: 'LoadAudio' })
      const mockNode2 = createMockNode({ id: 2, type: 'LoadAudio' })
      vi.mocked(pasteAudioNodes).mockResolvedValue([mockNode1, mockNode2])

      const file1 = createTestFile('test1.mp3', 'audio/mpeg')
      const file2 = createTestFile('test2.wav', 'audio/wav')

      await app.handleAudioFileList([file1, file2])

      expect(pasteAudioNodes).toHaveBeenCalledWith(mockCanvas, [file1, file2])
      expect(mockCanvas.selectItems).toHaveBeenCalledWith([
        mockNode1,
        mockNode2
      ])
    })

    it('should not select when no nodes created', async () => {
      vi.mocked(pasteAudioNodes).mockResolvedValue([])

      await app.handleAudioFileList([createTestFile('test.mp3', 'audio/mpeg')])

      expect(mockCanvas.selectItems).not.toHaveBeenCalled()
    })
  })

  describe('handleVideoFileList', () => {
    it('should create video nodes and select them', async () => {
      const mockNode1 = createMockNode({ id: 1, type: 'LoadVideo' })
      const mockNode2 = createMockNode({ id: 2, type: 'LoadVideo' })
      vi.mocked(pasteVideoNodes).mockResolvedValue([mockNode1, mockNode2])

      const file1 = createTestFile('test1.mp4', 'video/mp4')
      const file2 = createTestFile('test2.webm', 'video/webm')

      await app.handleVideoFileList([file1, file2])

      expect(pasteVideoNodes).toHaveBeenCalledWith(mockCanvas, [file1, file2])
      expect(mockCanvas.selectItems).toHaveBeenCalledWith([
        mockNode1,
        mockNode2
      ])
    })

    it('should not select when no nodes created', async () => {
      vi.mocked(pasteVideoNodes).mockResolvedValue([])

      await app.handleVideoFileList([createTestFile('test.mp4', 'video/mp4')])

      expect(mockCanvas.selectItems).not.toHaveBeenCalled()
    })
  })

  describe('positionBatchNodes', () => {
    it('should position batch node to the right of first node', () => {
      const mockNode1 = createMockNode({
        pos: [100, 200],
        getBounding: vi.fn(() => new Float64Array([100, 200, 300, 400]))
      })
      const mockBatchNode = createMockNode({ pos: [0, 0] })

      app.positionBatchNodes([mockNode1], mockBatchNode)

      expect(mockBatchNode.pos).toEqual([500, 230])
    })

    it('should stack multiple image nodes vertically', () => {
      const mockNode1 = createMockNode({
        pos: [100, 200],
        type: 'LoadImage',
        getBounding: vi.fn(() => new Float64Array([100, 200, 300, 400]))
      })
      const mockNode2 = createMockNode({ pos: [0, 0], type: 'LoadImage' })
      const mockNode3 = createMockNode({ pos: [0, 0], type: 'LoadImage' })
      const mockBatchNode = createMockNode({ pos: [0, 0] })

      app.positionBatchNodes([mockNode1, mockNode2, mockNode3], mockBatchNode)

      expect(mockNode1.pos).toEqual([100, 200])
      expect(mockNode2.pos).toEqual([100, 594])
      expect(mockNode3.pos).toEqual([100, 963])
    })

    it('should call graph change once for all nodes', () => {
      const mockNode1 = createMockNode({
        getBounding: vi.fn(() => new Float64Array([100, 200, 300, 400]))
      })
      const mockBatchNode = createMockNode()

      app.positionBatchNodes([mockNode1], mockBatchNode)

      expect(mockCanvas.graph?.change).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleFile', () => {
    it('does not paste legacy templates while the canvas is picking-only', () => {
      const pasteFromClipboard = vi.fn()
      app.canvas = {
        ...mockCanvas,
        selectOnly: true,
        pasteFromClipboard
      } as unknown as LGraphCanvas

      app.loadTemplateData({
        templates: [{ data: JSON.stringify({ reroutes: [] }) }]
      })

      expect(pasteFromClipboard).not.toHaveBeenCalled()
    })

    it('should handle image files by creating LoadImage node', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({})

      const mockNode = createMockNode()
      vi.mocked(createNode).mockResolvedValue(mockNode)

      const imageFile = createTestFile('test.png', 'image/png')

      await app.handleFile(imageFile)

      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'LoadImage')
      expect(pasteImageNode).toHaveBeenCalledWith(
        mockCanvas,
        expect.any(DataTransferItemList),
        mockNode
      )
    })

    it('should handle audio files by creating LoadAudio node', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({})

      const mockNode = createMockNode({ type: 'LoadAudio' })
      vi.mocked(createNode).mockResolvedValue(mockNode)

      const audioFile = createTestFile('test.mp3', 'audio/mpeg')

      await app.handleFile(audioFile)

      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'LoadAudio')
      expect(pasteAudioNode).toHaveBeenCalledWith(
        mockCanvas,
        expect.any(DataTransferItemList),
        mockNode
      )
    })

    it('should handle video files by creating LoadVideo node', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({})

      const mockNode = createMockNode({ type: 'LoadVideo' })
      vi.mocked(createNode).mockResolvedValue(mockNode)

      const videoFile = createTestFile('test.mp4', 'video/mp4')

      await app.handleFile(videoFile)

      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'LoadVideo')
      expect(pasteVideoNode).toHaveBeenCalledWith(
        mockCanvas,
        expect.any(DataTransferItemList),
        mockNode
      )
    })

    it('should handle mesh model files by uploading and creating Load3DAdvanced node', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue(undefined)
      vi.mocked(Load3dUtils.uploadFile).mockResolvedValue('3d/model.glb')

      const modelWidget = {
        name: 'model_file',
        value: 'existing.glb',
        options: { values: ['existing.glb'] }
      }
      const mockNode = createMockNode({
        type: 'Load3DAdvanced',
        widgets: [modelWidget]
      })
      vi.mocked(createNode).mockResolvedValue(mockNode)

      const meshFile = createTestFile('model.glb', '')

      await app.handleFile(meshFile)

      expect(Load3dUtils.uploadFile).toHaveBeenCalledWith(meshFile, '3d')
      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'Load3DAdvanced')
      expect(modelWidget.value).toBe('3d/model.glb')
      expect(modelWidget.options.values).toContain('3d/model.glb')
    })

    it('should load embedded workflow from mesh files instead of creating Load3DAdvanced node', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
        workflow: createWorkflowGraphData()
      })
      const loadGraphData = vi
        .spyOn(app, 'loadGraphData')
        .mockResolvedValue(true)

      const meshFile = createTestFile('model.glb', 'model/gltf-binary')

      await app.handleFile(meshFile)

      expect(loadGraphData).toHaveBeenCalled()
      expect(Load3dUtils.uploadFile).not.toHaveBeenCalled()
      expect(createNode).not.toHaveBeenCalled()
    })

    it('should not create Load3DAdvanced node when mesh upload fails', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue(undefined)
      vi.mocked(Load3dUtils.uploadFile).mockResolvedValue(undefined)

      const meshFile = createTestFile('model.obj', '')

      await app.handleFile(meshFile)

      expect(Load3dUtils.uploadFile).toHaveBeenCalledWith(meshFile, '3d')
      expect(createNode).not.toHaveBeenCalled()
    })

    it('should report each created Load3DAdvanced node via onNodeCreated', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue(undefined)
      vi.mocked(Load3dUtils.uploadFile)
        .mockResolvedValueOnce('3d/a.glb')
        .mockResolvedValueOnce('3d/b.glb')

      const modelWidgetA = { name: 'model_file', value: '', options: {} }
      const modelWidgetB = { name: 'model_file', value: '', options: {} }
      const nodeA = createMockNode({
        id: 1,
        type: 'Load3DAdvanced',
        widgets: [modelWidgetA]
      })
      const nodeB = createMockNode({
        id: 2,
        type: 'Load3DAdvanced',
        widgets: [modelWidgetB]
      })
      vi.mocked(createNode)
        .mockResolvedValueOnce(nodeA)
        .mockResolvedValueOnce(nodeB)

      const onNodeCreated = vi.fn()
      await app.handleFile(createTestFile('a.glb', ''), 'file_drop', {
        onNodeCreated
      })
      await app.handleFile(createTestFile('b.glb', ''), 'file_drop', {
        onNodeCreated
      })

      expect(onNodeCreated).toHaveBeenNthCalledWith(1, nodeA)
      expect(onNodeCreated).toHaveBeenNthCalledWith(2, nodeB)
    })

    it('should not report a node via onNodeCreated when mesh upload fails', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue(undefined)
      vi.mocked(Load3dUtils.uploadFile).mockResolvedValue(undefined)

      const onNodeCreated = vi.fn()
      await app.handleFile(createTestFile('a.glb', ''), 'file_drop', {
        onNodeCreated
      })

      expect(onNodeCreated).not.toHaveBeenCalled()
    })

    it('positionNodes spreads stacked nodes so multi-mesh drops do not overlap', () => {
      const nodes = [
        createMockNode({
          id: 1,
          pos: [100, 200],
          getBounding: vi.fn(() => new Float64Array([100, 200, 200, 100]))
        }),
        createMockNode({ id: 2, pos: [100, 200] }),
        createMockNode({ id: 3, pos: [100, 200] })
      ]

      app.positionNodes(nodes)

      expect(nodes[0].pos).toEqual([100, 200])
      expect(nodes[1].pos).toEqual([100, 400])
      expect(nodes[2].pos).toEqual([100, 575])
    })

    it('should handle image files with non-workflow metadata by creating LoadImage node', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
        Software: 'gnome-screenshot'
      })

      const mockNode = createMockNode()
      vi.mocked(createNode).mockResolvedValue(mockNode)

      const imageFile = createTestFile('screenshot.png', 'image/png')

      await app.handleFile(imageFile)

      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'LoadImage')
      expect(pasteImageNode).toHaveBeenCalledWith(
        mockCanvas,
        expect.any(DataTransferItemList),
        mockNode
      )
    })

    it.each([
      ['an invalid structure', '[]'],
      ['invalid JSON', '{invalid']
    ])('shows one error for %s', async (_case, workflow) => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({ workflow })

      await app.handleFile(createTestFile('broken.json', 'application/json'))

      expect(mockToastStore.addAlert).toHaveBeenCalledTimes(1)
      expect(mockToastStore.addAlert).toHaveBeenCalledWith(
        'Unable to find workflow in broken.json'
      )
      consoleError.mockRestore()
    })

    it.for([
      {
        outcome: 'core-nodes-unavailable' as const,
        fileName: 'a1111.png',
        toastMethod: 'addAlert' as const,
        expectedToast: t('toastMessages.a1111CoreNodesUnavailable')
      },
      {
        outcome: 'not-a1111' as const,
        fileName: 'parameters.png',
        toastMethod: 'addAlert' as const,
        expectedToast: t('toastMessages.fileLoadError', {
          fileName: 'parameters.png'
        })
      },
      {
        outcome: 'imported-without-embeddings' as const,
        fileName: 'a1111.png',
        toastMethod: 'add' as const,
        expectedToast: {
          severity: 'warn',
          summary: t('g.warning'),
          detail: t('toastMessages.a1111EmbeddingsUnavailable')
        }
      }
    ])('maps $outcome to its message', async (testCase) => {
      const graph = new LGraph()
      const parameters = 'positive\nNegative prompt: negative\nSteps: 20'
      Reflect.set(app, 'rootGraphInternal', graph)
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({ parameters })
      mockImportA1111.mockResolvedValue(testCase.outcome)

      await app.handleFile(createTestFile(testCase.fileName, 'image/png'))

      expect(mockImportA1111).toHaveBeenCalledWith(
        graph,
        parameters,
        expect.any(Function)
      )
      expect(mockToastStore[testCase.toastMethod]).toHaveBeenCalledOnce()
      expect(mockToastStore[testCase.toastMethod]).toHaveBeenCalledWith(
        testCase.expectedToast
      )
      if (testCase.outcome === 'imported-without-embeddings') {
        expect(mockWorkflowService.afterLoadNewGraph).toHaveBeenCalledOnce()
      } else {
        expect(mockWorkflowService.afterLoadNewGraph).not.toHaveBeenCalled()
      }
    })

    it('awaits persistence and orders its clear callback before setGraph', async () => {
      const graph = new LGraph()
      const parameters = 'positive\nNegative prompt: negative\nSteps: 20'
      Reflect.set(app, 'rootGraphInternal', graph)
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({ parameters })
      mockImportA1111.mockImplementation(
        async (_graph, _parameters, beforeGraphClear) => {
          await beforeGraphClear?.()
          return 'imported'
        }
      )
      let resolveAfterLoad: (() => void) | undefined
      const afterLoad = new Promise<void>((resolve) => {
        resolveAfterLoad = resolve
      })
      mockWorkflowService.afterLoadNewGraph.mockReturnValue(afterLoad)

      let settled = false
      const handleFile = app
        .handleFile(createTestFile('a1111.png', 'image/png'))
        .then(() => {
          settled = true
        })
      await vi.waitFor(() =>
        expect(mockWorkflowService.afterLoadNewGraph).toHaveBeenCalled()
      )

      expect(mockCanvas.setGraph).toHaveBeenCalledWith(graph)
      expect(mockWorkflowService.beforeLoadNewGraph).toHaveBeenCalledOnce()
      expect(mockWorkflowService.beforeLoadNewGraph).toHaveBeenCalledWith(false)
      expect(
        mockWorkflowService.beforeLoadNewGraph.mock.invocationCallOrder[0]
      ).toBeLessThan(vi.mocked(mockCanvas.setGraph).mock.invocationCallOrder[0])
      expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
        'beforeLoadGraph'
      )
      expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
        'beforeConfigureGraph',
        graph,
        parameters
      )
      expect(
        mockExtensionService.invokeExtensionsAsync
      ).not.toHaveBeenCalledWith('afterLoadGraph')
      expect(settled).toBe(false)

      resolveAfterLoad?.()
      await handleFile
      expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
        'afterConfigureGraph',
        parameters,
        undefined,
        graph
      )
      expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
        'afterLoadGraph'
      )
      expect(settled).toBe(true)
    })
  })

  describe('drop handler', () => {
    it('ignores dropped files while the canvas is picking-only', async () => {
      const adjustMouseEvent = vi.fn()
      app.canvas = {
        ...mockCanvas,
        selectOnly: true,
        adjustMouseEvent
      } as unknown as LGraphCanvas
      ;(app as unknown as { addDropHandler(): void }).addDropHandler()

      const event = new DragEvent('drop', { cancelable: true })
      document.dispatchEvent(event)
      await Promise.resolve()

      // The guard returns after preventDefault: nothing reads the payload.
      expect(event.defaultPrevented).toBe(true)
      expect(adjustMouseEvent).not.toHaveBeenCalled()
      expect(vi.mocked(extractFilesFromDragEvent)).not.toHaveBeenCalled()
    })

    it('ignores extracted files when the target canvas is replaced', async () => {
      app.canvas = {
        ...mockCanvas,
        selectOnly: false,
        graph_mouse: [0, 0],
        adjustMouseEvent: vi.fn()
      } as unknown as LGraphCanvas
      let finishExtraction: (files: File[]) => void = () => {}
      vi.mocked(extractFilesFromDragEvent).mockReturnValue(
        new Promise((resolve) => {
          finishExtraction = resolve
        })
      )
      const handleFile = vi
        .spyOn(app, 'handleFile')
        .mockResolvedValue(undefined)
      ;(app as unknown as { addDropHandler(): void }).addDropHandler()

      document.dispatchEvent(new DragEvent('drop'))
      await vi.waitFor(() =>
        expect(extractFilesFromDragEvent).toHaveBeenCalled()
      )
      app.canvas = { ...mockCanvas } as unknown as LGraphCanvas
      finishExtraction([createTestFile('workflow.json', 'application/json')])
      await Promise.resolve()

      expect(handleFile).not.toHaveBeenCalled()
    })

    it('syncs the drop position and waits for the replacement workflow before restoring warnings', async () => {
      const graphMouse: [number, number] = [-999, -999]
      const adjustMouseEvent = vi.fn((e: DragEvent) => {
        ;(e as DragEvent & { canvasX: number; canvasY: number }).canvasX = 123
        ;(e as DragEvent & { canvasX: number; canvasY: number }).canvasY = 456
      })
      app.canvas = {
        ...mockCanvas,
        graph_mouse: graphMouse,
        adjustMouseEvent
      } as unknown as LGraphCanvas

      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      Reflect.set(singletonApp, 'rootGraphInternal', graph)
      const outgoingWorkflow = new ComfyWorkflow({
        path: 'workflows/outgoing.json',
        modified: 0,
        size: 0
      })
      outgoingWorkflow.pendingWarnings = {
        missingNodeTypes: ['OutgoingMissingNode']
      }
      mockWorkspaceWorkflow.activeWorkflow = outgoingWorkflow
      const realWorkflowStore = useWorkflowStore()
      realWorkflowStore.activeWorkflow = markLoaded(outgoingWorkflow)
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes(['OutgoingMissingNode'])
      await useRealWorkflowService()

      const nodeType = 'test/UninstalledDroppedApiNode'
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
        prompt: {
          '1': {
            class_type: nodeType,
            inputs: {}
          }
        }
      })
      vi.mocked(extractFilesFromDragEvent).mockResolvedValue([
        createTestFile('workflow.json', 'application/json')
      ])

      let releaseOpenWorkflow: () => void = () => {}
      const openWorkflowGate = new Promise<void>((resolve) => {
        releaseOpenWorkflow = resolve
      })
      mockWorkspaceWorkflow.openWorkflow.mockImplementation(
        async (workflow: ComfyWorkflow) => {
          await openWorkflowGate
          mockWorkspaceWorkflow.activeWorkflow = workflow
          realWorkflowStore.activeWorkflow = markLoaded(workflow)
          return workflow
        }
      )

      try {
        ;(app as unknown as { addDropHandler(): void }).addDropHandler()

        document.dispatchEvent(new DragEvent('drop'))
        await vi.waitFor(() => {
          expect(mockWorkspaceWorkflow.openWorkflow).toHaveBeenCalledOnce()
        })

        expect(adjustMouseEvent).toHaveBeenCalledTimes(1)
        expect(graphMouse).toEqual([123, 456])
        expect(missingNodesStore.missingNodesError).toBeNull()

        releaseOpenWorkflow()
        await vi.waitFor(() => {
          expect(mockWorkspaceWorkflow.activeWorkflow).not.toBe(
            outgoingWorkflow
          )
        })
        await vi.waitFor(() => {
          expect(missingNodesStore.missingNodesError?.nodeTypes).toEqual([
            expect.objectContaining({ type: nodeType, nodeId: '1' })
          ])
        })
      } finally {
        releaseOpenWorkflow()
      }
    })
  })
})
