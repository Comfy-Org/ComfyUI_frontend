import { describe, expect, it, vi } from 'vitest'

import { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import type { ComfyApi } from '@/scripts/api'
import type { ComfyApp } from '@/scripts/app'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowDraftStoreV2 } from '@/platform/workflow/persistence/stores/workflowDraftStoreV2'
import { useGraphDocumentStore } from '@/stores/graphDocumentStore'

vi.mock(import('@/scripts/api'), async () => {
  const { fromPartial } = await import('@total-typescript/shoehorn')
  return {
    api: fromPartial<ComfyApi>({
      getUserData: vi.fn(),
      storeUserData: vi.fn(),
      dispatchCustomEvent: vi.fn()
    })
  }
})

vi.mock(import('@/scripts/app'), async () => {
  const { fromPartial } = await import('@total-typescript/shoehorn')
  return {
    app: fromPartial<ComfyApp>({
      graph: {},
      rootGraph: { serialize: vi.fn(() => ({ nodes: [], links: [] })) },
      loadGraphData: vi.fn(() => Promise.resolve()),
      canvas: { ds: { scale: 1, offset: [0, 0] } },
      ui: { autoQueueEnabled: false, autoQueueMode: 'instant' }
    })
  }
})

await import('@/scripts/changeTracker')

function mockLoadResponse(content: string) {
  vi.mocked(api.getUserData).mockResolvedValue(
    new Response(content, { status: 200 })
  )
}

function mockSaveResponse() {
  vi.mocked(api.storeUserData).mockResolvedValue(
    new Response(JSON.stringify('workflows/test.json'))
  )
}

async function createLoadedWorkflow(
  path = 'workflows/test.json'
): Promise<LoadedComfyWorkflow> {
  const workflow = new ComfyWorkflow({ path, modified: 0, size: 10 })
  mockLoadResponse(JSON.stringify({ nodes: [], links: [] }))
  return workflow.load()
}

function documentIdOf(workflow: LoadedComfyWorkflow) {
  const documentId = workflow.documentId
  if (documentId === null) throw new Error('workflow has no document id')
  return documentId
}

function deferred<T>() {
  let resolvePromise: ((value: T) => void) | null = null
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })
  return {
    promise,
    resolve(value: T) {
      if (resolvePromise === null)
        throw new Error('deferred is not initialized')
      resolvePromise(value)
    }
  }
}

describe('ComfyWorkflow document identity (ADR-GRAPH-DOCUMENT-0024)', () => {
  it('mints a clean local-only document id for persisted content', async () => {
    const workflow = await createLoadedWorkflow()
    expect(workflow.documentId).not.toBeNull()

    const store = useGraphDocumentStore()
    const documentId = documentIdOf(workflow)
    const entry = store.getDocument(documentId)
    expect(entry).not.toBeNull()
    expect(entry?.workflowId).toBeNull()
    expect(store.persistenceStateOf(documentId)).toBe('clean')
  })

  it('reuses the same document id across a re-entrant load', async () => {
    const workflow = await createLoadedWorkflow()
    const firstId = workflow.documentId
    mockLoadResponse(JSON.stringify({ nodes: [], links: [] }))
    await workflow.load({ force: true })
    expect(workflow.documentId).toBe(firstId)
  })

  it('rebaselines a dirty document after a forced remote reload', async () => {
    const workflow = await createLoadedWorkflow()
    const store = useGraphDocumentStore()
    const documentId = documentIdOf(workflow)
    expect(store.markMutated(documentId)).toBe(true)
    expect(store.persistenceStateOf(documentId)).toBe('dirty')

    mockLoadResponse(JSON.stringify({ nodes: [], links: [], version: 2 }))
    await workflow.load({ force: true })

    expect(store.persistenceStateOf(documentId)).toBe('clean')
  })

  it('keeps the same document id across unload (no closer exists yet)', async () => {
    const workflow = await createLoadedWorkflow()
    const firstId = workflow.documentId
    workflow.unload()
    // unload() does not clear documentId — the registry entry for the old
    // load is left standing until an explicit close, matching the
    // create-on-load/no-close-yet lifecycle documented on the field.
    expect(workflow.documentId).toBe(firstId)
  })

  it('marks a restored draft dirty against the persisted baseline', async () => {
    const draftState = { nodes: [], links: [], version: 1 }
    vi.mocked(useSettingStore().get).mockReturnValueOnce(true)
    vi.mocked(useWorkflowDraftStoreV2().getDraft).mockReturnValueOnce({
      data: JSON.stringify(draftState),
      name: 'test',
      isTemporary: false,
      updatedAt: 1
    })

    const workflow = await createLoadedWorkflow()
    const store = useGraphDocumentStore()

    expect(store.persistenceStateOf(documentIdOf(workflow))).toBe('dirty')
  })

  it('keeps the persisted document clean when saving its current revision', async () => {
    const workflow = await createLoadedWorkflow()
    const store = useGraphDocumentStore()
    const documentId = documentIdOf(workflow)
    expect(store.persistenceStateOf(documentId)).toBe('clean')

    mockSaveResponse()
    await workflow.save()

    expect(store.persistenceStateOf(documentId)).toBe('clean')
  })

  it('reports dirty for a mutation committed after the last save', async () => {
    const workflow = await createLoadedWorkflow()
    const store = useGraphDocumentStore()
    const documentId = documentIdOf(workflow)

    mockSaveResponse()
    await workflow.save()
    expect(store.persistenceStateOf(documentId)).toBe('clean')

    store.markMutated(documentId)
    expect(store.persistenceStateOf(documentId)).toBe('dirty')
  })

  it('leaves the document dirty when a mutation commits mid-save', async () => {
    const workflow = await createLoadedWorkflow()
    useWorkflowStore().attachWorkflow(workflow)
    const store = useGraphDocumentStore()
    const documentId = documentIdOf(workflow)

    // Establish a saved baseline first so a later revision divergence can
    // actually be observed as 'dirty' rather than 'unsaved'.
    mockSaveResponse()
    await workflow.save()

    // storeUserData resolves only after a mutation commits against the
    // same document, simulating a concurrent edit racing the in-flight
    // save.
    const save = deferred<Response>()
    vi.mocked(api.storeUserData).mockReturnValue(save.promise)

    const savePromise = workflow.save()
    const previousState = workflow.changeTracker.activeState
    workflow.changeTracker.activeState = {
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
    workflow.changeTracker.updateModified(previousState)
    save.resolve(new Response(JSON.stringify('workflows/test.json')))
    await savePromise

    expect(api.storeUserData).toHaveBeenCalledWith(
      workflow.path,
      JSON.stringify(previousState),
      expect.anything()
    )
    expect(store.persistenceStateOf(documentId)).toBe('dirty')
  })
})
