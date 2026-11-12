import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useOpenDocuments } from '@/platform/workflow/management/openDocuments'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import '@/scripts/changeTracker'
import { defaultGraphJSON } from '@/scripts/defaultGraph'

vi.mock(import('@/scripts/api'))

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    canvas: {},
    get canvasOrUndefined() {
      return this.canvas
    }
  }
}))

describe('open documents', () => {
  let store: ReturnType<typeof useWorkflowStore>
  let read: ReturnType<typeof useOpenDocuments>

  beforeEach(() => {
    store = useWorkflowStore()
    read = useOpenDocuments()
  })

  it('describes each open workflow and marks the one on screen', async () => {
    const first = store.createTemporary('first.json')
    const second = store.createTemporary('second.json')
    await store.openWorkflow(first)
    await store.openWorkflow(second)

    expect(read()).toEqual([
      {
        sessionId: expect.any(String),
        name: 'first',
        path: first.path,
        isModified: false,
        isActive: false
      },
      {
        sessionId: expect.any(String),
        name: 'second',
        path: second.path,
        isModified: false,
        isActive: true
      }
    ])
  })

  it('keeps a workflow on one session through tab switches and edits', async () => {
    const first = store.createTemporary('first.json')
    const second = store.createTemporary('second.json')
    await store.openWorkflow(first)
    const [{ sessionId }] = read()

    await store.openWorkflow(second)
    await store.openWorkflow(first)
    first.isModified = true

    expect(read()[0]).toMatchObject({
      sessionId,
      isActive: true,
      isModified: true
    })
    expect(read()[1].sessionId).not.toBe(sessionId)
  })

  it('starts a new session when a closed workflow is opened again', async () => {
    vi.mocked(api.listUserDataFullInfo).mockResolvedValue([
      { path: 'saved.json', modified: 100, size: 1 }
    ])
    vi.mocked(api.getUserData).mockImplementation(
      async () => new Response(defaultGraphJSON, { status: 200 })
    )
    await store.syncWorkflows()
    const saved = store.getWorkflowByPath('workflows/saved.json')!
    const other = store.createTemporary('other.json')
    await store.openWorkflow(saved)
    const [{ sessionId }] = read()

    await store.openWorkflow(other)
    await store.closeWorkflow(saved)
    await store.openWorkflow(saved)

    const reopened = read().find(({ path }) => path === saved.path)
    expect(reopened?.sessionId).toEqual(expect.any(String))
    expect(reopened?.sessionId).not.toBe(sessionId)
  })
})
