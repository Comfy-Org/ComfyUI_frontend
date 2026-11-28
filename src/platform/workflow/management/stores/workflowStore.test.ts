import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { UnauthorizedError } from '@comfyorg/api-client/ComfyApi'
import { nextTick, reactive, toRaw } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createCanvas } from '@/lib/litegraph/src/__fixtures__/canvasHarness'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useSettingStore } from '@/platform/settings/settingStore'
import {
  bindCanvasTracker,
  isCanvasOwner,
  resetCanvasTrackerForTest
} from '@/platform/workflow/core/canvasTrackerOwnership'
import type { LinearInput } from '@/platform/workflow/management/stores/comfyWorkflow'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import {
  resetReportedWorkflowStateAnomaliesForTests,
  UnreadableWorkflowError
} from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowBookmarkStore } from '@/platform/workflow/management/stores/workflowBookmarkStore'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { zComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'
import { useWorkflowDraftStoreV2 } from '@/platform/workflow/persistence/stores/workflowDraftStoreV2'
import { api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'
import {
  initDefaultWorkflow,
  resetDefaultWorkflowForTesting
} from '@/platform/workflow/core/services/defaultWorkflowService'
import { defaultGraph, defaultGraphJSON } from '@/scripts/defaultGraph'
import { ChangeTracker } from '@/scripts/changeTracker'
import { useWidgetHistoryStore } from '@/stores/widgetHistoryStore'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import { reportError } from '@comfyorg/telemetry/reportError'
import { isValidUuid } from '@/utils/formatUtil'
import { syncEntities } from '@/utils/syncUtil'
import { createMockChangeTracker } from '@/utils/__tests__/litegraphTestUtils'

vi.mock(import('@/scripts/api'))
vi.mock(import('@comfyorg/telemetry/reportError'), { spy: true })

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    canvas: undefined,
    get canvasOrUndefined() {
      return this.canvas
    }
  }
}))

vi.mock(import('@/utils/syncUtil'), { spy: true })

const mockAssert = vi.hoisted(() => vi.fn())

vi.mock(import('@/base/assert'), () => ({
  assert: mockAssert
}))

const BOOKMARK_INDEX = 'workflows/.index.json'

type BookmarkReadFailure = number | Error | { malformedBody: string }

function serveBookmarkIndex(
  favorites?: string[],
  otherFields: Record<string, unknown> = {}
) {
  let stored = favorites && JSON.stringify({ ...otherFields, favorites })
  let readFailure: BookmarkReadFailure | undefined
  let writeFailure: number | Error | undefined
  let holdingWrites = false
  const heldWrites: Array<() => void> = []
  let onWrite: (() => void) | undefined

  vi.mocked(api.getUserData).mockImplementation(async (file) => {
    if (file !== BOOKMARK_INDEX) return new Response(null, { status: 404 })
    if (readFailure !== undefined) {
      const failure = readFailure
      readFailure = undefined
      if (failure instanceof Error) throw failure
      return typeof failure === 'number'
        ? new Response(null, { status: failure })
        : new Response(failure.malformedBody, { status: 200 })
    }
    return stored === undefined
      ? new Response(null, { status: 404 })
      : new Response(stored, { status: 200 })
  })
  vi.mocked(api.storeUserData).mockImplementation(async (file, data) => {
    if (file !== BOOKMARK_INDEX) return new Response(null, { status: 200 })
    if (writeFailure instanceof Error) throw writeFailure
    if (writeFailure) return new Response(null, { status: writeFailure })
    const body = JSON.stringify(data)
    if (!holdingWrites) {
      stored = body
      return new Response(null, { status: 200 })
    }
    return new Promise<Response>((resolve) => {
      heldWrites.push(() => {
        stored = body
        resolve(new Response(null, { status: 200 }))
      })
      onWrite?.()
    })
  })

  const writeHeld = () =>
    heldWrites.length > 0
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          onWrite = resolve
        })

  const index = (): Record<string, unknown> | undefined =>
    stored === undefined ? undefined : JSON.parse(stored)

  return {
    index,
    favorites: () => index()?.favorites,
    saveElsewhere: (next: string[]) => {
      stored = JSON.stringify({ ...otherFields, favorites: next })
    },
    storeContent: (content: string) => {
      stored = content
    },
    failNextRead: (failure: BookmarkReadFailure) => {
      readFailure = failure
    },
    failWrites: (failure: number | Error) => {
      writeFailure = failure
    },
    holdWrites: () => {
      holdingWrites = true
    },
    writeHeld,
    async deliverOldestWrite() {
      await writeHeld()
      heldWrites.shift()?.()
    },
    async deliverNewestFirst(operations: Promise<unknown>[]) {
      const settled = Promise.all(operations).then(() => 'settled' as const)
      while ((await Promise.race([settled, writeHeld()])) !== 'settled') {
        heldWrites.pop()?.()
      }
    }
  }
}

describe('useWorkflowStore', () => {
  let store: ReturnType<typeof useWorkflowStore>
  let bookmarkStore: ReturnType<typeof useWorkflowBookmarkStore>

  const syncRemoteWorkflows = async (filenames: string[]) => {
    vi.mocked(api.listUserDataFullInfo).mockResolvedValue(
      filenames.map((filename) => ({
        path: filename,
        modified: new Date().getTime(),
        size: 1 // size !== -1 for remote workflows
      }))
    )
    return await store.syncWorkflows()
  }

  const syncRemoteWorkflowsWithMeta = async (
    files: Array<{ path: string; modified: number; size: number }>
  ) => {
    vi.mocked(api.listUserDataFullInfo).mockResolvedValue(files)
    return await store.syncWorkflows()
  }

  const saveV2Draft = (
    path: string,
    options: {
      data?: string
      name?: string
      isTemporary?: boolean
    } = {}
  ) => {
    const draftStore = useWorkflowDraftStoreV2()
    draftStore.saveDraft(path, options.data ?? '{"dirty":true}', {
      name: options.name ?? path.split('/').at(-1) ?? path,
      isTemporary: options.isTemporary ?? false
    })
    return draftStore
  }

  const enableWorkflowPersistence = () => {
    useSettingStore().settingsById['Comfy.Workflow.Persist'] = {
      id: 'Comfy.Workflow.Persist',
      name: 'Persist workflow state',
      type: 'boolean',
      defaultValue: true
    }
  }

  beforeEach(() => {
    const rootGraph = createTestRootGraph()
    const canvas = createCanvas(rootGraph)
    vi.mocked(comfyApp).rootGraph = rootGraph
    vi.mocked(comfyApp).canvas = canvas
    onTestFinished(() => {
      canvas.unbindEvents()
      canvas.canvas.remove()
    })

    store = useWorkflowStore()
    store.provideChangeTracker(ChangeTracker)
    bookmarkStore = useWorkflowBookmarkStore()

    vi.mocked(api.getUserData).mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ favorites: [] })
    } as Response)
    vi.mocked(api.storeUserData).mockResolvedValue({
      status: 200
    } as Response)
  })

  describe('syncWorkflows', () => {
    it('does not report a 401 listing (the session ended)', async () => {
      vi.mocked(api.listUserDataFullInfo).mockRejectedValue(
        new UnauthorizedError("Error getting user data list 'workflows': 401 ")
      )

      await store.syncWorkflows()

      expect(reportError).not.toHaveBeenCalled()
    })

    it('still reports a listing failure that is not a 401', async () => {
      const failure = new Error(
        "Error getting user data list 'workflows': 500 "
      )
      vi.mocked(api.listUserDataFullInfo).mockRejectedValue(failure)

      await store.syncWorkflows()

      expect(reportError).toHaveBeenCalledExactlyOnceWith(failure, {
        surface: 'graph',
        errorType: 'error_listing_workflows'
      })
    })

    it('should sync workflows', async () => {
      await syncRemoteWorkflows(['a.json', 'b.json'])
      expect(store.workflows.length).toBe(2)
    })

    it('should exclude temporary workflows', async () => {
      const workflow = store.createTemporary('c.json')
      await syncRemoteWorkflows(['a.json', 'b.json'])
      expect(store.workflows.length).toBe(3)
      expect(store.workflows.filter((w) => w.isTemporary)).toEqual([workflow])
    })

    it('should not unload the active workflow during sync', async () => {
      await syncRemoteWorkflowsWithMeta([
        { path: 'a.json', modified: 100, size: 1 }
      ])
      const workflow = store.getWorkflowByPath('workflows/a.json')!

      vi.mocked(api.getUserData).mockResolvedValue({
        status: 200,
        text: () => Promise.resolve(defaultGraphJSON)
      } as Response)

      await store.openWorkflow(workflow)
      expect(store.activeWorkflow?.path).toBe('workflows/a.json')
      expect(store.activeWorkflow?.isLoaded).toBe(true)

      await syncRemoteWorkflowsWithMeta([
        { path: 'a.json', modified: 200, size: 2 }
      ])

      expect(store.activeWorkflow?.isLoaded).toBe(true)
      expect(workflow.lastModified).toBe(200)
      expect(workflow.size).toBe(2)
    })

    it('keeps the unsaved edits of a background tab whose file changed remotely', async () => {
      await syncRemoteWorkflowsWithMeta([
        { path: 'edited.json', modified: 100, size: 1 },
        { path: 'active.json', modified: 100, size: 1 }
      ])
      const edited = store.getWorkflowByPath('workflows/edited.json')!
      vi.mocked(api.getUserData).mockImplementation(
        async () => new Response(defaultGraphJSON, { status: 200 })
      )
      await store.openWorkflow(edited)
      edited.changeTracker!.activeState = {
        ...edited.changeTracker!.activeState,
        extra: { unsaved: true }
      }
      edited.isModified = true
      await store.openWorkflow(
        store.getWorkflowByPath('workflows/active.json')!
      )

      await syncRemoteWorkflowsWithMeta([
        { path: 'edited.json', modified: 200, size: 2 },
        { path: 'active.json', modified: 100, size: 1 }
      ])

      expect(edited.isLoaded).toBe(true)
      expect(edited.isModified).toBe(true)
      expect(edited.activeState?.extra).toEqual({ unsaved: true })
      expect(edited.lastModified).toBe(100)
    })

    it('still drops the cached content of an unmodified background tab whose file changed', async () => {
      await syncRemoteWorkflowsWithMeta([
        { path: 'clean.json', modified: 100, size: 1 },
        { path: 'active.json', modified: 100, size: 1 }
      ])
      const clean = store.getWorkflowByPath('workflows/clean.json')!
      vi.mocked(api.getUserData).mockImplementation(
        async () => new Response(defaultGraphJSON, { status: 200 })
      )
      await store.openWorkflow(clean)
      await store.openWorkflow(
        store.getWorkflowByPath('workflows/active.json')!
      )

      await syncRemoteWorkflowsWithMeta([
        { path: 'clean.json', modified: 200, size: 2 },
        { path: 'active.json', modified: 100, size: 1 }
      ])

      expect(clean.isLoaded).toBe(false)
      expect(clean.isModified).toBe(false)
    })

    describe('node widget histories', () => {
      const rootGraphId = '00000000-0000-4000-8000-0000000000a1'

      async function loadSyncedWorkflow() {
        await syncRemoteWorkflowsWithMeta([
          { path: 'a.json', modified: 100, size: 1 }
        ])
        const workflow = store.getWorkflowByPath('workflows/a.json')
        assert(workflow)
        vi.mocked(api.getUserData).mockResolvedValue(
          fromPartial<Response>({
            status: 200,
            text: () =>
              Promise.resolve(
                JSON.stringify({ ...defaultGraph, id: rootGraphId })
              )
          })
        )
        await workflow.load()
        return workflow
      }

      function recordNodeHistory() {
        const scope = {
          rootGraphId,
          widgetId: widgetId(rootGraphId, toNodeId(1), 'bboxes')
        }
        useWidgetHistoryStore().record(scope, [])
        return () => useWidgetHistoryStore().canUndo(scope)
      }

      it('forgets them when a remote change unloads the workflow', async () => {
        await loadSyncedWorkflow()
        const hasHistory = recordNodeHistory()

        await syncRemoteWorkflowsWithMeta([
          { path: 'a.json', modified: 200, size: 2 }
        ])

        expect(hasHistory()).toBe(false)
      })

      it('forgets them when the workflow file is deleted remotely', async () => {
        await loadSyncedWorkflow()
        const hasHistory = recordNodeHistory()

        await syncRemoteWorkflowsWithMeta([])

        expect(hasHistory()).toBe(false)
      })
    })

    it('should not unload a loaded workflow if metadata has not changed', async () => {
      await syncRemoteWorkflowsWithMeta([
        { path: 'a.json', modified: 100, size: 1 }
      ])
      const workflow = store.getWorkflowByPath('workflows/a.json')!

      vi.mocked(api.getUserData).mockResolvedValue({
        status: 200,
        text: () => Promise.resolve(defaultGraphJSON)
      } as Response)

      await workflow.load()
      expect(workflow.isLoaded).toBe(true)

      await syncRemoteWorkflowsWithMeta([
        { path: 'a.json', modified: 100, size: 1 }
      ])
      expect(workflow.isLoaded).toBe(true)
    })

    it('should unload a loaded workflow if metadata has changed and it is not active', async () => {
      await syncRemoteWorkflowsWithMeta([
        { path: 'a.json', modified: 100, size: 1 }
      ])
      const workflow = store.getWorkflowByPath('workflows/a.json')!

      vi.mocked(api.getUserData).mockResolvedValue({
        status: 200,
        text: () => Promise.resolve(defaultGraphJSON)
      } as Response)

      await workflow.load()
      expect(workflow.isLoaded).toBe(true)
      expect(workflow.content).toBe(defaultGraphJSON)
      expect(workflow.originalContent).toBe(defaultGraphJSON)

      // Metadata change should invalidate cached content for non-active workflows.
      await syncRemoteWorkflowsWithMeta([
        { path: 'a.json', modified: 200, size: 2 }
      ])

      expect(workflow.lastModified).toBe(200)
      expect(workflow.size).toBe(2)
      expect(workflow.isLoaded).toBe(false)
      expect(workflow.content).toBeNull()
      expect(workflow.originalContent).toBeNull()
    })

    it('disposes the owned graph when a remote change unloads the workflow', async () => {
      await syncRemoteWorkflowsWithMeta([
        { path: 'a.json', modified: 100, size: 1 }
      ])
      const workflow = store.getWorkflowByPath('workflows/a.json')!
      vi.mocked(api.getUserData).mockResolvedValue(
        new Response(defaultGraphJSON, { status: 200 })
      )
      await workflow.load()
      const graph = fromPartial<LGraph>({ clear: vi.fn() })
      workflow.adoptGraph(graph)

      await syncRemoteWorkflowsWithMeta([
        { path: 'a.json', modified: 200, size: 2 }
      ])

      expect(workflow.graph).toBeNull()
      expect(graph.clear).toHaveBeenCalledOnce()
    })

    it('disposes the owned graph when the workflow file is deleted remotely', async () => {
      await syncRemoteWorkflowsWithMeta([
        { path: 'a.json', modified: 100, size: 1 }
      ])
      const workflow = store.getWorkflowByPath('workflows/a.json')!
      vi.mocked(api.getUserData).mockResolvedValue(
        new Response(defaultGraphJSON, { status: 200 })
      )
      await workflow.load()
      const graph = fromPartial<LGraph>({ clear: vi.fn() })
      workflow.adoptGraph(graph)

      await syncRemoteWorkflowsWithMeta([])

      expect(store.getWorkflowByPath('workflows/a.json')).toBeNull()
      expect(graph.clear).toHaveBeenCalledOnce()
    })
  })

  describe('createTemporary', () => {
    it('should create a temporary workflow with a unique path', () => {
      const workflow = store.createTemporary()
      expect(workflow.path).toBe('workflows/Unsaved Workflow.json')

      const workflow2 = store.createTemporary()
      expect(workflow2.path).toBe('workflows/Unsaved Workflow (2).json')
    })

    it('gives each default-created workflow its own root graph id', async () => {
      const servedId = '11111111-1111-4111-8111-111111111111'
      onTestFinished(resetDefaultWorkflowForTesting)
      resetDefaultWorkflowForTesting()
      vi.mocked(api.fetchApi).mockResolvedValue(
        new Response(
          JSON.stringify({
            ...defaultGraph,
            id: servedId,
            last_node_id: 4242
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      await initDefaultWorkflow()

      const first = JSON.parse(store.createTemporary().content!)
      const second = JSON.parse(store.createTemporary().content!)

      expect(first.last_node_id).toBe(4242)
      expect(first.id).toBeTruthy()
      expect(first.id).not.toBe(servedId)
      expect(second.id).not.toBe(first.id)
    })

    it('assigns each workflow a stable unique session identity', async () => {
      const workflow = store.createTemporary()
      const otherWorkflow = store.createTemporary()
      const instanceId = workflow.instanceId

      await workflow.rename('workflows/renamed.json')

      expect(workflow.instanceId).toBe(instanceId)
      expect(otherWorkflow.instanceId).not.toBe(instanceId)
    })

    it('should create a temporary workflow not clashing with persisted workflows', async () => {
      await syncRemoteWorkflows(['a.json'])
      const workflow = store.createTemporary('a.json')
      expect(workflow.path).toBe('workflows/a (2).json')
    })

    it('should assign a workflow id to newly created temporary workflows', () => {
      const workflow = store.createTemporary('id-test.json')
      const state = zComfyWorkflow.parse(JSON.parse(workflow.content!))

      expect(isValidUuid(state.id)).toBe(true)
    })

    it('migrates a legacy id without mutating the input', () => {
      const workflowData = fromPartial<ComfyWorkflowJSON>({
        ...defaultGraph,
        id: 'video-point-prompt-example'
      })
      const originalData = structuredClone(workflowData)

      const workflow = store.createTemporary('legacy.json', workflowData)
      const state = zComfyWorkflow.parse(JSON.parse(workflow.content!))

      expect(isValidUuid(state.id)).toBe(true)
      expect(workflow.legacyId).toBe('video-point-prompt-example')
      expect(workflowData).toEqual(originalData)
    })

    it('accepts workflow data holding a reactive proxy', () => {
      const workflowData = fromPartial<ComfyWorkflowJSON>({
        ...structuredClone(defaultGraph),
        extra: {
          linearData: {
            inputs: [reactive<LinearInput>(['1', 'seed'])],
            outputs: []
          }
        }
      })

      const workflow = store.createNewTemporary('proxy.json', workflowData)
      const state = JSON.parse(workflow.content!)

      expect(state.extra.linearData.inputs).toEqual([['1', 'seed']])
    })

    it.for([
      {
        label: 'the same legacy id',
        existingId: '9cea40bb-b0cf-4b40-a758-8935cfe8d52f',
        incomingId: 'legacy-a',
        legacyId: 'legacy-a',
        expectedPath: 'external/repeat.json',
        expectedResetCount: 1
      },
      {
        label: 'a different legacy id',
        existingId: '9cea40bb-b0cf-4b40-a758-8935cfe8d52f',
        incomingId: 'legacy-b',
        legacyId: 'legacy-a',
        expectedPath: 'workflows/repeat.json',
        expectedResetCount: 0
      },
      {
        label: 'equivalent UUID casing',
        existingId: '9cea40bb-b0cf-4b40-a758-8935cfe8d52f',
        incomingId: '9CEA40BB-B0CF-4B40-A758-8935CFE8D52F',
        expectedPath: 'external/repeat.json',
        expectedResetCount: 1
      }
    ])(
      'returns $expectedPath for an external same-name workflow with $label',
      ({
        existingId,
        incomingId,
        legacyId,
        expectedPath,
        expectedResetCount
      }) => {
        const existingWorkflow = new ComfyWorkflow({
          path: 'external/repeat.json',
          modified: Date.now(),
          size: -1
        })
        existingWorkflow.changeTracker = createMockChangeTracker()
        existingWorkflow.changeTracker.activeState.id = existingId
        existingWorkflow.legacyId = legacyId
        store.attachWorkflow(existingWorkflow)

        const result = store.createTemporary(
          'repeat.json',
          fromPartial<ComfyWorkflowJSON>({ ...defaultGraph, id: incomingId })
        )

        expect(result.path).toBe(expectedPath)
        expect(existingWorkflow.changeTracker.reset).toHaveBeenCalledTimes(
          expectedResetCount
        )
      }
    )
  })

  describe('openWorkflow', () => {
    it('should load and open a temporary workflow', async () => {
      // Create a test workflow
      const workflow = store.createTemporary('test.json')

      // Mock the load response
      vi.spyOn(workflow, 'load').mockImplementation(async () => {
        workflow.changeTracker = createMockChangeTracker({
          workflow
        })
        return workflow as LoadedComfyWorkflow
      })

      // Open the workflow
      await store.openWorkflow(workflow)

      // Verify the workflow is now active
      expect(store.activeWorkflow?.path).toBe(workflow.path)

      // Verify the workflow is in the open workflows list
      expect(store.isOpen(workflow)).toBe(true)
    })

    it('should not reload an already active workflow', async () => {
      const workflow = await store.createTemporary('test.json').load()
      vi.spyOn(workflow, 'load')

      // Set as active workflow
      store.activeWorkflow = workflow

      await store.openWorkflow(workflow)

      // Verify load was not called
      expect(workflow.load).not.toHaveBeenCalled()
    })

    it('should load a remote workflow', async () => {
      await syncRemoteWorkflows(['a.json'])
      const workflow = store.getWorkflowByPath('workflows/a.json')!
      expect(workflow).not.toBeNull()
      expect(workflow.path).toBe('workflows/a.json')
      expect(workflow.isLoaded).toBe(false)
      expect(workflow.isTemporary).toBe(false)
      vi.mocked(api.getUserData).mockResolvedValue({
        status: 200,
        text: () => Promise.resolve(defaultGraphJSON)
      } as Response)
      await workflow.load()

      expect(workflow.isLoaded).toBe(true)
      expect(workflow.content).toEqual(defaultGraphJSON)
      expect(workflow.originalContent).toEqual(defaultGraphJSON)
      expect(workflow.activeState).toEqual(defaultGraph)
      expect(workflow.initialState).toEqual(defaultGraph)
      expect(workflow.isModified).toBe(false)
    })

    it('should prefer a persisted V2 draft when loading a remote workflow', async () => {
      enableWorkflowPersistence()

      await syncRemoteWorkflowsWithMeta([
        { path: 'a.json', modified: 100, size: 1 }
      ])

      const workflow = store.getWorkflowByPath('workflows/a.json')!
      const draftGraph = JSON.parse(defaultGraphJSON)
      draftGraph.extra = {
        ...draftGraph.extra,
        draftMarker: 'v2'
      }

      saveV2Draft(workflow.path, {
        data: JSON.stringify(draftGraph),
        name: 'a.json'
      })

      vi.mocked(api.getUserData).mockResolvedValue({
        status: 200,
        text: () => Promise.resolve(defaultGraphJSON)
      } as Response)

      await workflow.load()

      expect(workflow.activeState?.extra?.draftMarker).toBe('v2')
      expect(workflow.isModified).toBe(true)
    })

    describe('restoring a saved workflow over its draft', () => {
      const loadWithDraft = async (
        draftData: string,
        fileData = defaultGraphJSON
      ) => {
        enableWorkflowPersistence()
        await syncRemoteWorkflowsWithMeta([
          { path: 'a.json', modified: 100, size: 1 }
        ])
        const workflow = store.getWorkflowByPath('workflows/a.json')!
        saveV2Draft(workflow.path, { data: draftData, name: 'a.json' })
        vi.mocked(api.getUserData).mockResolvedValue(
          new Response(fileData, { status: 200 })
        )
        await workflow.load()
        return workflow
      }

      const draftWithExtra = (extra: ComfyWorkflowJSON['extra']) => {
        const draftGraph: ComfyWorkflowJSON = structuredClone(defaultGraph)
        draftGraph.extra = { ...draftGraph.extra, ...extra }
        return JSON.stringify(draftGraph)
      }

      it('does not mark it modified when the draft a tab switch left matches the file', async () => {
        const workflow = await loadWithDraft(defaultGraphJSON)

        expect(workflow.activeState).toEqual(defaultGraph)
        expect(workflow.isModified).toBe(false)
      })

      it('keeps the draft viewport without marking it modified', async () => {
        const workflow = await loadWithDraft(
          draftWithExtra({ ds: { scale: 2.5, offset: [40, -80] } })
        )

        expect(workflow.activeState?.extra?.ds).toEqual({
          scale: 2.5,
          offset: [40, -80]
        })
        expect(workflow.isModified).toBe(false)
      })

      it('marks it modified when the draft only changes app mode', async () => {
        const workflow = await loadWithDraft(
          draftWithExtra({ linearMode: true })
        )

        expect(workflow.activeState?.extra?.linearMode).toBe(true)
        expect(workflow.isModified).toBe(true)
      })

      it('gives a draft with a legacy id the file id and keeps the legacy id', async () => {
        const fileId = '5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e'
        const workflow = await loadWithDraft(
          JSON.stringify({ ...defaultGraph, id: 'legacy-draft-id' }),
          JSON.stringify({ ...defaultGraph, id: fileId })
        )

        expect(workflow.activeState?.id).toBe(fileId)
        expect(workflow.legacyId).toBe('legacy-draft-id')
      })

      it('does not keep a non-string draft id as the legacy id', async () => {
        const fileId = '5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e'
        const workflow = await loadWithDraft(
          JSON.stringify({ ...defaultGraph, id: 42 }),
          JSON.stringify({ ...defaultGraph, id: fileId })
        )

        expect(workflow.activeState?.id).toBe(fileId)
        expect(workflow.legacyId).toBeUndefined()
      })

      it('leaves a draft that is not a workflow object unchanged', async () => {
        const workflow = await loadWithDraft(
          '[]',
          JSON.stringify({
            ...defaultGraph,
            id: '5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e'
          })
        )

        expect(workflow.activeState).toEqual([])
      })

      it('marks it modified when the draft has no node list to compare', async () => {
        const workflow = await loadWithDraft('{"links":[]}')

        expect(workflow.activeState).toEqual({ links: [] })
        expect(workflow.isModified).toBe(true)
      })

      it('marks it modified when the saved file has no node list to compare', async () => {
        const workflow = await loadWithDraft(defaultGraphJSON, '{"links":[]}')

        expect(workflow.activeState).toEqual(defaultGraph)
        expect(workflow.isModified).toBe(true)
      })
    })

    it('should discard a stale V2 draft when the remote workflow is newer', async () => {
      enableWorkflowPersistence()
      const remoteModifiedAt = Date.now() + 60_000

      await syncRemoteWorkflowsWithMeta([
        { path: 'a.json', modified: remoteModifiedAt, size: 1 }
      ])

      const workflow = store.getWorkflowByPath('workflows/a.json')!
      const draftGraph = JSON.parse(defaultGraphJSON)
      draftGraph.extra = {
        ...draftGraph.extra,
        draftMarker: 'stale-v2'
      }
      const draftStore = saveV2Draft(workflow.path, {
        data: JSON.stringify(draftGraph),
        name: 'a.json'
      })

      vi.mocked(api.getUserData).mockResolvedValue({
        status: 200,
        text: () => Promise.resolve(defaultGraphJSON)
      } as Response)

      await workflow.load()

      expect(workflow.activeState?.extra?.draftMarker).toBeUndefined()
      expect(workflow.isModified).toBe(false)
      expect(draftStore.getDraft(workflow.path)).toBeNull()
    })

    it('should load and open a remote workflow', async () => {
      await syncRemoteWorkflows(['a.json', 'b.json'])

      const workflow = store.getWorkflowByPath('workflows/a.json')!
      expect(workflow).not.toBeNull()
      expect(workflow.path).toBe('workflows/a.json')
      expect(workflow.isLoaded).toBe(false)
      vi.mocked(api.getUserData).mockResolvedValue({
        status: 200,
        text: () => Promise.resolve(defaultGraphJSON)
      } as Response)

      const loadedWorkflow = await store.openWorkflow(workflow)

      expect(loadedWorkflow).toBe(workflow)
      expect(loadedWorkflow.path).toBe('workflows/a.json')
      expect(store.activeWorkflow?.path).toBe('workflows/a.json')
      expect(store.isOpen(loadedWorkflow)).toBe(true)
      expect(loadedWorkflow.content).toEqual(defaultGraphJSON)
      expect(loadedWorkflow.originalContent).toEqual(defaultGraphJSON)
      expect(loadedWorkflow.isLoaded).toBe(true)
      expect(loadedWorkflow.activeState).toEqual(defaultGraph)
      expect(loadedWorkflow.initialState).toEqual(defaultGraph)
      expect(loadedWorkflow.isModified).toBe(false)
    })
  })

  describe('canvas tracker ownership', () => {
    const openRemoteWorkflowOnCanvas = async () => {
      resetCanvasTrackerForTest()
      onTestFinished(resetCanvasTrackerForTest)
      await syncRemoteWorkflows(['a.json'])
      vi.mocked(api.getUserData).mockImplementation(
        async () => new Response(defaultGraphJSON, { status: 200 })
      )
      const opened = await store.openWorkflow(
        store.getWorkflowByPath('workflows/a.json')!
      )
      bindCanvasTracker(opened.changeTracker)
      return opened
    }

    it('keeps the canvas on the active tracker after the active workflow force-reloads', async () => {
      const workflow = await openRemoteWorkflowOnCanvas()

      await workflow.load({ force: true })

      expect(isCanvasOwner(store.activeWorkflow!.changeTracker)).toBe(true)
    })

    it('does not leave the canvas owner inside a transaction the replaced tracker opened', async () => {
      const workflow = await openRemoteWorkflowOnCanvas()
      const replaced = workflow.changeTracker
      replaced.beforeChange()

      await workflow.load({ force: true })
      replaced.afterChange()

      expect(store.activeWorkflow!.changeTracker.changeCount).toBe(0)
    })

    it('keeps the canvas on the active tracker when a same-path object is opened', async () => {
      await openRemoteWorkflowOnCanvas()
      const samePath = await new ComfyWorkflow({
        path: 'workflows/a.json',
        modified: Date.now(),
        size: 1
      }).load()

      const opened = await store.openWorkflow(samePath)
      bindCanvasTracker(opened.changeTracker)

      expect(isCanvasOwner(store.activeWorkflow!.changeTracker)).toBe(true)
    })

    it('activates the lookup entry when it replaced the active instance', async () => {
      await openRemoteWorkflowOnCanvas()
      const replacement = await new ComfyWorkflow({
        path: 'workflows/a.json',
        modified: Date.now(),
        size: 1
      }).load()
      store.attachWorkflow(replacement)

      const opened = await store.openWorkflow(replacement)

      expect(toRaw(opened)).toBe(toRaw(replacement))
      expect(toRaw(store.activeWorkflow)).toBe(toRaw(replacement))
    })
  })

  describe('openWorkflowsInBackground', () => {
    let workflowA: ComfyWorkflow
    let workflowB: ComfyWorkflow
    let workflowC: ComfyWorkflow

    const openWorkflowPaths = () =>
      store.openWorkflows.filter((w) => store.isOpen(w)).map((w) => w.path)

    beforeEach(async () => {
      await syncRemoteWorkflows(['a.json', 'b.json', 'c.json'])
      workflowA = store.getWorkflowByPath('workflows/a.json')!
      workflowB = store.getWorkflowByPath('workflows/b.json')!
      workflowC = store.getWorkflowByPath('workflows/c.json')!
      vi.mocked(api.getUserData).mockResolvedValue({
        status: 200,
        text: () => Promise.resolve(defaultGraphJSON)
      } as Response)
    })

    it('should open workflows adjacent to the active workflow', async () => {
      await store.openWorkflow(workflowA)
      store.openWorkflowsInBackground({
        left: [workflowB.path],
        right: [workflowC.path]
      })
      expect(openWorkflowPaths()).toEqual([
        workflowB.path,
        workflowA.path,
        workflowC.path
      ])
    })

    it('should not change the active workflow', async () => {
      await store.openWorkflow(workflowA)
      store.openWorkflowsInBackground({
        left: [workflowC.path],
        right: [workflowB.path]
      })
      expect(store.activeWorkflow).not.toBeUndefined()
      expect(store.activeWorkflow!.path).toBe(workflowA.path)
    })

    it('should open workflows when none are active', async () => {
      expect(store.openWorkflows.length).toBe(0)
      store.openWorkflowsInBackground({
        left: [workflowA.path],
        right: [workflowB.path]
      })
      expect(openWorkflowPaths()).toEqual([workflowA.path, workflowB.path])
    })

    it('should not open duplicate workflows', async () => {
      store.openWorkflowsInBackground({
        left: [workflowA.path, workflowB.path, workflowA.path],
        right: [workflowB.path, workflowA.path, workflowB.path]
      })
      expect(openWorkflowPaths()).toEqual([workflowA.path, workflowB.path])
    })

    it('should not open workflow that is already open', async () => {
      await store.openWorkflow(workflowA)
      store.openWorkflowsInBackground({
        left: [workflowA.path]
      })
      expect(openWorkflowPaths()).toEqual([workflowA.path])
      expect(store.activeWorkflow?.path).toBe(workflowA.path)
    })

    it('should ignore invalid or deleted workflow paths', async () => {
      await store.openWorkflow(workflowA)
      store.openWorkflowsInBackground({
        left: ['workflows/invalid::$-path.json'],
        right: ['workflows/deleted-since-last-session.json']
      })
      expect(openWorkflowPaths()).toEqual([workflowA.path])
      expect(store.activeWorkflow?.path).toBe(workflowA.path)
    })

    it('should do nothing when given an empty argument', async () => {
      await store.openWorkflow(workflowA)

      store.openWorkflowsInBackground({})
      expect(openWorkflowPaths()).toEqual([workflowA.path])

      store.openWorkflowsInBackground({ left: [], right: [] })
      expect(openWorkflowPaths()).toEqual([workflowA.path])

      expect(store.activeWorkflow?.path).toBe(workflowA.path)
    })
  })

  describe('renameWorkflow', () => {
    it('should rename workflow and update bookmarks', async () => {
      serveBookmarkIndex()
      const workflow = store.createTemporary('dir/test.json')

      expect(workflow.path).toBe('workflows/dir/test.json')
      await bookmarkStore.setBookmarked(workflow.path, true)
      expect(bookmarkStore.isBookmarked(workflow.path)).toBe(true)

      vi.spyOn(Object.getPrototypeOf(workflow), 'rename').mockImplementation(
        async function (this: unknown, ...args: unknown[]) {
          const newPath = args[0] as string
          ;(this as typeof workflow).path = newPath
          return this as typeof workflow
        }
      )

      const newPath = 'workflows/dir/renamed.json'
      await store.renameWorkflow(workflow, newPath)

      expect(bookmarkStore.isBookmarked(newPath)).toBe(true)
      expect(bookmarkStore.isBookmarked('workflows/dir/test.json')).toBe(false)
    })

    it('moves a bookmark this tab never loaded to the new path', async () => {
      const server = serveBookmarkIndex(['workflows/dir/test.json'])
      const workflow = store.createTemporary('dir/test.json')

      const moved = await store.renameWorkflow(
        workflow,
        'workflows/dir/renamed.json'
      )

      expect(moved).toBe(true)
      expect(server.favorites()).toEqual(['workflows/dir/renamed.json'])
      expect(bookmarkStore.isBookmarked('workflows/dir/renamed.json')).toBe(
        true
      )
    })

    it('distinguishes a completed rename with a refused bookmark save from a path collision', async () => {
      const server = serveBookmarkIndex(['workflows/original.json'])
      server.failWrites(500)
      const workflow = store.createTemporary('original.json')

      expect(
        await store.renameWorkflow(workflow, 'workflows/renamed.json')
      ).toBe('bookmarks-not-updated')

      expect(workflow.path).toBe('workflows/renamed.json')
      expect(store.getWorkflowByPath('workflows/renamed.json')?.key).toBe(
        workflow.key
      )
      expect(server.favorites()).toEqual(['workflows/original.json'])
    })

    it('refuses to rename onto a path another workflow holds', async () => {
      const first = store.createTemporary('First.json')
      const second = store.createTemporary('Second.json')
      store.openWorkflowsInBackground({ right: [first.path, second.path] })

      expect(await store.renameWorkflow(first, second.path)).toBe(false)

      expect(store.openWorkflows.map((workflow) => workflow.path)).toEqual([
        'workflows/First.json',
        'workflows/Second.json'
      ])
      expect(toRaw(store.openWorkflows[0])).toBe(toRaw(first))
      expect(toRaw(store.openWorkflows[1])).toBe(toRaw(second))
      expect(store.getWorkflowByPath('workflows/Second.json')?.key).toBe(
        second.key
      )
      expect(store.getWorkflowByPath('workflows/First.json')).not.toBeNull()
    })

    it('lets a tab take a path whose holder is already moving away', async () => {
      const first = store.createTemporary('First.json')
      const second = store.createTemporary('Second.json')
      store.openWorkflowsInBackground({ right: [first.path, second.path] })

      const results = await Promise.all([
        store.renameWorkflow(second, 'workflows/Third.json'),
        store.renameWorkflow(first, 'workflows/Second.json')
      ])

      expect(results).toEqual([true, true])
      expect(store.openWorkflows.map((workflow) => workflow.path)).toEqual([
        'workflows/Second.json',
        'workflows/Third.json'
      ])
    })

    it('keeps a tab that takes the old path of a saved holder whose rename is still finishing', async () => {
      const first = store.createTemporary('First.json')
      const second = store.createTemporary('Second.json')
      store.openWorkflowsInBackground({ right: [first.path, second.path] })
      let finishServerMove: () => void = () => {}
      const serverMoveFinished = new Promise<void>((resolve) => {
        finishServerMove = resolve
      })
      vi.spyOn(second, 'rename').mockImplementation(async (newPath) => {
        second.path = newPath
        await serverMoveFinished
        return second
      })

      const holderRename = store.renameWorkflow(second, 'workflows/Third.json')
      const takerRename = store.renameWorkflow(first, 'workflows/Second.json')
      await nextTick()
      finishServerMove()

      expect(await Promise.all([holderRename, takerRename])).toEqual([
        true,
        true
      ])
      expect(store.openWorkflows.map((workflow) => workflow.path)).toEqual([
        'workflows/Second.json',
        'workflows/Third.json'
      ])
      expect(store.getWorkflowByPath('workflows/Second.json')?.key).toBe(
        first.key
      )
      expect(store.getWorkflowByPath('workflows/Third.json')?.key).toBe(
        second.key
      )
    })

    it('should move V2 draft when renaming workflow', async () => {
      const workflow = store.createTemporary('test.json')
      const oldPath = workflow.path
      const newPath = 'workflows/renamed.json'
      const draftStore = saveV2Draft(oldPath, {
        name: workflow.key,
        isTemporary: true
      })

      vi.spyOn(Object.getPrototypeOf(workflow), 'rename').mockImplementation(
        async function (this: unknown, ...args: unknown[]) {
          ;(this as typeof workflow).path = args[0] as string
          return this as typeof workflow
        }
      )

      await store.renameWorkflow(workflow, newPath)

      expect(draftStore.getDraft(oldPath)).toBeNull()
      expect(draftStore.getDraft(newPath)?.name).toBe('renamed.json')
    })

    it('should rename workflow without affecting bookmarks if not bookmarked', async () => {
      const workflow = store.createTemporary('test.json')

      // Verify not bookmarked initially
      expect(bookmarkStore.isBookmarked(workflow.path)).toBe(false)

      // Mock super.rename
      vi.spyOn(Object.getPrototypeOf(workflow), 'rename').mockImplementation(
        async function (this: unknown, ...args: unknown[]) {
          const newPath = args[0] as string
          ;(this as typeof workflow).path = newPath
          return this as typeof workflow
        }
      )

      // Perform rename
      const newName = 'renamed'
      await workflow.rename(newName)

      // Check that no bookmarks were affected
      expect(bookmarkStore.isBookmarked(workflow.path)).toBe(false)
      expect(bookmarkStore.isBookmarked('test.json')).toBe(false)
    })
  })

  describe('graph adoption', () => {
    it.for([
      { name: 'successful', remove: () => {} },
      {
        name: 'throwing',
        remove: () => {
          throw new Error('onRemoved failed')
        }
      }
    ])('keeps the replacement graph after $name cleanup', ({ remove }) => {
      const workflow = store.createTemporary('replacement.json')
      const first = new LGraph()
      const previous = new LGraphNode('previous')
      previous.onRemoved = vi.fn(remove)
      first.add(previous)
      const second = new LGraph()
      const retained = new LGraphNode('retained')
      second.add(retained)
      const clearFirst = vi.spyOn(first, 'clear')
      const clearSecond = vi.spyOn(second, 'clear')
      workflow.adoptGraph(first)

      expect(() => workflow.adoptGraph(second)).not.toThrow()
      workflow.adoptGraph(second)

      expect(workflow.graph).toBe(second)
      expect(second.nodes).toEqual([retained])
      expect(clearFirst).toHaveBeenCalledOnce()
      expect(clearSecond).not.toHaveBeenCalled()
      expect(previous.onRemoved).toHaveBeenCalledOnce()
    })
  })

  describe('closeWorkflow', () => {
    it('should close a workflow', async () => {
      const workflow = store.createTemporary('test.json')
      await store.openWorkflow(workflow)
      expect(store.isOpen(workflow)).toBe(true)
      expect(store.getWorkflowByPath(workflow.path)).not.toBeNull()
      await store.closeWorkflow(workflow)
      expect(store.isOpen(workflow)).toBe(false)
      expect(store.getWorkflowByPath(workflow.path)).toBeNull()
    })
    it('releases the graph a closed temporary workflow owned', async () => {
      const workflow = store.createTemporary('test.json')
      await store.openWorkflow(workflow)
      const graph = new LGraph()
      const clear = vi.spyOn(graph, 'clear')
      workflow.adoptGraph(graph)

      await store.closeWorkflow(workflow)

      expect(workflow.graph).toBeNull()
      expect(clear).toHaveBeenCalledOnce()
    })
    it('forgets a closed temporary workflow even when releasing its graph throws', async () => {
      const workflow = store.createTemporary('test.json')
      await store.openWorkflow(workflow)
      const graph = new LGraph()
      const node = new LGraphNode('throws on removal')
      node.onRemoved = () => {
        throw new Error('onRemoved failed')
      }
      graph.add(node)
      workflow.adoptGraph(graph)

      await expect(store.closeWorkflow(workflow)).resolves.toBeUndefined()

      expect(store.isOpen(workflow)).toBe(false)
      expect(store.getWorkflowByPath(workflow.path)).toBeNull()
    })
    it('marks a closed saved workflow unmodified even when releasing its graph throws', async () => {
      await syncRemoteWorkflows(['a.json'])
      const workflow = store.getWorkflowByPath('workflows/a.json')!
      vi.mocked(api.getUserData).mockResolvedValue(
        new Response(defaultGraphJSON, { status: 200 })
      )
      await store.openWorkflow(workflow)
      workflow.isModified = true
      const graph = new LGraph()
      const node = new LGraphNode('throws on removal')
      node.onRemoved = () => {
        throw new Error('onRemoved failed')
      }
      graph.add(node)
      workflow.adoptGraph(graph)

      await expect(store.closeWorkflow(workflow)).resolves.toBeUndefined()

      expect(store.isOpen(workflow)).toBe(false)
      expect(workflow.isModified).toBe(false)
    })
    it('detaches the graph before a node removal hook can throw during release', async () => {
      const workflow = store.createTemporary('test.json')
      await store.openWorkflow(workflow)
      const graph = new LGraph()
      const node = new LGraphNode('throws on removal')
      node.onRemoved = () => {
        throw new Error('onRemoved failed')
      }
      graph.add(node)
      workflow.adoptGraph(graph)

      expect(() => workflow.releaseGraph()).not.toThrow()

      expect(workflow.graph).toBeNull()
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'onRemoved failed' }),
        {
          surface: 'graph',
          errorType: 'failure_disposing_workflow_graph'
        }
      )
    })
    it('unloads workflow state and file content when a node removal hook throws', async () => {
      vi.mocked(api.getUserData).mockResolvedValue(
        new Response(defaultGraphJSON, { status: 200 })
      )
      const workflow = new ComfyWorkflow({
        path: 'workflows/test.json',
        modified: 100,
        size: 1
      })
      await workflow.load()
      workflow.activeMode = 'app'
      const graph = new LGraph()
      const node = new LGraphNode('throws on removal')
      const error = new Error('onRemoved failed')
      node.onRemoved = () => {
        throw error
      }
      graph.add(node)
      workflow.adoptGraph(graph)

      expect(workflow.isLoaded).toBe(true)
      expect(workflow.originalContent).toBe(defaultGraphJSON)

      expect(() => workflow.unload()).not.toThrow()

      expect({
        graph: workflow.graph,
        changeTracker: workflow.changeTracker,
        isLoaded: workflow.isLoaded,
        activeMode: workflow.activeMode,
        content: workflow.content,
        originalContent: workflow.originalContent
      }).toEqual({
        graph: null,
        changeTracker: null,
        isLoaded: false,
        activeMode: null,
        content: null,
        originalContent: null
      })
    })
    it('forgets the node histories of the closed workflow only', async () => {
      const workflow = store.createTemporary('test.json')
      await store.openWorkflow(workflow)
      const rootGraphId = workflow.activeState?.id
      assert(rootGraphId)
      const histories = useWidgetHistoryStore()
      const closed = {
        rootGraphId,
        widgetId: widgetId(rootGraphId, toNodeId(1), 'b')
      }
      const other = {
        rootGraphId: 'other',
        widgetId: widgetId('other', toNodeId(1), 'b')
      }
      histories.record(closed, [])
      histories.record(other, [])

      await store.closeWorkflow(workflow)

      expect(histories.canUndo(closed)).toBe(false)
      expect(histories.canUndo(other)).toBe(true)
    })
  })

  describe('deleteWorkflow', () => {
    it('should close and delete an open workflow', async () => {
      const workflow = store.createTemporary('test.json')

      // Mock the necessary methods
      vi.spyOn(workflow, 'delete').mockResolvedValue()

      // Open the workflow first
      await store.openWorkflow(workflow)

      // Delete the workflow
      await store.deleteWorkflow(workflow)

      // Verify workflow was closed and deleted
      expect(workflow.delete).toHaveBeenCalled()
    })

    it('should remove bookmark when deleting a bookmarked workflow', async () => {
      serveBookmarkIndex()
      const workflow = store.createTemporary('test.json')

      vi.spyOn(workflow, 'delete').mockResolvedValue()

      await bookmarkStore.setBookmarked(workflow.path, true)
      expect(bookmarkStore.isBookmarked(workflow.path)).toBe(true)

      await store.deleteWorkflow(workflow)

      expect(bookmarkStore.isBookmarked(workflow.path)).toBe(false)
    })

    it('removes a bookmark this tab never loaded when deleting the workflow', async () => {
      const server = serveBookmarkIndex([
        'workflows/test.json',
        'workflows/x.json'
      ])
      const workflow = store.createTemporary('test.json')

      const unbookmarked = await store.deleteWorkflow(workflow)

      expect(unbookmarked).toBe(true)
      expect(server.favorites()).toEqual(['workflows/x.json'])
    })

    it('should remove a deleted workflow without closing other tabs', async () => {
      const survivor = store.createTemporary('survivor.json')
      const doomed = store.createTemporary('doomed.json')
      vi.spyOn(doomed, 'delete').mockResolvedValue()
      await store.openWorkflow(survivor)
      await store.openWorkflow(doomed)
      expect(store.openWorkflows.map((w) => w.path)).toEqual([
        survivor.path,
        doomed.path
      ])

      await store.deleteWorkflow(doomed)

      expect(store.isOpen(doomed)).toBe(false)
      expect(store.openWorkflows.map((w) => w.path)).toEqual([survivor.path])
    })
  })

  describe('openWorkflows integrity', () => {
    it('should retain a missing active workflow until it becomes inactive', async () => {
      await syncRemoteWorkflows(['a.json', 'b.json'])
      vi.mocked(api.getUserData).mockImplementation(() =>
        Promise.resolve(new Response(defaultGraphJSON, { status: 200 }))
      )
      const survivor = store.getWorkflowByPath('workflows/a.json')!
      const removed = store.getWorkflowByPath('workflows/b.json')!
      await store.openWorkflow(survivor)
      await store.openWorkflow(removed)

      await syncRemoteWorkflows(['a.json'])

      expect(store.activeWorkflow).toBe(removed)
      expect(store.getWorkflowByPath(removed.path)).toBe(removed)
      expect(store.isOpen(removed)).toBe(true)
      expect(store.openWorkflows.map((w) => w.path)).toEqual([
        survivor.path,
        removed.path
      ])

      await store.openWorkflow(survivor)
      await syncRemoteWorkflows(['a.json'])

      expect(store.activeWorkflow).toBe(survivor)
      expect(store.getWorkflowByPath(removed.path)).toBeNull()
      expect(store.isOpen(removed)).toBe(false)
      expect(store.openWorkflows).toEqual([survivor])
    })

    it('should not expose open paths whose lookup record was removed', async () => {
      const workflow = store.createTemporary('orphan.json')
      await store.openWorkflow(workflow)
      vi.mocked(syncEntities).mockImplementationOnce(
        async (_dir, entityByPath) => {
          delete entityByPath[workflow.path]
        }
      )

      await store.syncWorkflows()

      expect(store.isOpen(workflow)).toBe(true)
      expect(store.openWorkflows).toEqual([])
    })

    it.for([
      { openOrder: ['orphan', 'alpha', 'beta'] },
      { openOrder: ['alpha', 'orphan', 'beta'] }
    ])(
      'should navigate and reorder tabs by their surviving index when opened as $openOrder',
      async ({ openOrder }) => {
        const workflows = Object.fromEntries(
          openOrder.map((name) => [name, store.createTemporary(`${name}.json`)])
        )
        for (const name of openOrder) await store.openWorkflow(workflows[name])
        await store.openWorkflow(workflows.alpha)
        vi.mocked(syncEntities).mockImplementationOnce(
          async (_dir, entityByPath) => {
            delete entityByPath[workflows.orphan.path]
          }
        )

        await store.syncWorkflows()

        expect(store.openedWorkflowIndexShift(1)?.path).toBe(
          workflows.beta.path
        )
        expect(store.openedWorkflowIndexShift(-1)?.path).toBe(
          workflows.beta.path
        )

        store.reorderWorkflows(0, 1)

        expect(store.openWorkflows.map((w) => w.path)).toEqual([
          workflows.beta.path,
          workflows.alpha.path
        ])
      }
    )
  })

  describe('save', () => {
    it.for([true, false])(
      'persists the current edits and updates the saved baseline when initially marked modified=%s',
      async (isModified) => {
        await syncRemoteWorkflows(['test.json'])
        const path = 'workflows/test.json'
        const workflow = store.getWorkflowByPath(path)
        assert.exists(workflow)
        const savedState = { ...defaultGraph, extra: { note: 'edited' } }
        const savedContent = JSON.stringify(savedState)
        workflow.changeTracker = createMockChangeTracker({
          workflow,
          activeState: savedState
        })
        workflow.isModified = isModified
        vi.mocked(api.storeUserData).mockResolvedValue(
          Response.json({ path, modified: 300, size: savedContent.length })
        )

        await workflow.save()

        expect(api.storeUserData).toHaveBeenCalledExactlyOnceWith(
          path,
          savedContent,
          expect.objectContaining({ overwrite: true })
        )
        expect(workflow.originalContent).toBe(savedContent)
        expect(workflow.initialState).toEqual(savedState)
        expect(workflow.isModified).toBe(false)
      }
    )

    it('restores edits made during a save even when the server timestamp is ahead', async () => {
      enableWorkflowPersistence()
      const path = 'workflows/test.json'
      await syncRemoteWorkflows(['test.json'])
      const workflow = store.getWorkflowByPath(path)
      assert.exists(workflow)
      const savedState = { ...defaultGraph, extra: { note: 'being saved' } }
      const editedState = { ...defaultGraph, extra: { note: 'new edit' } }
      const tracker = createMockChangeTracker({
        workflow,
        activeState: savedState
      })
      workflow.changeTracker = tracker
      workflow.isModified = true
      const modified = Date.now() + 60_000
      let finishSave = () => {}
      vi.mocked(api.storeUserData).mockReturnValueOnce(
        new Promise((resolve) => {
          finishSave = () => resolve(Response.json({ path, modified, size: 1 }))
        })
      )

      const saving = workflow.save()
      tracker.activeState = editedState
      saveV2Draft(path, { data: JSON.stringify(editedState) })
      finishSave()
      await saving

      vi.mocked(api.getUserData).mockResolvedValueOnce(
        Response.json(savedState)
      )
      const reopened = await new ComfyWorkflow({
        path,
        modified,
        size: 1
      }).load()
      expect(reopened.activeState.extra?.note).toBe('new edit')
      expect(reopened.isModified).toBe(true)
    })

    it('keeps the completed save and unsaved edits if local draft storage throws', async () => {
      enableWorkflowPersistence()
      const path = 'workflows/test.json'
      await syncRemoteWorkflows(['test.json'])
      const workflow = store.getWorkflowByPath(path)
      assert.exists(workflow)
      const savedState = { ...defaultGraph, extra: { note: 'being saved' } }
      const editedState = { ...defaultGraph, extra: { note: 'new edit' } }
      const tracker = createMockChangeTracker({
        workflow,
        activeState: savedState
      })
      workflow.changeTracker = tracker
      const saveDraft = vi
        .spyOn(useWorkflowDraftStoreV2(), 'saveDraft')
        .mockImplementation(() => {
          throw new DOMException('Storage unavailable', 'SecurityError')
        })
      vi.mocked(api.storeUserData).mockResolvedValueOnce(
        Response.json({ path, modified: 300, size: 1 })
      )

      const saving = workflow.save()
      tracker.activeState = editedState

      await expect(saving).resolves.toBe(workflow)
      expect(workflow.originalContent).toBe(JSON.stringify(savedState))
      expect(workflow.activeState).toEqual(editedState)
      expect(workflow.isModified).toBe(true)
      expect(saveDraft).toHaveBeenCalledOnce()
    })
  })

  describe('saveWorkflow', () => {
    it('shares one load with an open of the same workflow already in flight', async () => {
      await syncRemoteWorkflows(['a.json'])
      const workflow = store.getWorkflowByPath('workflows/a.json')!
      let finishFetch = () => {}
      vi.mocked(api.getUserData).mockReturnValue(
        new Promise((resolve) => {
          finishFetch = () => resolve(Response.json(defaultGraph))
        })
      )
      vi.mocked(api.storeUserData).mockResolvedValue(
        Response.json({ path: workflow.path, modified: 300, size: 2 })
      )

      const opening = workflow.load()
      const saving = store.saveWorkflow(workflow)
      finishFetch()
      const opened = await opening
      const tracker = opened.changeTracker
      await saving

      expect(api.getUserData).toHaveBeenCalledOnce()
      expect(workflow.changeTracker).toBe(tracker)
    })

    it('starts a fresh load after an unload instead of joining the stale one', async () => {
      await syncRemoteWorkflows(['a.json'])
      const workflow = store.getWorkflowByPath('workflows/a.json')!
      vi.mocked(api.getUserData).mockImplementation(async () =>
        Response.json(defaultGraph)
      )

      const stale = workflow.load()
      workflow.unload()
      const fresh = workflow.load()
      await Promise.all([stale, fresh])

      expect(api.getUserData).toHaveBeenCalledTimes(2)
    })

    it('loads a temporary workflow that was never opened before saving it', async () => {
      const content = { ...defaultGraph, extra: { note: 'from extension' } }
      const workflow = store.createTemporary('ext.json', content)
      expect(workflow.isLoaded).toBe(false)
      vi.mocked(api.storeUserData).mockResolvedValue(
        Response.json({ path: workflow.path, modified: 300, size: 2 })
      )

      await store.saveWorkflow(workflow)

      const stored = vi.mocked(api.storeUserData).mock.calls.at(-1)
      assert.exists(stored)
      expect(stored[0]).toBe('workflows/ext.json')
      expect(JSON.parse(stored[1] as string).extra).toEqual({
        note: 'from extension'
      })
      expect(workflow.isTemporary).toBe(false)
      expect(mockAssert).not.toHaveBeenCalledWith(
        false,
        'Workflow saved without an active state',
        expect.anything()
      )
    })

    it('loads a saved workflow that is not open before saving it', async () => {
      await syncRemoteWorkflows(['a.json'])
      const workflow = store.getWorkflowByPath('workflows/a.json')!
      vi.mocked(api.getUserData).mockResolvedValue(Response.json(defaultGraph))
      vi.mocked(api.storeUserData).mockResolvedValue(
        Response.json({ path: workflow.path, modified: 300, size: 2 })
      )

      await store.saveWorkflow(workflow)

      expect(workflow.isLoaded).toBe(true)
      expect(api.storeUserData).toHaveBeenCalledWith(
        'workflows/a.json',
        expect.any(String),
        expect.objectContaining({ overwrite: true })
      )
    })

    it('keeps refusing an active workflow that has no loaded content', async () => {
      await syncRemoteWorkflows(['a.json'])
      const workflow = store.getWorkflowByPath('workflows/a.json')!
      store.activeWorkflow = workflow as LoadedComfyWorkflow
      const load = vi.spyOn(workflow, 'load')

      await expect(store.saveWorkflow(workflow)).rejects.toThrow(
        /^Cannot save a workflow before it is loaded$/
      )
      expect(load).not.toHaveBeenCalled()
      expect(api.storeUserData).not.toHaveBeenCalled()
    })
  })

  describe('saveAs', () => {
    it('should save workflow to new path and reset modification state', async () => {
      await syncRemoteWorkflows(['test.json'])
      const workflow = store.getWorkflowByPath('workflows/test.json')!
      workflow.isModified = true

      workflow.changeTracker = createMockChangeTracker({
        workflow
      })
      vi.mocked(api.storeUserData).mockResolvedValue({
        status: 200,
        json: () =>
          Promise.resolve({
            path: 'workflows/new-test.json',
            modified: Date.now(),
            size: 2
          })
      } as Response)

      // Save the workflow with new path
      const newWorkflow = await workflow.saveAs('workflows/new-test.json')

      // Verify the content was updated
      expect(workflow.path).toBe('workflows/test.json')
      expect(workflow.isModified).toBe(true)

      expect(newWorkflow.path).toBe('workflows/new-test.json')
      expect(newWorkflow.content).toBe(
        JSON.stringify(workflow.changeTracker.activeState)
      )
      expect(newWorkflow.isModified).toBe(false)
    })
  })

  describe('Subgraphs', () => {
    beforeEach(async () => {
      const workflow = store.createTemporary('test-subgraph-workflow.json')
      await store.openWorkflow(workflow)
    })

    it('should handle an unsafe null canvas', async () => {
      vi.mocked(comfyApp).canvas = fromAny<typeof comfyApp.canvas, null>(null)

      store.updateActiveGraph()
      await nextTick()

      expect(store.isSubgraphActive).toBe(false)
      expect(store.activeSubgraph).toBeUndefined()
    })

    it('should correctly update state when the root graph is active', async () => {
      vi.mocked(comfyApp.canvas).subgraph = undefined

      store.updateActiveGraph()
      await nextTick()

      expect(store.isSubgraphActive).toBe(false)
      expect(store.activeSubgraph).toBeUndefined()
    })

    it('should correctly update state when a subgraph is active', async () => {
      const subgraph = createTestSubgraph({
        name: 'Level 2 Subgraph',
        rootGraph: comfyApp.rootGraph
      })
      vi.mocked(comfyApp.canvas).subgraph = subgraph

      store.updateActiveGraph()
      await nextTick()

      expect(store.isSubgraphActive).toBe(true)
      expect(store.activeSubgraph).toEqual(subgraph)
    })

    it('should update automatically when activeWorkflow changes', async () => {
      const initialSubgraph = createTestSubgraph({
        name: 'Initial Subgraph',
        rootGraph: comfyApp.rootGraph
      })
      vi.mocked(comfyApp.canvas).subgraph = initialSubgraph

      store.updateActiveGraph()
      await nextTick()

      expect(store.isSubgraphActive).toBe(true)
      expect(store.activeSubgraph).toEqual(initialSubgraph)

      const workflow2 = store.createTemporary('workflow2.json')
      vi.mocked(comfyApp.canvas).subgraph = undefined

      await store.openWorkflow(workflow2)
      await nextTick()

      expect(store.isSubgraphActive).toBe(false)
      expect(store.activeSubgraph).toBeUndefined()
    })
  })

  describe('NodeLocatorId conversions', () => {
    beforeEach(() => {
      const rootGraph = comfyApp.rootGraph
      const subgraph = createTestSubgraph({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        rootGraph
      })
      rootGraph.add(createTestSubgraphNode(subgraph, { id: 123 }))
      comfyApp.canvas.subgraph = subgraph
      store.activeSubgraph = subgraph
    })

    describe('nodeIdToNodeLocatorId', () => {
      it('should convert node ID to NodeLocatorId for subgraph nodes', () => {
        const result = store.nodeIdToNodeLocatorId(toNodeId(456))
        expect(result).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890:456')
      })

      it.for([
        { rawId: '', locatorId: '~root:' },
        {
          rawId: 'insert:0fbd38ecb13037d0b3b0ca78b8a20a5a:root:node:9',
          locatorId:
            '~root:insert%3A0fbd38ecb13037d0b3b0ca78b8a20a5a%3Aroot%3Anode%3A9'
        }
      ])(
        'should key root node id $rawId under $locatorId',
        ({ rawId, locatorId }) => {
          store.activeSubgraph = undefined
          const result = store.nodeIdToNodeLocatorId(toNodeId(rawId))

          expect(result).toBe(locatorId)
          expect(store.nodeLocatorIdToNodeId(result)).toBe(rawId)
        }
      )

      it('should use provided subgraph instead of active one', () => {
        const customSubgraphId = '11111111-2222-4333-8444-555555555555'
        const customSubgraph = createTestSubgraph({
          id: customSubgraphId
        })
        const result = store.nodeIdToNodeLocatorId(
          toNodeId(789),
          customSubgraph
        )
        expect(result).toBe(`${customSubgraphId}:789`)
      })

      it('should convert a subgraph with an unsafe missing root graph', () => {
        const customSubgraphId = '11111111-2222-4333-8444-555555555555'
        const customSubgraph = createTestSubgraph({ id: customSubgraphId })
        vi.spyOn(customSubgraph, 'rootGraph', 'get').mockReturnValue(
          fromAny<LGraph, undefined>(undefined)
        )

        const result = store.nodeIdToNodeLocatorId(
          toNodeId(789),
          customSubgraph
        )

        expect(result).toBe(`${customSubgraphId}:789`)
      })
    })

    describe('executionIdToCurrentId', () => {
      it('should convert an execution ID to the active subgraph node ID', () => {
        const result = store.executionIdToCurrentId('123:456')
        expect(result).toBe('456')
      })

      it('should return undefined for execution IDs outside the active subgraph', () => {
        expect(() => store.executionIdToCurrentId('999:456')).not.toThrow()
        expect(store.executionIdToCurrentId('999:456')).toBeUndefined()
      })

      it('should return undefined for malformed execution IDs', () => {
        expect(() => store.executionIdToCurrentId('123::456')).not.toThrow()
        expect(store.executionIdToCurrentId('123::456')).toBeUndefined()
      })
    })
    describe('nodeLocatorIdToNodeId', () => {
      it('should extract node ID from NodeLocatorId', () => {
        const result = store.nodeLocatorIdToNodeId(
          createNodeLocatorId(
            'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            toNodeId(456)
          )
        )
        expect(result).toBe(toNodeId(456))
      })

      it('should handle string node IDs', () => {
        const result = store.nodeLocatorIdToNodeId(
          createNodeLocatorId(
            'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            toNodeId('node_1')
          )
        )
        expect(result).toBe('node_1')
      })

      it('should handle simple node IDs (root graph)', () => {
        const result = store.nodeLocatorIdToNodeId(
          createNodeLocatorId(null, toNodeId(123))
        )
        expect(result).toBe(toNodeId(123))

        const stringResult = store.nodeLocatorIdToNodeId(
          createNodeLocatorId(null, toNodeId('node_1'))
        )
        expect(stringResult).toBe('node_1')
      })

      it('should decode an encoded root-leaf locator to its node id', () => {
        const locatorId = createNodeLocatorId(
          null,
          'insert:0fbd38ecb13037d0b3b0ca78b8a20a5a:root:node:9'
        )
        const result = store.nodeLocatorIdToNodeId(locatorId)
        expect(result).toBe(
          'insert:0fbd38ecb13037d0b3b0ca78b8a20a5a:root:node:9'
        )
      })

      it('should return null for an unparseable locator', () => {
        const locatorId = fromAny<NodeLocatorId, string>(
          '~subgraph:not-a-uuid:5'
        )

        expect(store.nodeLocatorIdToNodeId(locatorId)).toBeNull()
      })
    })

    describe('nodeLocatorIdToNodeExecutionId', () => {
      it('should convert NodeLocatorId to execution ID', () => {
        const result = store.nodeLocatorIdToNodeExecutionId(
          createNodeLocatorId(
            'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            toNodeId(456)
          )
        )
        expect(result).toBe('123:456')
      })

      it('should handle simple node IDs (root graph)', () => {
        const result = store.nodeLocatorIdToNodeExecutionId(
          createNodeLocatorId(null, toNodeId(123))
        )
        expect(result).toBe('123')
      })

      it('should return null for unknown subgraph UUID', () => {
        const result = store.nodeLocatorIdToNodeExecutionId(
          createNodeLocatorId(
            '99999999-8888-4777-8666-555555555555',
            toNodeId(456)
          )
        )
        expect(result).toBeNull()
      })

      it('should return null for an unparseable locator', () => {
        const locatorId = fromAny<NodeLocatorId, string>(
          '~subgraph:not-a-uuid:5'
        )

        expect(store.nodeLocatorIdToNodeExecutionId(locatorId)).toBeNull()
      })

      it('should mint a leaf execution id from an encoded root-leaf locator', () => {
        const locatorId = createNodeLocatorId(
          null,
          'insert:0fbd38ecb13037d0b3b0ca78b8a20a5a:root:node:9'
        )
        const result = store.nodeLocatorIdToNodeExecutionId(locatorId)
        expect(result).toBe(
          'insert:0fbd38ecb13037d0b3b0ca78b8a20a5a:root:node:9'
        )
      })

      it('should append an encoded subgraph leaf to its execution path', () => {
        const locatorId = createNodeLocatorId(
          'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          'insert:abc123:root:node:5'
        )

        const result = store.nodeLocatorIdToNodeExecutionId(locatorId)

        expect(result).toBe('123:insert:abc123:root:node:5')
      })

      it('should preserve a colon-bearing subgraph host in the execution path', () => {
        const subgraphUuid = '11111111-2222-4333-8444-555555555555'
        const rootGraph = createTestRootGraph()
        const subgraph = createTestSubgraph({
          id: subgraphUuid,
          rootGraph
        })
        rootGraph.add(
          createTestSubgraphNode(subgraph, { id: 'insert:op:root:node:3' })
        )
        vi.mocked(comfyApp).rootGraph = rootGraph

        expect(
          store.nodeLocatorIdToNodeExecutionId(
            createNodeLocatorId(subgraphUuid, toNodeId(7))
          )
        ).toBe('insert:op:root:node:3:7')
      })
    })
  })

  describe('Tab Activation History', () => {
    let workflowA: ComfyWorkflow
    let workflowB: ComfyWorkflow
    let workflowC: ComfyWorkflow

    beforeEach(async () => {
      await syncRemoteWorkflows(['a.json', 'b.json', 'c.json'])
      workflowA = store.getWorkflowByPath('workflows/a.json')!
      workflowB = store.getWorkflowByPath('workflows/b.json')!
      workflowC = store.getWorkflowByPath('workflows/c.json')!
      vi.mocked(api.getUserData).mockResolvedValue({
        status: 200,
        text: () => Promise.resolve(defaultGraphJSON)
      } as Response)
    })

    it('should return most recently active workflow', async () => {
      // Open workflows in order: A -> B -> C
      await store.openWorkflow(workflowA)
      await store.openWorkflow(workflowB)
      await store.openWorkflow(workflowC)

      // C is current, B should be most recent
      const mostRecent = store.getMostRecentWorkflow()
      expect(mostRecent?.path).toBe(workflowB.path)
    })

    it('should skip closed workflows (lazy cleanup)', async () => {
      // Open workflows: A -> B -> C
      await store.openWorkflow(workflowA)
      await store.openWorkflow(workflowB)
      await store.openWorkflow(workflowC)

      // Close B (the most recent before C)
      await store.closeWorkflow(workflowB)

      // C is current, B is closed, so A should be returned
      const mostRecent = store.getMostRecentWorkflow()
      expect(mostRecent?.path).toBe(workflowA.path)
    })

    it('should return null when no valid history exists', async () => {
      // Open only one workflow
      await store.openWorkflow(workflowA)

      // No previous workflows, should return null
      const mostRecent = store.getMostRecentWorkflow()
      expect(mostRecent).toBeNull()
    })

    it('should track history when opening workflows', async () => {
      // Open A, then B, then A again
      await store.openWorkflow(workflowA)
      await store.openWorkflow(workflowB)
      await store.openWorkflow(workflowA)

      // A is current, B should be most recent
      const mostRecent = store.getMostRecentWorkflow()
      expect(mostRecent?.path).toBe(workflowB.path)
    })

    it('should handle workflow activated multiple times', async () => {
      // Open: A -> B -> A -> C
      await store.openWorkflow(workflowA)
      await store.openWorkflow(workflowB)
      await store.openWorkflow(workflowA)
      await store.openWorkflow(workflowC)

      // C is current, A should be most recent (not B)
      const mostRecent = store.getMostRecentWorkflow()
      expect(mostRecent?.path).toBe(workflowA.path)
    })

    it('should clean up history when all previous workflows are closed', async () => {
      // Open: A -> B -> C
      await store.openWorkflow(workflowA)
      await store.openWorkflow(workflowB)
      await store.openWorkflow(workflowC)

      // Close A and B
      await store.closeWorkflow(workflowA)
      await store.closeWorkflow(workflowB)

      // C is current, no valid history
      const mostRecent = store.getMostRecentWorkflow()
      expect(mostRecent).toBeNull()
    })
  })

  describe('closeWorkflow draft cleanup', () => {
    it('should remove draft for persisted workflows on close', async () => {
      await syncRemoteWorkflows(['a.json'])
      const workflow = store.getWorkflowByPath('workflows/a.json')!
      const draftStore = saveV2Draft('workflows/a.json', {
        name: 'a.json',
        isTemporary: false
      })
      expect(draftStore.getDraft('workflows/a.json')).toBeTruthy()

      await store.closeWorkflow(workflow)

      expect(draftStore.getDraft('workflows/a.json')).toBeNull()
    })

    it('clears the modified mark of a closed persisted workflow so a bulk save skips it', async () => {
      await syncRemoteWorkflows(['a.json'])
      const workflow = store.getWorkflowByPath('workflows/a.json')!
      vi.mocked(api.getUserData).mockResolvedValue({
        status: 200,
        text: () => Promise.resolve(defaultGraphJSON)
      } as Response)
      await workflow.load()
      workflow.isModified = true

      await store.closeWorkflow(workflow)

      expect(workflow.isLoaded).toBe(false)
      expect(workflow.isModified).toBe(false)
      expect(store.modifiedWorkflows).not.toContain(workflow)
    })

    it('should remove draft for temporary workflows on close', async () => {
      const workflow = store.createTemporary('temp.json')
      const draftStore = saveV2Draft(workflow.path, {
        name: 'temp.json',
        isTemporary: true
      })
      expect(draftStore.getDraft(workflow.path)).toBeTruthy()

      await store.closeWorkflow(workflow)

      expect(draftStore.getDraft(workflow.path)).toBeNull()
    })
  })

  describe('null-state hardening', () => {
    const storedAs = (content: string) =>
      vi.mocked(api.getUserData).mockResolvedValue({
        status: 200,
        text: () => Promise.resolve(content)
      } as Response)

    const failedAssertions = () =>
      mockAssert.mock.calls.filter(([condition]) => !condition)

    const expectReported = (message: string, context: object) =>
      expect(mockAssert).toHaveBeenCalledWith(
        false,
        message,
        expect.objectContaining(context)
      )

    beforeEach(() => {
      resetReportedWorkflowStateAnomaliesForTests()
    })

    describe('load', () => {
      it.for(['null', '42', '"text"', '[]'])(
        'rejects stored content %s',
        async (content) => {
          await syncRemoteWorkflows(['a.json'])
          const workflow = store.getWorkflowByPath('workflows/a.json')!
          storedAs(content)

          await expect(workflow.load()).rejects.toThrow('not a JSON object')

          expect(workflow.isLoaded).toBe(false)
          expect(workflow.changeTracker).toBeNull()
        }
      )

      // The production crashes (CLOUD-FRONTEND-PROD-2Z2/-2Z3) had a tracker
      // with a null initial state and a draft as its active state: a stored
      // `null` overlaid by a newer draft.
      it('rejects stored null even when a newer draft exists, and keeps the draft', async () => {
        enableWorkflowPersistence()
        await syncRemoteWorkflowsWithMeta([
          { path: 'a.json', modified: 100, size: 1 }
        ])
        const workflow = store.getWorkflowByPath('workflows/a.json')!
        const draftStore = saveV2Draft(workflow.path, {
          data: defaultGraphJSON,
          name: 'a.json'
        })
        storedAs('null')

        await expect(workflow.load()).rejects.toThrow('not a JSON object')

        expect(workflow.changeTracker).toBeNull()
        expect(workflow.initialState).toBeNull()
        expect(workflow.activeState).toBeNull()
        expect(draftStore.getDraft(workflow.path)?.data).toBe(defaultGraphJSON)
      })

      it('reports the kind of content without including the path', async () => {
        await syncRemoteWorkflows(['secret-name.json'])
        const workflow = store.getWorkflowByPath('workflows/secret-name.json')!
        storedAs('null')

        await expect(workflow.load()).rejects.toThrow()

        expectReported('Workflow content is not a JSON object', {
          method: 'ComfyWorkflow.load',
          isLoaded: false,
          hasChangeTracker: false,
          hasInitialState: false,
          hasActiveState: false,
          isPersisted: true,
          isTemporary: false,
          originalContentKind: 'null'
        })
        expect(JSON.stringify(mockAssert.mock.calls)).not.toContain(
          'secret-name'
        )
      })

      it('rejects with a typed error whose message does not include the path', async () => {
        await syncRemoteWorkflows(['secret-name.json'])
        const workflow = store.getWorkflowByPath('workflows/secret-name.json')!
        storedAs('null')

        const error: unknown = await workflow.load().catch((e: unknown) => e)

        expect(error).toBeInstanceOf(UnreadableWorkflowError)
        expect((error as UnreadableWorkflowError).reason).toBe('not-object')
        expect((error as UnreadableWorkflowError).workflowPath).toBe(
          'workflows/secret-name.json'
        )
        expect((error as Error).message).not.toContain('secret-name')
      })

      it.for(['', '   '])(
        'rejects empty stored content %j with a typed error and reports it',
        async (content) => {
          await syncRemoteWorkflows(['a.json'])
          const workflow = store.getWorkflowByPath('workflows/a.json')!
          storedAs(content)

          const error: unknown = await workflow.load().catch((e: unknown) => e)

          expect(error).toBeInstanceOf(UnreadableWorkflowError)
          expect((error as UnreadableWorkflowError).reason).toBe('empty')
          expectReported('Workflow content is missing or empty', {
            method: 'ComfyWorkflow.load',
            isPersisted: true
          })
        }
      )

      it('keeps the typed error when the anomaly assertion throws in development', async () => {
        mockAssert.mockImplementation((condition: unknown, message: string) => {
          if (!condition) throw new Error(message)
        })
        await syncRemoteWorkflows(['a.json'])
        const workflow = store.getWorkflowByPath('workflows/a.json')!
        storedAs('null')

        await expect(workflow.load()).rejects.toBeInstanceOf(
          UnreadableWorkflowError
        )
      })

      it('does not leave a tab behind when opening unreadable content', async () => {
        await syncRemoteWorkflows(['a.json'])
        const workflow = store.getWorkflowByPath('workflows/a.json')!
        storedAs('null')

        await expect(store.openWorkflow(workflow)).rejects.toBeInstanceOf(
          UnreadableWorkflowError
        )

        expect(store.openWorkflows).not.toContain(workflow)
      })

      it('does not report content that is a JSON object', async () => {
        await syncRemoteWorkflows(['a.json'])
        const workflow = store.getWorkflowByPath('workflows/a.json')!
        storedAs(defaultGraphJSON)

        await workflow.load()

        expect(workflow.isLoaded).toBe(true)
        expect(failedAssertions()).toHaveLength(0)
      })

      it.for([
        '[object Object]',
        'undefined',
        '{"nodes":[],',
        'Workflow content is not a JSON object'
      ])('rejects stored content %j as unparseable', async (content) => {
        await syncRemoteWorkflows(['a.json'])
        const workflow = store.getWorkflowByPath('workflows/a.json')!
        storedAs(content)

        const error: unknown = await workflow.load().catch((e: unknown) => e)

        expect(error).toBeInstanceOf(UnreadableWorkflowError)
        expect((error as UnreadableWorkflowError).reason).toBe('unparseable')
        expect(workflow.isLoaded).toBe(false)
        expect(workflow.changeTracker).toBeNull()
      })

      it('reports unparseable content with a static message and no content', async () => {
        await syncRemoteWorkflows(['secret-name.json'])
        const workflow = store.getWorkflowByPath('workflows/secret-name.json')!
        storedAs('[object Object]')

        await expect(workflow.load()).rejects.toThrow('not valid JSON')

        expectReported('Workflow content is not valid JSON', {
          method: 'ComfyWorkflow.load',
          isPersisted: true,
          originalContentKind: 'unparseable'
        })
        const reported = JSON.stringify(mockAssert.mock.calls)
        expect(reported).not.toContain('secret-name')
        expect(reported).not.toContain('[object Object]')
      })

      it('keeps the typed error when the anomaly assertion throws on unparseable content', async () => {
        mockAssert.mockImplementation((condition: unknown, message: string) => {
          if (!condition) throw new Error(message)
        })
        await syncRemoteWorkflows(['a.json'])
        const workflow = store.getWorkflowByPath('workflows/a.json')!
        storedAs('[object Object]')

        await expect(workflow.load()).rejects.toBeInstanceOf(
          UnreadableWorkflowError
        )
      })
    })

    describe.for(['save', 'saveAs'] as const)('%s', (method) => {
      it('refuses to persist an unloaded workflow and reports it', async () => {
        await syncRemoteWorkflows(['a.json'])
        const workflow = store.getWorkflowByPath('workflows/a.json')!
        const contentBefore = workflow.content

        const attempt =
          method === 'save'
            ? workflow.save()
            : workflow.saveAs('workflows/copy.json')

        await expect(attempt).rejects.toThrow(
          /^Cannot save a workflow before it is loaded$/
        )
        expect(api.storeUserData).not.toHaveBeenCalled()
        expect(workflow.content).toBe(contentBefore)
        expectReported('Workflow saved without an active state', {
          method: `ComfyWorkflow.${method}`,
          isLoaded: false,
          hasChangeTracker: false,
          hasActiveState: false
        })
      })
    })

    describe('openWorkflow', () => {
      it('loads a workflow that is active but was never loaded', async () => {
        await syncRemoteWorkflows(['a.json'])
        const workflow = store.getWorkflowByPath('workflows/a.json')!
        store.activeWorkflow = workflow as LoadedComfyWorkflow
        storedAs(defaultGraphJSON)

        const opened = await store.openWorkflow(workflow)

        expect(opened.isLoaded).toBe(true)
        expect(opened.initialState).toEqual(defaultGraph)
        expectReported(
          'openWorkflow called on an active workflow that is not loaded',
          {
            method: 'workflowStore.openWorkflow',
            isActive: true,
            isLoaded: false,
            hasInitialState: false
          }
        )
      })

      it('reports each affected workflow only once', async () => {
        await syncRemoteWorkflows(['a.json'])
        const workflow = store.getWorkflowByPath('workflows/a.json')!
        storedAs(defaultGraphJSON)

        for (let attempt = 0; attempt < 2; attempt++) {
          workflow.unload()
          store.activeWorkflow = workflow as LoadedComfyWorkflow
          await store.openWorkflow(workflow)
        }

        expect(failedAssertions()).toHaveLength(1)
      })

      it('does not report an active workflow that is loaded', async () => {
        const workflow = await store.createTemporary('test.json').load()
        store.activeWorkflow = workflow

        await store.openWorkflow(workflow)

        expect(failedAssertions()).toHaveLength(0)
      })

      it('reports a never-loaded temporary workflow that aliases the active path', async () => {
        const activeByPath = await store.createTemporary('aliased.json').load()
        const neverLoaded = store.createTemporary('aliased.json')
        neverLoaded.updatePath(activeByPath.path)
        store.activeWorkflow = activeByPath

        const opened = await store.openWorkflow(neverLoaded)

        expectReported(
          'openWorkflow called on an active workflow that is not loaded',
          {
            method: 'workflowStore.openWorkflow',
            isActive: true,
            isLoaded: false,
            hasChangeTracker: false,
            hasInitialState: false,
            hasActiveState: false,
            isPersisted: false,
            isTemporary: true,
            originalContentKind: 'object'
          }
        )
        expect(opened).toBe(neverLoaded)
        expect(opened.isLoaded).toBe(true)
      })
    })
  })
})

describe('useWorkflowBookmarkStore', () => {
  const x = 'workflows/x.json'
  const y = 'workflows/y.json'
  const p = 'workflows/photo.json'
  const q = 'workflows/portrait.json'

  it.for([
    {
      name: 'its copy is out of date',
      arrange: async (
        store: ReturnType<typeof useWorkflowBookmarkStore>,
        server: ReturnType<typeof serveBookmarkIndex>
      ) => {
        server.saveElsewhere([x])
        await store.loadBookmarks()
        server.saveElsewhere([x, y])
      }
    },
    {
      name: 'it never loaded them',
      arrange: async () => {}
    },
    {
      name: 'loading them failed',
      arrange: async (
        store: ReturnType<typeof useWorkflowBookmarkStore>,
        server: ReturnType<typeof serveBookmarkIndex>
      ) => {
        server.failNextRead(503)
        await store.loadBookmarks()
      }
    }
  ])(
    'keeps bookmarks saved elsewhere when this tab adds one and $name',
    async ({ arrange }) => {
      const server = serveBookmarkIndex([x, y], { sortOrder: 'name' })
      const store = useWorkflowBookmarkStore()
      await arrange(store, server)

      await store.setBookmarked(p, true)

      expect(server.index()).toEqual({
        sortOrder: 'name',
        favorites: [x, y, p]
      })
    }
  )

  it.for(['[]', 'null', '42'])(
    'reads a saved index of %s as no bookmarks and replaces it on the next change',
    async (content) => {
      const server = serveBookmarkIndex()
      server.storeContent(content)
      const store = useWorkflowBookmarkStore()

      const moved = await store.moveBookmark(x, y)
      const added = await store.setBookmarked(p, true)

      expect({ moved, added }).toEqual({ moved: true, added: true })
      expect(server.index()).toEqual({ favorites: [p] })
    }
  )

  it.for([
    { name: 'answers with an error status', failure: 503 },
    {
      name: 'answers with malformed JSON',
      failure: { malformedBody: '{"favorites": [' }
    },
    { name: 'cannot be reached', failure: new TypeError('Failed to fetch') }
  ] satisfies { name: string; failure: BookmarkReadFailure }[])(
    'refuses a change and reports it when reading the saved bookmarks first $name',
    async ({ failure }) => {
      const server = serveBookmarkIndex([x, y])
      const store = useWorkflowBookmarkStore()
      server.failNextRead(failure)

      const saved = await store.toggleBookmarked(p)

      expect(saved).toBe(false)
      expect(store.isBookmarked(p)).toBe(false)
      expect(server.favorites()).toEqual([x, y])
      expect(api.storeUserData).not.toHaveBeenCalled()
      expect(useToast().toasts).toEqual([
        expect.objectContaining({ kind: 'error' })
      ])
      expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.any(Error), {
        errorType: 'failure_loading_workflow_bookmarks',
        surface: 'platform'
      })
    }
  )

  it('keeps a bookmark another tab added when this tab removes one', async () => {
    const server = serveBookmarkIndex([x])
    const store = useWorkflowBookmarkStore()
    await store.loadBookmarks()
    server.saveElsewhere([x, p])

    await store.setBookmarked(x, false)

    expect(server.favorites()).toEqual([p])
    expect(store.isBookmarked(p)).toBe(true)
  })

  it.for([
    {
      name: 'answers with an error status',
      failure: 500,
      bookmarkReports: []
    },
    {
      name: 'cannot be reached',
      failure: new TypeError('Failed to fetch'),
      bookmarkReports: [
        [
          expect.any(TypeError),
          {
            errorType: 'failure_saving_workflow_bookmarks',
            surface: 'platform'
          }
        ]
      ]
    }
  ])(
    'shows the bookmark as unset, keeps the others and resolves false when the server $name',
    async ({ failure, bookmarkReports }) => {
      const server = serveBookmarkIndex([x])
      const store = useWorkflowBookmarkStore()
      await store.loadBookmarks()
      server.saveElsewhere([x, y])
      server.failWrites(failure)

      const saved = await store.toggleBookmarked(p)

      expect(saved).toBe(false)
      expect(store.isBookmarked(p)).toBe(false)
      expect(store.isBookmarked(x)).toBe(true)
      expect(store.isBookmarked(y)).toBe(true)
      expect(useToast().toasts).toEqual([
        expect.objectContaining({ kind: 'error' })
      ])
      expect(vi.mocked(reportError).mock.calls).toEqual(bookmarkReports)
    }
  )

  it('shows a bookmark as set while its save is in flight', async () => {
    const server = serveBookmarkIndex([x])
    const store = useWorkflowBookmarkStore()
    server.holdWrites()

    const saving = store.setBookmarked(p, true)
    await server.writeHeld()

    expect(store.isBookmarked(p)).toBe(true)
    await server.deliverOldestWrite()
    expect(await saving).toBe(true)
    expect(store.isBookmarked(p)).toBe(true)
  })

  it('shows and saves the last of two rapid toggles of one bookmark', async () => {
    const server = serveBookmarkIndex([x])
    const store = useWorkflowBookmarkStore()
    await store.loadBookmarks()
    server.holdWrites()

    const add = store.toggleBookmarked(p)
    const remove = store.toggleBookmarked(p)
    await server.deliverOldestWrite()
    await add

    expect(store.isBookmarked(p)).toBe(false)
    await server.deliverOldestWrite()
    await remove
    expect(server.favorites()).toEqual([x])
    expect(store.isBookmarked(p)).toBe(false)
  })

  it('saves rapid bookmark clicks in order when requests can overtake each other', async () => {
    const server = serveBookmarkIndex([x])
    const store = useWorkflowBookmarkStore()
    await store.loadBookmarks()
    server.holdWrites()

    const first = store.setBookmarked(p, true)
    const second = store.setBookmarked(q, true)
    await server.deliverNewestFirst([first, second])

    expect(server.favorites()).toEqual([x, p, q])
  })
})
