import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fromAny } from '@total-typescript/shoehorn'
import { nextTick } from 'vue'

import {
  onDocumentPhase,
  resetDocumentLifecycleForTest
} from '@/platform/nodeApi/documentLifecycle'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'

import { installDocumentLifecycleBridge } from './documentLifecycleBridge'

const workflow = (name: string, session: string | null): ComfyWorkflow => {
  const document = new ComfyWorkflow({
    path: `workflows/${name}.json`,
    modified: 0,
    size: 0
  })
  document.sessionId = session
  return document
}

/** Names seen for a phase, in the order announced. */
function record(phase: Parameters<typeof onDocumentPhase>[0]): string[] {
  const seen: string[] = []
  onDocumentPhase(phase, (document) => seen.push(document.id))
  return seen
}

describe('document lifecycle bridge', () => {
  let stop: (() => void) | undefined
  let store: ReturnType<typeof useWorkflowStore>

  beforeEach(() => {
    resetDocumentLifecycleForTest()
    store = useWorkflowStore()
  })

  // Unconditionally, not at the end of each test: a bridge left installed by a
  // failing assertion keeps watching the shared store and reports the next
  // test's setup as that test's transitions.
  afterEach(() => {
    stop?.()
    stop = undefined
  })

  /**
   * Installs the bridge and lets any watcher callback queued by the setup above
   * drain, so a test only observes the transitions it makes itself.
   */
  const start = async () => {
    stop = installDocumentLifecycleBridge()
    await nextTick()
  }

  it('announces a document opening and becoming active', async () => {
    await start()
    const opened = record('opened')
    const activated = record('activated')

    const a = workflow('portrait', 'session-a')
    store.attachWorkflow(a, 0)
    store.activeWorkflow = fromAny(a)
    await nextTick()

    expect(opened).toEqual(['session-a'])
    expect(activated).toEqual(['session-a'])
  })

  it('does not activate a tab opened in the background', async () => {
    // Opening and being on screen are separate, so a pack that allocates on
    // open and releases on close stays balanced however the user navigates.
    await start()
    const opened = record('opened')
    const activated = record('activated')

    store.attachWorkflow(workflow('background', 'session-b'), 0)
    await nextTick()

    expect(opened).toEqual(['session-b'])
    expect(activated).toEqual([])
  })

  it('deactivates the outgoing document before activating the incoming one', async () => {
    const a = workflow('portrait', 'session-a')
    const b = workflow('landscape', 'session-b')
    store.attachWorkflow(a, 0)
    store.attachWorkflow(b, 1)
    store.activeWorkflow = fromAny(a)
    await start()

    const order: string[] = []
    onDocumentPhase('deactivated', (d) => order.push(`out:${d.id}`))
    onDocumentPhase('activated', (d) => order.push(`in:${d.id}`))

    store.activeWorkflow = fromAny(b)
    await nextTick()

    // Never two documents claiming the screen at once.
    expect(order).toEqual(['out:session-a', 'in:session-b'])
  })

  it('announces a close when a tab is shut', async () => {
    const a = workflow('portrait', 'session-a')
    store.attachWorkflow(a, 0)
    store.activeWorkflow = fromAny(a)
    await start()
    const closed = record('closed')

    await store.closeWorkflow(a)
    store.activeWorkflow = null
    await nextTick()

    expect(closed).toEqual(['session-a'])
  })

  it('announces a close when the host unloads a background tab', async () => {
    // syncWorkflows drops a background tab whose file changed on disk,
    // destroying its undo history with no event of its own. Watching the live
    // session set catches it anyway — the session id is gone either way.
    const a = workflow('portrait', 'session-a')
    const b = workflow('stale', 'session-b')
    store.attachWorkflow(a, 0)
    store.attachWorkflow(b, 1)
    store.activeWorkflow = fromAny(a)
    await start()
    const closed = record('closed')

    // Through the store, not the object literal: only the reactive proxy
    // notifies, and mutating the raw object silently observes nothing.
    store.openWorkflows[1].sessionId = null
    await nextTick()

    expect(closed).toEqual(['session-b'])
  })

  it('says nothing when a document is merely edited', async () => {
    const a = workflow('portrait', 'session-a')
    store.attachWorkflow(a, 0)
    store.activeWorkflow = fromAny(a)
    await start()
    const opened = record('opened')
    const closed = record('closed')
    const activated = record('activated')

    store.openWorkflows[0].isModified = true
    await nextTick()

    // Editing is not a transition. This is the distinction the whole model
    // exists for: undo and redo reconfigure the graph without replacing the
    // document, and must not read as a swap.
    expect([...opened, ...closed, ...activated]).toEqual([])
  })
})
