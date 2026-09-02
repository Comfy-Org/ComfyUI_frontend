import { describe, expect, it, vi } from 'vitest'

import { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useGraphDocumentStore } from '@/stores/graphDocumentStore'

vi.mock('@/scripts/api', () => ({
  api: {
    getUserData: vi.fn(),
    storeUserData: vi.fn(),
    dispatchCustomEvent: vi.fn()
  }
}))

vi.mock('@/platform/workflow/persistence/stores/workflowDraftStoreV2', () => ({
  useWorkflowDraftStoreV2: vi.fn(() => ({
    getDraft: vi.fn(() => undefined),
    markDraftUsed: vi.fn(),
    removeDraft: vi.fn()
  }))
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn(() => false)
  }))
}))

vi.mock('@/scripts/app', () => ({
  app: {
    graph: {},
    rootGraph: { serialize: vi.fn(() => ({ nodes: [], links: [] })) },
    loadGraphData: vi.fn(() => Promise.resolve()),
    canvas: { ds: { scale: 1, offset: [0, 0] } },
    ui: { autoQueueEnabled: false, autoQueueMode: 'instant' }
  }
}))

// `ComfyWorkflow.load()` dynamically imports `changeTracker`, which in turn
// imports these stores. They are unused by the save/document-identity
// behavior under test here, but mirror changeTracker.test.ts's mocks so the
// dynamic import resolves without dragging in their real (DOM/app-bound)
// implementations.
vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: vi.fn(() => ({}))
}))
vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: vi.fn(() => ({
    snapshotOutputs: vi.fn(() => ({})),
    restoreOutputs: vi.fn()
  }))
}))
vi.mock('@/stores/subgraphNavigationStore', () => ({
  useSubgraphNavigationStore: vi.fn(() => ({
    exportState: vi.fn(() => []),
    restoreState: vi.fn()
  }))
}))

function mockLoadResponse(content: string) {
  vi.mocked(api.getUserData).mockResolvedValue({
    status: 200,
    text: () => Promise.resolve(content)
  } as never)
}

function mockSaveResponse() {
  vi.mocked(api.storeUserData).mockResolvedValue({
    json: () => Promise.resolve('workflows/test.json')
  } as never)
}

async function createLoadedWorkflow(path = 'workflows/test.json') {
  const workflow = new ComfyWorkflow({ path, modified: 0, size: 10 })
  mockLoadResponse(JSON.stringify({ nodes: [], links: [] }))
  await workflow.load()
  return workflow
}

// `load()`'s dynamic `import('@/scripts/changeTracker')` pulls in the
// litegraph module graph; vitest's on-demand transform of that graph is slow
// (not hung) the first time it runs inside a test body rather than at static
// import/collection time, so these tests need a generous timeout.
const LOAD_TIMEOUT = 30_000

describe('ComfyWorkflow document identity (ADR-0024)', () => {
  it(
    'mints a local-only document id on load',
    async () => {
      const workflow = await createLoadedWorkflow()
      expect(workflow.documentId).not.toBeNull()

      const store = useGraphDocumentStore()
      const entry = store.getDocument(workflow.documentId!)
      expect(entry).not.toBeNull()
      expect(entry?.workflowId).toBeNull()
      expect(store.persistenceStateOf(workflow.documentId!)).toBe('unsaved')
    },
    LOAD_TIMEOUT
  )

  it(
    'reuses the same document id across a re-entrant load',
    async () => {
      const workflow = await createLoadedWorkflow()
      const firstId = workflow.documentId
      mockLoadResponse(JSON.stringify({ nodes: [], links: [] }))
      await workflow.load({ force: true })
      expect(workflow.documentId).toBe(firstId)
    },
    LOAD_TIMEOUT
  )

  it(
    'keeps the same document id across unload (no closer exists yet)',
    async () => {
      const workflow = await createLoadedWorkflow()
      const firstId = workflow.documentId
      workflow.unload()
      // unload() does not clear documentId — the registry entry for the old
      // load is left standing until an explicit close, matching the
      // create-on-load/no-close-yet lifecycle documented on the field.
      expect(workflow.documentId).toBe(firstId)
    },
    LOAD_TIMEOUT
  )

  it(
    'advances the document from unsaved to clean at the exact saved revision',
    async () => {
      const workflow = await createLoadedWorkflow()
      const store = useGraphDocumentStore()
      const documentId = workflow.documentId!
      expect(store.persistenceStateOf(documentId)).toBe('unsaved')

      mockSaveResponse()
      await workflow.save()

      expect(store.persistenceStateOf(documentId)).toBe('clean')
    },
    LOAD_TIMEOUT
  )

  it(
    'reports dirty for a mutation committed after the last save',
    async () => {
      const workflow = await createLoadedWorkflow()
      const store = useGraphDocumentStore()
      const documentId = workflow.documentId!

      mockSaveResponse()
      await workflow.save()
      expect(store.persistenceStateOf(documentId)).toBe('clean')

      store.markMutated(documentId)
      expect(store.persistenceStateOf(documentId)).toBe('dirty')
    },
    LOAD_TIMEOUT
  )

  it(
    'leaves the document dirty when a mutation commits mid-save',
    async () => {
      const workflow = await createLoadedWorkflow()
      useWorkflowStore().attachWorkflow(workflow)
      const store = useGraphDocumentStore()
      const documentId = workflow.documentId!

      // Establish a saved baseline first so a later revision divergence can
      // actually be observed as 'dirty' rather than 'unsaved'.
      mockSaveResponse()
      await workflow.save()

      // storeUserData resolves only after a mutation commits against the
      // same document, simulating a concurrent edit racing the in-flight
      // save.
      let resolveSave!: (value: { json: () => Promise<string> }) => void
      vi.mocked(api.storeUserData).mockReturnValue(
        new Promise((resolve) => {
          resolveSave = resolve
        }) as never
      )

      const savePromise = workflow.save()
      const previousState = workflow.changeTracker!.activeState
      workflow.changeTracker!.activeState = {
        ...previousState,
        nodes: [
          {
            id: 1,
            type: 'KSampler',
            pos: [0, 0],
            size: [100, 100],
            flags: {},
            order: 0,
            mode: 0,
            inputs: [],
            outputs: [],
            properties: {}
          }
        ]
      }
      workflow.changeTracker!.updateModified(previousState)
      resolveSave({ json: () => Promise.resolve('workflows/test.json') })
      await savePromise

      expect(api.storeUserData).toHaveBeenCalledWith(
        workflow.path,
        JSON.stringify(previousState),
        expect.anything()
      )
      expect(store.persistenceStateOf(documentId)).toBe('dirty')
    },
    LOAD_TIMEOUT
  )
})
