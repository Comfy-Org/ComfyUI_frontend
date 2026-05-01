import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, shallowRef } from 'vue'

import type { LGraph, LGraphNode, LLink } from '@/lib/litegraph/src/litegraph'
import { graphInteractionHooks } from '@/renderer/core/canvas/hooks/graphInteractionHooks'
import type { LinkId, NodeId } from '@/renderer/core/layout/types'

import { useDropOnLink } from './useDropOnLink'

type TestNodeId = NodeId

const fixtures = vi.hoisted(() => {
  const links = new Map<number, unknown>()
  const nodesById = new Map<string, unknown>()
  const queryLinkAtPoint = vi.fn<
    (point: { x: number; y: number }) => number | null
  >(() => null)
  const isValidConnection = vi.fn<(a: unknown, b: unknown) => boolean>(
    (a, b) => a === b || a === '*' || b === '*'
  )
  const beforeChange = vi.fn()
  const afterChange = vi.fn()
  const setDirty = vi.fn()
  const graph = {
    _links: links,
    beforeChange,
    afterChange,
    getNodeById: (id: string) => nodesById.get(id) ?? null
  }
  const canvas = {
    highlighted_links: {} as Record<string | number, boolean>,
    setDirty,
    graph,
    ctx: undefined
  }
  return {
    links,
    nodesById,
    queryLinkAtPoint,
    isValidConnection,
    beforeChange,
    afterChange,
    setDirty,
    graph,
    canvas
  }
})

const {
  links,
  nodesById,
  queryLinkAtPoint,
  isValidConnection,
  beforeChange,
  afterChange,
  setDirty,
  canvas
} = fixtures as unknown as {
  links: Map<LinkId, LLink>
  nodesById: Map<NodeId, LGraphNode>
  queryLinkAtPoint: ReturnType<typeof vi.fn>
  isValidConnection: ReturnType<typeof vi.fn>
  beforeChange: ReturnType<typeof vi.fn>
  afterChange: ReturnType<typeof vi.fn>
  setDirty: ReturnType<typeof vi.fn>
  canvas: {
    highlighted_links: Record<string | number, boolean>
    setDirty: ReturnType<typeof vi.fn>
    graph: LGraph
    ctx: undefined
  }
}

vi.mock('@/scripts/app', () => ({
  app: { canvas: fixtures.canvas }
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ canvas: fixtures.canvas })
}))

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: { queryLinkAtPoint: fixtures.queryLinkAtPoint }
}))

vi.mock('@/lib/litegraph/src/litegraph', () => ({
  LiteGraph: {
    isValidConnection: (a: unknown, b: unknown) =>
      fixtures.isValidConnection(a, b)
  }
}))

const nodeManager = shallowRef({
  getNode: (id: NodeId) => nodesById.get(id) ?? null
})

vi.mock('@/composables/graph/useVueNodeLifecycle', () => ({
  useVueNodeLifecycle: () => ({ nodeManager })
}))

interface TestNode {
  id: TestNodeId
  inputs: { type: string; link: LinkId | null }[]
  outputs: { type: string; links: LinkId[] | null }[]
  connect: ReturnType<typeof vi.fn>
  disconnectInput: ReturnType<typeof vi.fn>
}

function makeNode(partial: Partial<TestNode> & { id: TestNodeId }): LGraphNode {
  const node: TestNode = {
    inputs: [],
    outputs: [],
    connect: vi.fn(() => null),
    disconnectInput: vi.fn(() => true),
    ...partial
  }
  nodesById.set(node.id, node as unknown as LGraphNode)
  return node as unknown as LGraphNode
}

function makeLink(
  id: LinkId,
  origin_id: TestNodeId,
  target_id: TestNodeId,
  type: string
): LLink {
  const link = fromPartial<LLink>({
    id,
    origin_id,
    origin_slot: 0,
    target_id,
    target_slot: 0,
    type
  })
  links.set(id, link)
  return link
}

let scope: ReturnType<typeof effectScope> | null = null

beforeEach(() => {
  links.clear()
  nodesById.clear()
  graphInteractionHooks.clear()
  canvas.highlighted_links = {}
  beforeChange.mockClear()
  afterChange.mockClear()
  setDirty.mockClear()
  queryLinkAtPoint.mockReset()
  queryLinkAtPoint.mockReturnValue(null)
  isValidConnection.mockClear()
  isValidConnection.mockImplementation(
    (a, b) => a === b || a === '*' || b === '*'
  )
})

afterEach(() => {
  scope?.stop()
  scope = null
})

function startComposable(): { hoveredLinkId: { value: LinkId | null } } {
  scope = effectScope()
  const api = scope.run(() => useDropOnLink())
  if (!api) throw new Error('useDropOnLink returned undefined')
  return api
}

function emitMove(nodeId: string | number) {
  graphInteractionHooks.emit('nodeDragMove', {
    nodeId: String(nodeId),
    canvasPos: { x: 100, y: 100 },
    pointerEvent: new PointerEvent('pointermove'),
    selectionSize: 1
  })
}

function emitEnd(nodeId: string | number) {
  graphInteractionHooks.emit('nodeDragEnd', {
    nodeId: String(nodeId),
    canvasPos: { x: 100, y: 100 },
    pointerEvent: new PointerEvent('pointerup'),
    selectionSize: 1
  })
}

describe('useDropOnLink', () => {
  it('does nothing when no link is under the pointer', async () => {
    makeNode({
      id: 'dragged',
      inputs: [{ type: 'IMAGE', link: null }],
      outputs: [{ type: 'IMAGE', links: null }]
    })
    queryLinkAtPoint.mockReturnValue(null)

    const api = startComposable()
    emitMove('dragged')

    expect(api.hoveredLinkId.value).toBeNull()
    expect(canvas.highlighted_links).toEqual({})
  })

  it('skips when dragged node already has connections', async () => {
    makeNode({ id: 'src', outputs: [{ type: 'IMAGE', links: [1] }] })
    makeNode({ id: 'sink', inputs: [{ type: 'IMAGE', link: 1 }] })
    makeLink(1, 'src', 'sink', 'IMAGE')

    const dragged = makeNode({
      id: 'dragged',
      inputs: [{ type: 'IMAGE', link: 99 }],
      outputs: [{ type: 'IMAGE', links: null }]
    })
    queryLinkAtPoint.mockReturnValue(1)

    const api = startComposable()
    emitMove(dragged.id)

    expect(api.hoveredLinkId.value).toBeNull()
    expect(queryLinkAtPoint).not.toHaveBeenCalled()
  })

  it('skips when no input slot matches the link type', async () => {
    makeNode({ id: 'src', outputs: [{ type: 'IMAGE', links: [1] }] })
    makeNode({ id: 'sink', inputs: [{ type: 'IMAGE', link: 1 }] })
    makeLink(1, 'src', 'sink', 'IMAGE')

    const dragged = makeNode({
      id: 'dragged',
      inputs: [{ type: 'STRING', link: null }],
      outputs: [{ type: 'IMAGE', links: null }]
    })
    queryLinkAtPoint.mockReturnValue(1)

    const api = startComposable()
    emitMove(dragged.id)

    expect(api.hoveredLinkId.value).toBeNull()
  })

  it('skips when no output slot matches the link type', async () => {
    makeNode({ id: 'src', outputs: [{ type: 'IMAGE', links: [1] }] })
    makeNode({ id: 'sink', inputs: [{ type: 'IMAGE', link: 1 }] })
    makeLink(1, 'src', 'sink', 'IMAGE')

    const dragged = makeNode({
      id: 'dragged',
      inputs: [{ type: 'IMAGE', link: null }],
      outputs: [{ type: 'STRING', links: null }]
    })
    queryLinkAtPoint.mockReturnValue(1)

    const api = startComposable()
    emitMove(dragged.id)

    expect(api.hoveredLinkId.value).toBeNull()
  })

  it('highlights the link when target is valid', async () => {
    makeNode({ id: 'src', outputs: [{ type: 'IMAGE', links: [1] }] })
    makeNode({ id: 'sink', inputs: [{ type: 'IMAGE', link: 1 }] })
    makeLink(1, 'src', 'sink', 'IMAGE')

    const dragged = makeNode({
      id: 'dragged',
      inputs: [{ type: 'IMAGE', link: null }],
      outputs: [{ type: 'IMAGE', links: null }]
    })
    queryLinkAtPoint.mockReturnValue(1)

    const api = startComposable()
    emitMove(dragged.id)

    expect(api.hoveredLinkId.value).toBe(1)
    expect(canvas.highlighted_links).toEqual({ 1: true })
    expect(setDirty).toHaveBeenCalled()
  })

  it('skips when more than one node is in the drag selection', async () => {
    makeNode({ id: 'src', outputs: [{ type: 'IMAGE', links: [1] }] })
    makeNode({ id: 'sink', inputs: [{ type: 'IMAGE', link: 1 }] })
    makeLink(1, 'src', 'sink', 'IMAGE')

    const dragged = makeNode({
      id: 'dragged',
      inputs: [{ type: 'IMAGE', link: null }],
      outputs: [{ type: 'IMAGE', links: null }]
    })
    queryLinkAtPoint.mockReturnValue(1)

    const api = startComposable()
    graphInteractionHooks.emit('nodeDragMove', {
      nodeId: String(dragged.id),
      canvasPos: { x: 0, y: 0 },
      pointerEvent: new PointerEvent('pointermove'),
      selectionSize: 2
    })

    expect(api.hoveredLinkId.value).toBeNull()
  })

  it('inserts the dragged node into the link on drag end', async () => {
    const src = makeNode({
      id: 'src',
      outputs: [{ type: 'IMAGE', links: [1] }]
    })
    const sink = makeNode({ id: 'sink', inputs: [{ type: 'IMAGE', link: 1 }] })
    makeLink(1, 'src', 'sink', 'IMAGE')

    const dragged = makeNode({
      id: 'dragged',
      inputs: [{ type: 'IMAGE', link: null }],
      outputs: [{ type: 'IMAGE', links: null }]
    })
    queryLinkAtPoint.mockReturnValue(1)

    startComposable()
    emitMove(dragged.id)
    emitEnd(dragged.id)

    expect(beforeChange).toHaveBeenCalledTimes(1)
    expect(afterChange).toHaveBeenCalledTimes(1)
    expect((sink as unknown as TestNode).disconnectInput).toHaveBeenCalledWith(
      0,
      true
    )
    expect((src as unknown as TestNode).connect).toHaveBeenCalledWith(
      0,
      dragged,
      0
    )
    expect((dragged as unknown as TestNode).connect).toHaveBeenCalledWith(
      0,
      sink,
      0
    )
  })

  it('clears highlight on drag end without a target', async () => {
    makeNode({ id: 'src', outputs: [{ type: 'IMAGE', links: [1] }] })
    makeNode({ id: 'sink', inputs: [{ type: 'IMAGE', link: 1 }] })
    makeLink(1, 'src', 'sink', 'IMAGE')

    const dragged = makeNode({
      id: 'dragged',
      inputs: [{ type: 'IMAGE', link: null }],
      outputs: [{ type: 'IMAGE', links: null }]
    })
    queryLinkAtPoint.mockReturnValue(1)

    const api = startComposable()
    emitMove(dragged.id)
    expect(api.hoveredLinkId.value).toBe(1)

    queryLinkAtPoint.mockReturnValue(null)
    emitMove(dragged.id)
    emitEnd(dragged.id)

    expect(api.hoveredLinkId.value).toBeNull()
    expect(canvas.highlighted_links).toEqual({})
    expect(beforeChange).not.toHaveBeenCalled()
  })

  it('rejects a link whose endpoints are the dragged node', async () => {
    const dragged = makeNode({
      id: 'dragged',
      inputs: [{ type: 'IMAGE', link: null }],
      outputs: [{ type: 'IMAGE', links: null }]
    })
    makeLink(1, 'dragged', 'other', 'IMAGE')
    queryLinkAtPoint.mockReturnValue(1)

    const api = startComposable()
    emitMove(dragged.id)

    expect(api.hoveredLinkId.value).toBeNull()
  })
})
