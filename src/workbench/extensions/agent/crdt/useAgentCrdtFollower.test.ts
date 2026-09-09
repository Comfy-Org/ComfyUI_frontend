// @vitest-environment jsdom
import { createTestingPinia } from '@pinia/testing'
import { render } from '@testing-library/vue'
import { initDoc, metaMap, nodesMap } from '@comfyorg/comfy-multi-player'
import { setActivePinia } from 'pinia'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import * as Y from 'yjs'

import { LGraph } from '@/lib/litegraph/src/LGraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'

import { DOC_PROTOCOL_VERSION, encodeBase64 } from './docFrameClient'
import { OPAQUE_WIDGETS_KEY } from './docSchema'

const TEST_NODE_TYPE = 'MarkdownNote'
const WORKFLOW_ID = 'wf-a'
const ORIGINAL_NOTE = 'Enable multi-image input'
const UPDATED_NOTE = 'Preserve this exact text after tab switching.'

const appMock = vi.hoisted(() => ({
  graph: null as LGraph | null,
  get rootGraph() {
    return this.graph!
  },
  registerExtension: vi.fn()
}))
const apiMock = vi.hoisted(() => {
  const listeners = new Map<string, Set<EventListener>>()
  const send = vi.fn()
  const addEventListener = (type: string, listener: EventListener) => {
    const registered = listeners.get(type) ?? new Set<EventListener>()
    registered.add(listener)
    listeners.set(type, registered)
  }
  const removeEventListener = (type: string, listener: EventListener) => {
    listeners.get(type)?.delete(listener)
  }
  return {
    api: {
      socket: { readyState: 1, send },
      addCustomEventListener: addEventListener,
      removeCustomEventListener: removeEventListener,
      addEventListener,
      removeEventListener
    },
    clear() {
      listeners.clear()
      send.mockClear()
    },
    emit(type: string, detail: unknown) {
      const event = new CustomEvent(type, { detail })
      for (const listener of listeners.get(type) ?? []) listener(event)
    },
    send
  }
})

vi.mock('@/scripts/app', () => ({ app: appMock }))
vi.mock('@/scripts/api', () => ({ api: apiMock.api }))
vi.mock('./devPanelLog', () => ({ recordDevEvent: vi.fn() }))

await import('@/extensions/core/noteNode')
type TestExtension = {
  name?: string
  registerCustomNodes?: () => void
}
const noteNodeExtension = appMock.registerExtension.mock.calls
  .map(([extension]) => extension as TestExtension)
  .find((extension) => extension.name === 'Comfy.NoteNode')
if (!noteNodeExtension)
  throw new Error('Comfy.NoteNode was not registered on import')

window.history.replaceState({}, '', '/?agentCrdtFollower=1')
const { DOC_ID_SESSION_KEY, useAgentCrdtFollower } =
  await import('./useAgentCrdtFollower')

function addHostNode(
  doc: Y.Doc,
  id: number,
  text = '',
  type = TEST_NODE_TYPE
): void {
  const node = new Y.Map<unknown>()
  node.set('type', type)
  node.set('pos', [id * 100, 40])
  node.set(OPAQUE_WIDGETS_KEY, [text])
  nodesMap(doc).set(String(id), node)
}

function updateHostNote(doc: Y.Doc, id: number, text: string): void {
  nodesMap(doc).get(String(id))?.set(OPAQUE_WIDGETS_KEY, [text])
}

function createMarkdownNote() {
  const node = LiteGraph.createNode(TEST_NODE_TYPE)
  if (!node) throw new Error('MarkdownNote was not registered')
  return node
}

function deliverDoc(doc: Y.Doc, seq: number): void {
  apiMock.emit('doc_update', {
    v: DOC_PROTOCOL_VERSION,
    workflow_id: WORKFLOW_ID,
    seq,
    update_b64: encodeBase64(Y.encodeStateAsUpdate(doc))
  })
}

describe('useAgentCrdtFollower projection ownership', () => {
  const registeredTypes: string[] = []

  beforeAll(() => {
    const types = ['Note', TEST_NODE_TYPE]
    const existing = new Set(
      types.filter((type) => LiteGraph.registered_node_types[type])
    )
    noteNodeExtension.registerCustomNodes?.()
    registeredTypes.push(
      ...types.filter(
        (type) => !existing.has(type) && LiteGraph.registered_node_types[type]
      )
    )
  })

  afterAll(() => {
    for (const type of registeredTypes) LiteGraph.unregisterNodeType(type)
  })

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    apiMock.clear()
    sessionStorage.clear()
    window.history.replaceState({}, '', '/?agentCrdtFollower=1')
    appMock.graph = new LGraph()
  })

  it('projects a persisted workflow before the draft binding restores', async () => {
    sessionStorage.setItem(DOC_ID_SESSION_KEY, WORKFLOW_ID)
    const workflowId = ref<string | null>(null)
    const projectionWorkflowId = ref<string | null>(null)
    let follower!: ReturnType<typeof useAgentCrdtFollower>
    const wrapper = render(
      defineComponent({
        setup() {
          follower = useAgentCrdtFollower(
            workflowId,
            projectionWorkflowId,
            () => undefined
          )
          return () => h('div')
        }
      })
    )
    const hostDoc = initDoc(new Y.Doc())
    expect(follower.status.value).toMatchObject({
      enabled: true,
      workflowId: WORKFLOW_ID
    })
    expect(apiMock.send).toHaveBeenCalled()
    projectionWorkflowId.value = WORKFLOW_ID
    await nextTick()
    addHostNode(hostDoc, 1, ORIGINAL_NOTE)
    deliverDoc(hostDoc, 1)
    expect(workflowId.value).toBeNull()
    expect(follower.status.value.updatesApplied).toBe(1)
    expect(appMock.graph?._nodes).toHaveLength(1)

    projectionWorkflowId.value = null
    await nextTick()
    const otherGraph = new LGraph()
    appMock.graph = otherGraph
    const otherNode = createMarkdownNote()
    otherNode.id = toNodeId(9)
    otherNode.title = 'Other workflow'
    otherGraph.add(otherNode)
    appMock.graph = otherGraph
    updateHostNote(hostDoc, 1, UPDATED_NOTE)
    addHostNode(hostDoc, 2, 'Other note')
    deliverDoc(hostDoc, 2)

    expect(follower.status.value.workflowId).toBe(WORKFLOW_ID)
    expect(otherGraph._nodes).toEqual([otherNode])

    const restoredGraph = new LGraph()
    appMock.graph = restoredGraph
    const restoredNode = createMarkdownNote()
    restoredNode.id = toNodeId(1)
    restoredNode.title = 'Nano Banana 2'
    restoredNode.has_errors = false
    restoredGraph.add(restoredNode)
    restoredNode.widgets![0].value = ORIGINAL_NOTE
    appMock.graph = restoredGraph
    projectionWorkflowId.value = WORKFLOW_ID
    await nextTick()

    expect(restoredGraph._nodes).toHaveLength(2)
    expect(restoredGraph.getNodeById(toNodeId(1))).toBe(restoredNode)
    expect(restoredNode.title).toBe('Nano Banana 2')
    expect(restoredNode.has_errors).toBe(false)
    expect(restoredNode.strokeStyles.error.call(restoredNode)).toBeUndefined()
    expect(restoredNode.widgets![0]).toMatchObject({
      name: 'text',
      type: 'MARKDOWN',
      value: UPDATED_NOTE
    })
    expect(restoredNode.serialize()).toMatchObject({
      type: TEST_NODE_TYPE,
      widgets_values: [UPDATED_NOTE],
      widgets_values_named: { text: UPDATED_NOTE }
    })
    wrapper.unmount()
  })

  it.for([
    ['without reconnect', false],
    ['after reconnect', true]
  ])(
    'reconciles the exact canvas after a same-workflow doc reset %s',
    async ([_label, reconnect]) => {
      sessionStorage.setItem(DOC_ID_SESSION_KEY, WORKFLOW_ID)
      const workflowId = ref<string | null>(WORKFLOW_ID)
      const projectionWorkflowId = ref<string | null>(WORKFLOW_ID)
      const wrapper = render(
        defineComponent({
          setup() {
            useAgentCrdtFollower(
              workflowId,
              projectionWorkflowId,
              () => undefined
            )
            return () => h('div')
          }
        })
      )
      const originalDoc = initDoc(new Y.Doc())
      addHostNode(originalDoc, 1, ORIGINAL_NOTE)
      addHostNode(originalDoc, 2, 'Removed by reset')
      addHostNode(originalDoc, 3, 'Replaced by reset')
      deliverDoc(originalDoc, 1)

      const retained = appMock.graph!.getNodeById(toNodeId(1))!
      const replaced = appMock.graph!.getNodeById(toNodeId(3))!
      retained.title = 'Retained presentation'
      retained.has_errors = false

      projectionWorkflowId.value = null
      await nextTick()
      if (reconnect) apiMock.emit('reconnected', {})
      apiMock.emit('doc_reset', {
        v: DOC_PROTOCOL_VERSION,
        workflow_id: WORKFLOW_ID,
        seq: 2
      })
      projectionWorkflowId.value = WORKFLOW_ID
      await nextTick()

      expect(appMock.graph!._nodes).toHaveLength(3)
      expect(appMock.graph!.getNodeById(toNodeId(1))).toBe(retained)
      expect(appMock.graph!.getNodeById(toNodeId(3))).toBe(replaced)

      const replacementDoc = initDoc(new Y.Doc())
      addHostNode(replacementDoc, 1, UPDATED_NOTE)
      addHostNode(replacementDoc, 3, 'New note type', 'Note')
      deliverDoc(replacementDoc, 3)

      expect(appMock.graph!._nodes.map((node) => node.id)).toEqual([
        toNodeId(1),
        toNodeId(3)
      ])
      expect(appMock.graph!.getNodeById(toNodeId(1))).toBe(retained)
      expect(retained.title).toBe('Retained presentation')
      expect(retained.has_errors).toBe(false)
      expect(retained.widgets![0].value).toBe(UPDATED_NOTE)
      expect(appMock.graph!.getNodeById(toNodeId(2))).toBeUndefined()
      expect(appMock.graph!.getNodeById(toNodeId(3))).not.toBe(replaced)
      expect(appMock.graph!.getNodeById(toNodeId(3))?.type).toBe('Note')
      wrapper.unmount()
    }
  )

  it('waits for reconnect catch-up before projecting queued updates', async () => {
    sessionStorage.setItem(DOC_ID_SESSION_KEY, WORKFLOW_ID)
    const workflowId = ref<string | null>(WORKFLOW_ID)
    const projectionWorkflowId = ref<string | null>(WORKFLOW_ID)
    const wrapper = render(
      defineComponent({
        setup() {
          useAgentCrdtFollower(
            workflowId,
            projectionWorkflowId,
            () => undefined
          )
          return () => h('div')
        }
      })
    )
    const hostDoc = initDoc(new Y.Doc())
    addHostNode(hostDoc, 1, ORIGINAL_NOTE)
    deliverDoc(hostDoc, 1)
    const retained = appMock.graph!.getNodeById(toNodeId(1))!

    projectionWorkflowId.value = null
    await nextTick()
    updateHostNote(hostDoc, 1, UPDATED_NOTE)
    deliverDoc(hostDoc, 2)
    apiMock.emit('reconnected', {})
    projectionWorkflowId.value = WORKFLOW_ID
    await nextTick()

    expect(appMock.graph!.getNodeById(toNodeId(1))).toBe(retained)
    expect(retained.widgets![0].value).toBe(ORIGINAL_NOTE)

    deliverDoc(hostDoc, 3)

    expect(appMock.graph!.getNodeById(toNodeId(1))).toBe(retained)
    expect(retained.widgets![0].value).toBe(UPDATED_NOTE)
    wrapper.unmount()
  })

  it('does not project a rejected reset lineage when its tab becomes active', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    sessionStorage.setItem(DOC_ID_SESSION_KEY, WORKFLOW_ID)
    const workflowId = ref<string | null>(WORKFLOW_ID)
    const projectionWorkflowId = ref<string | null>(WORKFLOW_ID)
    let follower!: ReturnType<typeof useAgentCrdtFollower>
    const wrapper = render(
      defineComponent({
        setup() {
          follower = useAgentCrdtFollower(
            workflowId,
            projectionWorkflowId,
            () => undefined
          )
          return () => h('div')
        }
      })
    )
    const originalDoc = initDoc(new Y.Doc())
    addHostNode(originalDoc, 1, ORIGINAL_NOTE)
    deliverDoc(originalDoc, 1)
    const retained = appMock.graph!.getNodeById(toNodeId(1))!

    projectionWorkflowId.value = null
    await nextTick()
    apiMock.emit('doc_reset', {
      v: DOC_PROTOCOL_VERSION,
      workflow_id: WORKFLOW_ID,
      seq: 2
    })
    const rejectedDoc = initDoc(new Y.Doc())
    metaMap(rejectedDoc).set('schema_version', 2)
    addHostNode(rejectedDoc, 1, UPDATED_NOTE)
    deliverDoc(rejectedDoc, 3)
    projectionWorkflowId.value = WORKFLOW_ID
    await nextTick()

    expect(follower.status.value.lastFrameType).toBe('schema_error')
    expect(appMock.graph!.getNodeById(toNodeId(1))).toBe(retained)
    expect(retained.widgets![0].value).toBe(ORIGINAL_NOTE)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
    wrapper.unmount()
  })

  it('binds a fresh active target before subscribing and projecting', async () => {
    const workflowId = ref<string | null>(null)
    const projectionWorkflowId = ref<string | null>(null)
    let follower!: ReturnType<typeof useAgentCrdtFollower>
    const wrapper = render(
      defineComponent({
        setup() {
          follower = useAgentCrdtFollower(
            workflowId,
            projectionWorkflowId,
            (id) => {
              workflowId.value = id
              projectionWorkflowId.value = id
            }
          )
          return () => h('div')
        }
      })
    )

    const poc = (window as unknown as Record<string, unknown>)
      .__agentCrdtPoc as { bindDoc: (id: string) => void }
    poc.bindDoc(WORKFLOW_ID)
    await nextTick()

    const hostDoc = initDoc(new Y.Doc())
    addHostNode(hostDoc, 1)
    deliverDoc(hostDoc, 1)
    expect(follower.status.value).toMatchObject({
      workflowId: WORKFLOW_ID,
      updatesApplied: 1
    })
    expect(appMock.graph?._nodes).toHaveLength(1)
    wrapper.unmount()
  })
})
