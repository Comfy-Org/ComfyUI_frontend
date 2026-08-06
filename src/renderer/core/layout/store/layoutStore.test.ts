import { toGroupId } from '@/types/groupId'
import type { GroupId } from '@/types/groupId'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { fromPartial } from '@total-typescript/shoehorn'
import { nextTick, watch } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'
import { createUuidv4 } from '@/utils/uuid'
import type { UUID } from '@/utils/uuid'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import {
  LayoutOperationError,
  layoutStore
} from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { canvasLayoutMutations } from '@/renderer/core/layout/operations/graphLayoutRegistration'
import type {
  LayoutChange,
  LayoutOperation,
  MoveNodeOperation,
  NodeLayout,
  Point,
  SlotLayout
} from '@/renderer/core/layout/types'

const GRAPH = createUuidv4()

function getOperationsAddedBy(action: () => void): LayoutOperation[] {
  const applySpy = vi.spyOn(layoutStore, 'applyOperation')
  try {
    action()
    return applySpy.mock.calls.map(([operation]) => operation)
  } finally {
    applySpy.mockRestore()
  }
}

function expectSingleOperation(
  operations: LayoutOperation[],
  expectedOperation: Record<string, unknown>
): void {
  expect(operations).toHaveLength(1)
  expect(operations[0]).toEqual(expect.objectContaining(expectedOperation))
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
})

describe('layoutStore CRDT operations', () => {
  beforeEach(() => {
    // Clear the store before each test
    layoutStore.resetForTests()
  })
  // Helper to create test node data
  const createTestNode = (id: NodeId): NodeLayout => ({
    id,
    position: { x: 100, y: 100 },
    size: { width: 200, height: 100 },
    zIndex: 0,
    visible: true,
    bounds: { x: 100, y: 100, width: 200, height: 100 }
  })

  function createRemoteDoc(): Y.Doc {
    const remote = new Y.Doc()
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(layoutStore.getYDocForTests()))
    return remote
  }

  function readRect(nodeId: NodeId): number[] | null {
    const out = new Float64Array(4)
    return layoutStore.readNodeRect(GRAPH, nodeId, out) ? [...out] : null
  }

  function applyRemoteChanges(remote: Y.Doc, change: () => void): void {
    const stateVector = Y.encodeStateVector(layoutStore.getYDocForTests())
    change()
    Y.applyUpdate(
      layoutStore.getYDocForTests(),
      Y.encodeStateAsUpdate(remote, stateVector)
    )
  }

  describe('explicit operation outcomes', () => {
    const graphId = createUuidv4()
    const nodeId = toNodeId('operation-outcome-node')
    const groupId = 41 as GroupId
    const rerouteId = toRerouteId(42)
    const metadata = {
      actor: 'test',
      graphId,
      source: LayoutSource.External,
      timestamp: 1
    } as const

    function createNode(
      layout = createTestNode(nodeId),
      registrationId?: string
    ) {
      return layoutStore.applyOperation({
        ...metadata,
        entity: 'node',
        layout,
        nodeId: layout.id,
        registrationId,
        type: 'createNode'
      })
    }

    function createGroup(position = { x: 10, y: 20 }, registrationId?: string) {
      return layoutStore.applyOperation({
        ...metadata,
        entity: 'group',
        graphId,
        groupId,
        layout: {
          id: groupId,
          position,
          size: { width: 30, height: 40 }
        },
        registrationId,
        type: 'createGroup'
      })
    }

    function createReroute(
      position = { x: 10, y: 20 },
      registrationId?: string
    ) {
      return layoutStore.applyOperation({
        ...metadata,
        entity: 'reroute',
        graphId,
        position,
        registrationId,
        rerouteId,
        type: 'createReroute'
      })
    }

    it('returns applied for a state transition and no-op for a missing target', () => {
      expect(createNode()).toBe('applied')
      expect(
        layoutStore.applyOperation({
          ...metadata,
          entity: 'node',
          nodeId: toNodeId('missing'),
          position: { x: 1, y: 2 },
          type: 'moveNode'
        })
      ).toBe('no-op')
    })

    it('applies and persists changed node visibility', () => {
      createNode()

      expect(
        layoutStore.applyOperation({
          ...metadata,
          entity: 'node',
          nodeId,
          type: 'setNodeVisibility',
          visible: false
        })
      ).toBe('applied')
      expect(layoutStore.getNodeLayoutRef(graphId, nodeId).value?.visible).toBe(
        false
      )
    })

    it('executes dependent batch commands in order', () => {
      createNode()
      const initialPosition = createTestNode(nodeId).position
      const move = (position: Point): MoveNodeOperation => ({
        ...metadata,
        entity: 'node',
        nodeId,
        position,
        type: 'moveNode'
      })
      const operations = [move({ x: 300, y: 400 }), move(initialPosition)]

      expect(layoutStore.applyOperations(operations)).toBe('applied')
      expect(
        layoutStore.getNodeLayoutRef(graphId, nodeId).value?.position
      ).toEqual(initialPosition)
      expect(layoutStore.applyOperations(operations)).toBe('applied')
      expect(
        layoutStore.getNodeLayoutRef(graphId, nodeId).value?.position
      ).toEqual(initialPosition)
    })

    it('rejects tokenless updates to a registered node', () => {
      createNode(createTestNode(nodeId), 'owner')
      const operations: LayoutOperation[] = [
        {
          ...metadata,
          entity: 'node',
          nodeId,
          position: { x: 300, y: 400 },
          type: 'moveNode'
        },
        {
          ...metadata,
          entity: 'node',
          nodeId,
          size: { width: 300, height: 400 },
          type: 'resizeNode'
        },
        {
          ...metadata,
          entity: 'node',
          nodeId,
          type: 'setNodeVisibility',
          visible: false
        },
        {
          ...metadata,
          entity: 'node',
          nodeId,
          type: 'setNodeZIndex',
          zIndex: 10
        },
        {
          ...metadata,
          bounds: {
            [nodeId]: { x: 1, y: 2, width: 3, height: 4 }
          },
          entity: 'node',
          nodeIds: [nodeId],
          type: 'batchUpdateBounds'
        }
      ]

      expect(layoutStore.applyOperations(operations)).toBe('no-op')
      expect(layoutStore.getNodeLayoutRef(graphId, nodeId).value).toEqual(
        createTestNode(nodeId)
      )
    })

    it('requires exact group and reroute ownership while preserving legacy updates', () => {
      createGroup(undefined, 'group-owner')
      createReroute(undefined, '')

      expect(
        layoutStore.applyOperation({
          ...metadata,
          entity: 'group',
          graphId,
          groupId,
          position: { x: 100, y: 200 },
          size: { width: 300, height: 400 },
          type: 'setGroupBounds'
        })
      ).toBe('no-op')
      expect(
        layoutStore.applyOperation({
          ...metadata,
          entity: 'reroute',
          graphId,
          position: { x: 100, y: 200 },
          registrationId: '',
          rerouteId,
          type: 'moveReroute'
        })
      ).toBe('applied')

      layoutStore.resetForTests()
      createGroup()
      expect(
        layoutStore.applyOperation({
          ...metadata,
          entity: 'group',
          graphId,
          groupId,
          position: { x: 100, y: 200 },
          size: { width: 300, height: 400 },
          type: 'setGroupBounds'
        })
      ).toBe('applied')
    })

    it.for([
      {
        create: () => createGroup(undefined, 'owner'),
        key: `${graphId}:${groupId}`,
        map: 'groups',
        operation: {
          ...metadata,
          entity: 'group',
          graphId,
          groupId,
          position: { x: 100, y: 200 },
          registrationId: 'owner',
          size: { width: 300, height: 400 },
          type: 'setGroupBounds'
        } satisfies LayoutOperation
      },
      {
        create: () => createReroute(undefined, 'owner'),
        key: `${graphId}:${rerouteId}`,
        map: 'reroutes',
        operation: {
          ...metadata,
          entity: 'reroute',
          graphId,
          position: { x: 100, y: 200 },
          registrationId: 'owner',
          rerouteId,
          type: 'moveReroute'
        } satisfies LayoutOperation
      }
    ])(
      'preserves a foreign $map replacement at commit time',
      ({ create, key, map, operation }) => {
        create()
        const collection = layoutStore
          .getYDocForTests()
          .getMap<Y.Map<unknown>>(map)
        const foreign = new Y.Map<unknown>()
        foreign.set('registrationId', 'foreign')
        const ydoc = layoutStore.getYDocForTests()
        const originalTransact = ydoc.transact.bind(ydoc)
        vi.spyOn(ydoc, 'transact').mockImplementationOnce(
          (transaction, origin) => {
            collection.set(key, foreign)
            originalTransact(transaction, origin)
          }
        )

        expect(layoutStore.applyOperation(operation)).toBe('no-op')
        expect(collection.get(key)).toBe(foreign)
      }
    )

    it.for([
      {
        name: 'node',
        operation: {
          ...metadata,
          entity: 'node',
          nodeId: toNodeId('missing-node'),
          size: { width: 1, height: 2 },
          type: 'resizeNode'
        } as const
      },
      {
        name: 'group',
        operation: {
          ...metadata,
          entity: 'group',
          graphId,
          groupId: 999 as GroupId,
          position: { x: 1, y: 2 },
          size: { width: 3, height: 4 },
          type: 'setGroupBounds'
        } as const
      },
      {
        name: 'reroute',
        operation: {
          ...metadata,
          entity: 'reroute',
          graphId,
          position: { x: 1, y: 2 },
          rerouteId: toRerouteId(999),
          type: 'moveReroute'
        } as const
      },
      {
        name: 'node visibility',
        operation: {
          ...metadata,
          entity: 'node',
          nodeId: toNodeId('missing-node'),
          type: 'setNodeVisibility',
          visible: false
        } as const
      }
    ])('returns no-op for a missing $name update', ({ operation }) => {
      expect(layoutStore.applyOperation(operation)).toBe('no-op')
    })

    it('returns no-op for repeated node, group, and reroute deletion', () => {
      createNode()
      createGroup()
      createReroute()
      const deletions = [
        {
          ...metadata,
          entity: 'node',
          nodeId,
          type: 'deleteNode'
        },
        {
          ...metadata,
          entity: 'group',
          graphId,
          groupId,
          type: 'deleteGroup'
        },
        {
          ...metadata,
          entity: 'reroute',
          graphId,
          rerouteId,
          type: 'deleteReroute'
        }
      ] as const

      for (const operation of deletions) {
        expect(layoutStore.applyOperation(operation)).toBe('applied')
        expect(layoutStore.applyOperation(operation)).toBe('no-op')
      }
    })

    it('returns no-op when node visibility is updated after deletion', () => {
      createNode()
      layoutStore.applyOperation({
        ...metadata,
        entity: 'node',
        nodeId,
        type: 'deleteNode'
      })

      expect(
        layoutStore.applyOperation({
          ...metadata,
          entity: 'node',
          nodeId,
          type: 'setNodeVisibility',
          visible: false
        })
      ).toBe('no-op')
    })

    it('rejects duplicate creates and preserves the original entities', () => {
      createNode()
      createGroup()
      createReroute()

      expect(
        createNode({
          ...createTestNode(nodeId),
          position: { x: 500, y: 600 }
        })
      ).toBe('no-op')
      expect(createGroup({ x: 500, y: 600 })).toBe('no-op')
      expect(createReroute({ x: 500, y: 600 })).toBe('no-op')
      expect(
        layoutStore.getNodeLayoutRef(graphId, nodeId).value?.position
      ).toEqual({
        x: 100,
        y: 100
      })
      expect(layoutStore.getGroupLayout(graphId, groupId)?.position).toEqual({
        x: 10,
        y: 20
      })
      expect(
        layoutStore.getRerouteLayout(graphId, rerouteId)?.position
      ).toEqual({ x: 10, y: 20 })
    })

    it('owns the position supplied when creating a reroute', () => {
      const position = { x: 10, y: 20 }
      const listener = vi.fn()
      const geometryListener = vi.fn()
      const stop = layoutStore.onChange(listener)
      const stopGeometry = layoutStore.onGeometryChange(geometryListener)
      createReroute(position)
      const version = layoutStore.getVersion().value
      listener.mockClear()
      geometryListener.mockClear()

      position.x = 500
      position.y = 600

      expect(
        layoutStore.getRerouteLayout(graphId, rerouteId)?.position
      ).toEqual({
        x: 10,
        y: 20
      })
      expect(
        layoutStore.queryRerouteAtPoint(graphId, { x: 10, y: 20 })?.id
      ).toBe(rerouteId)
      expect(layoutStore.queryRerouteAtPoint(graphId, position)).toBeNull()
      expect(listener).not.toHaveBeenCalled()
      expect(geometryListener).not.toHaveBeenCalled()
      expect(layoutStore.getVersion().value).toBe(version)
      stop()
      stopGeometry()
    })

    it('owns the position supplied when moving a reroute', () => {
      createReroute()
      const position = { x: 30, y: 40 }
      layoutStore.applyOperation({
        ...metadata,
        entity: 'reroute',
        graphId,
        position,
        rerouteId,
        type: 'moveReroute'
      })
      const listener = vi.fn()
      const geometryListener = vi.fn()
      const stop = layoutStore.onChange(listener)
      const stopGeometry = layoutStore.onGeometryChange(geometryListener)
      const version = layoutStore.getVersion().value

      position.x = 500
      position.y = 600

      expect(
        layoutStore.getRerouteLayout(graphId, rerouteId)?.position
      ).toEqual({
        x: 30,
        y: 40
      })
      expect(
        layoutStore.queryRerouteAtPoint(graphId, { x: 30, y: 40 })?.id
      ).toBe(rerouteId)
      expect(layoutStore.queryRerouteAtPoint(graphId, position)).toBeNull()
      expect(listener).not.toHaveBeenCalled()
      expect(geometryListener).not.toHaveBeenCalled()
      expect(layoutStore.getVersion().value).toBe(version)
      stop()
      stopGeometry()
    })

    it('uses operation target IDs for node and group creation', async () => {
      const embeddedNodeId = toNodeId('embedded-node')
      const embeddedGroupId = 404 as GroupId
      const listener = vi.fn()
      const stop = layoutStore.onChange(listener)

      layoutStore.applyOperation({
        ...metadata,
        entity: 'node',
        layout: createTestNode(embeddedNodeId),
        nodeId,
        type: 'createNode'
      })
      layoutStore.applyOperation({
        ...metadata,
        entity: 'group',
        graphId,
        groupId,
        layout: {
          id: embeddedGroupId,
          position: { x: 10, y: 20 },
          size: { width: 30, height: 40 }
        },
        type: 'createGroup'
      })
      await nextTick()

      expect(layoutStore.getNodeLayoutRef(graphId, nodeId).value?.id).toBe(
        nodeId
      )
      expect(
        layoutStore.getNodeLayoutRef(graphId, embeddedNodeId).value
      ).toBeNull()
      expect(layoutStore.getGroupLayout(graphId, groupId)?.id).toBe(groupId)
      expect(layoutStore.getGroupLayout(graphId, embeddedGroupId)).toBeNull()
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeIds: [nodeId],
          operation: expect.objectContaining({
            layout: expect.objectContaining({ id: nodeId }),
            nodeId
          }),
          source: LayoutSource.External,
          type: 'create'
        })
      )
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: expect.objectContaining({
            groupId,
            layout: expect.objectContaining({ id: groupId })
          }),
          type: 'create'
        })
      )
      stop()
    })

    it('restores canonical entities and indexes after delete and recreate', () => {
      createNode()
      createGroup()
      createReroute()

      const deletions: LayoutOperation[] = [
        { ...metadata, entity: 'node', nodeId, type: 'deleteNode' },
        { ...metadata, entity: 'group', graphId, groupId, type: 'deleteGroup' },
        {
          ...metadata,
          entity: 'reroute',
          graphId,
          rerouteId,
          type: 'deleteReroute'
        }
      ]
      deletions.forEach((operation) => layoutStore.applyOperation(operation))

      createNode()
      createGroup()
      createReroute()

      expect(layoutStore.getNodeLayoutRef(graphId, nodeId).value?.id).toBe(
        nodeId
      )
      expect(layoutStore.getGroupLayout(graphId, groupId)?.id).toBe(groupId)
      expect(layoutStore.getRerouteLayout(graphId, rerouteId)?.id).toBe(
        rerouteId
      )
      expect(
        layoutStore.queryRerouteAtPoint(graphId, { x: 10, y: 20 })?.id
      ).toBe(rerouteId)
    })

    it('returns no-op for equal node, group, and reroute setters', () => {
      createNode()
      createGroup()
      createReroute()

      const operations: LayoutOperation[] = [
        {
          ...metadata,
          entity: 'node',
          nodeId,
          position: { x: 100, y: 100 },
          type: 'moveNode'
        },
        {
          ...metadata,
          entity: 'node',
          nodeId,
          size: { width: 200, height: 100 },
          type: 'resizeNode'
        },
        {
          ...metadata,
          entity: 'node',
          nodeId,
          type: 'setNodeZIndex',
          zIndex: 0
        },
        {
          ...metadata,
          entity: 'node',
          nodeId,
          type: 'setNodeVisibility',
          visible: true
        },
        {
          ...metadata,
          entity: 'group',
          graphId,
          groupId,
          position: { x: 10, y: 20 },
          size: { width: 30, height: 40 },
          type: 'setGroupBounds'
        },
        {
          ...metadata,
          entity: 'reroute',
          graphId,
          position: { x: 10, y: 20 },
          rerouteId,
          type: 'moveReroute'
        }
      ]

      for (const operation of operations) {
        expect(layoutStore.applyOperation(operation)).toBe('no-op')
      }
    })

    it('applies a mixed batch only when an existing node changes', () => {
      createNode()
      const equalNodeId = toNodeId('equal-batch-node')
      createNode({ ...createTestNode(equalNodeId), id: equalNodeId })

      expect(
        layoutStore.applyOperation({
          ...metadata,
          bounds: {
            [nodeId]: { x: 5, y: 6, width: 7, height: 8 },
            [equalNodeId]: { x: 100, y: 100, width: 200, height: 100 },
            [toNodeId('missing')]: { x: 1, y: 2, width: 3, height: 4 }
          },
          entity: 'node',
          nodeIds: [nodeId, equalNodeId, toNodeId('missing')],
          type: 'batchUpdateBounds'
        })
      ).toBe('applied')
      expect(
        layoutStore.getNodeLayoutRef(graphId, nodeId).value?.bounds
      ).toEqual({
        x: 5,
        y: 6,
        width: 7,
        height: 8
      })
      expect(
        layoutStore.getNodeLayoutRef(graphId, equalNodeId).value?.bounds
      ).toEqual({
        x: 100,
        y: 100,
        width: 200,
        height: 100
      })
    })

    it('returns no-op for all-missing and all-equal batches', () => {
      createNode()
      expect(
        layoutStore.applyOperation({
          ...metadata,
          bounds: {
            [toNodeId('missing')]: { x: 1, y: 2, width: 3, height: 4 }
          },
          entity: 'node',
          nodeIds: [toNodeId('missing')],
          type: 'batchUpdateBounds'
        })
      ).toBe('no-op')
      expect(
        layoutStore.applyOperation({
          ...metadata,
          bounds: {
            [nodeId]: { x: 100, y: 100, width: 200, height: 100 }
          },
          entity: 'node',
          nodeIds: [nodeId],
          type: 'batchUpdateBounds'
        })
      ).toBe('no-op')
    })

    it('does not finalize or project a no-op command', async () => {
      createNode()
      const nodeListener = vi.fn()
      const globalListener = vi.fn()
      const geometryListener = vi.fn()
      const stopNode = layoutStore.onNodeChange(graphId, nodeId, nodeListener)
      const stopGlobal = layoutStore.onChange(globalListener)
      const stopGeometry = layoutStore.onGeometryChange(geometryListener)
      const version = layoutStore.getVersion().value
      const geometryVersion = layoutStore.geometryVersion

      expect(
        layoutStore.applyOperation({
          ...metadata,
          entity: 'node',
          nodeId,
          type: 'setNodeVisibility',
          visible: true
        })
      ).toBe('no-op')
      await Promise.resolve()

      expect(nodeListener).not.toHaveBeenCalled()
      expect(globalListener).not.toHaveBeenCalled()
      expect(geometryListener).not.toHaveBeenCalled()
      expect(layoutStore.getVersion().value).toBe(version)
      expect(layoutStore.geometryVersion).toBe(geometryVersion)
      stopNode()
      stopGlobal()
      stopGeometry()
    })

    it('finalizes an applied command exactly once', async () => {
      createNode()
      const nodeListener = vi.fn()
      const globalListener = vi.fn()
      const geometryListener = vi.fn()
      const stopNode = layoutStore.onNodeChange(graphId, nodeId, nodeListener)
      const stopGlobal = layoutStore.onChange(globalListener)
      const stopGeometry = layoutStore.onGeometryChange(geometryListener)
      const version = layoutStore.getVersion().value
      const geometryVersion = layoutStore.geometryVersion

      expect(
        layoutStore.applyOperation({
          ...metadata,
          entity: 'node',
          nodeId,
          type: 'setNodeVisibility',
          visible: false
        })
      ).toBe('applied')
      await Promise.resolve()

      expect(nodeListener).toHaveBeenCalledOnce()
      expect(globalListener).toHaveBeenCalledOnce()
      expect(geometryListener).toHaveBeenCalledOnce()
      expect(layoutStore.getVersion().value).toBe(version + 1)
      expect(layoutStore.geometryVersion).toBe(geometryVersion + 1)
      stopNode()
      stopGlobal()
      stopGeometry()
    })

    it('notifies with snapshots of every mutable operation shape', async () => {
      const snapshotNodeId = toNodeId('snapshot-node')
      const batchNodeId = toNodeId('snapshot-batch-node')
      const snapshotGroupId = 501 as GroupId
      const snapshotRerouteId = toRerouteId(502)
      const operations: LayoutOperation[] = [
        {
          ...metadata,
          actor: 'snapshot-actor',
          entity: 'node',
          id: 'snapshot-command',
          layout: {
            id: toNodeId('noncanonical-node'),
            position: { x: 1, y: 2 },
            size: { width: 3, height: 4 },
            zIndex: 5,
            visible: true,
            bounds: { x: 1, y: 2, width: 3, height: 4 }
          },
          nodeId: snapshotNodeId,
          timestamp: 123,
          type: 'createNode'
        },
        {
          ...metadata,
          bounds: {
            [batchNodeId]: { x: 10, y: 20, width: 30, height: 40 }
          },
          entity: 'node',
          nodeIds: [batchNodeId],
          type: 'batchUpdateBounds'
        },
        {
          ...metadata,
          entity: 'group',
          graphId,
          groupId: snapshotGroupId,
          layout: {
            id: 999 as GroupId,
            position: { x: 50, y: 60 },
            size: { width: 70, height: 80 }
          },
          type: 'createGroup'
        },
        {
          ...metadata,
          entity: 'group',
          graphId,
          groupId: snapshotGroupId,
          position: { x: 51, y: 61 },
          size: { width: 71, height: 81 },
          type: 'setGroupBounds'
        },
        {
          ...metadata,
          entity: 'reroute',
          graphId,
          position: { x: 90, y: 100 },
          rerouteId: snapshotRerouteId,
          type: 'createReroute'
        },
        {
          ...metadata,
          entity: 'reroute',
          graphId,
          position: { x: 91, y: 101 },
          rerouteId: snapshotRerouteId,
          type: 'moveReroute'
        }
      ]
      createNode(createTestNode(batchNodeId))
      const changes: LayoutChange[] = []
      const stop = layoutStore.onChange((change) => changes.push(change))
      const expected = structuredClone(operations)
      if (expected[0].type === 'createNode') {
        expected[0].layout.id = snapshotNodeId
      }
      if (expected[2].type === 'createGroup') {
        expected[2].layout.id = snapshotGroupId
      }

      for (const operation of operations) {
        expect(layoutStore.applyOperation(operation)).toBe('applied')
      }
      for (const operation of operations) {
        Reflect.set(operation, 'actor', 'mutated-actor')
        Reflect.set(operation, 'source', LayoutSource.Canvas)
        Reflect.set(operation, 'timestamp', 999)
        Reflect.set(operation, 'id', 'mutated-command')
        Reflect.set(operation, 'entity', 'node')
        Reflect.set(operation, 'type', 'deleteNode')
        if ('layout' in operation) {
          operation.layout.position.x = 999
          operation.layout.size.width = 999
          if ('bounds' in operation.layout) operation.layout.bounds.y = 999
        }
        if ('bounds' in operation) {
          operation.bounds[batchNodeId].height = 999
          operation.nodeIds.push(toNodeId('mutated-node'))
        }
        if ('position' in operation) operation.position.y = 999
        if ('size' in operation) operation.size.height = 999
      }
      await Promise.resolve()

      expect(changes.map(({ operation }) => operation)).toEqual(expected)
      stop()
    })

    it('opens a transaction only for an applied command', () => {
      const previousActor = layoutStore.getCurrentActor()
      layoutStore.setActor('current-store-actor')
      const transactions: Y.Transaction[] = []
      function handleTransaction(transaction: Y.Transaction): void {
        transactions.push(transaction)
      }
      layoutStore.getYDocForTests().on('afterTransaction', handleTransaction)

      expect(
        layoutStore.applyOperation({
          ...metadata,
          actor: 'submitted-operation-actor',
          entity: 'node',
          layout: createTestNode(nodeId),
          nodeId,
          type: 'createNode'
        })
      ).toBe('applied')
      expect(transactions).toHaveLength(1)
      expect(transactions[0].origin).toBe('submitted-operation-actor')

      const noOps: LayoutOperation[] = [
        {
          ...metadata,
          actor: 'equal-no-op-actor',
          entity: 'node',
          nodeId,
          position: { x: 100, y: 100 },
          type: 'moveNode'
        },
        {
          ...metadata,
          actor: 'missing-no-op-actor',
          entity: 'node',
          nodeId: toNodeId('missing-node'),
          type: 'deleteNode'
        },
        {
          ...metadata,
          actor: 'repeated-no-op-actor',
          entity: 'node',
          layout: createTestNode(nodeId),
          nodeId,
          type: 'createNode'
        }
      ]
      noOps.forEach((operation) => {
        expect(layoutStore.applyOperation(operation)).toBe('no-op')
      })
      expect(transactions).toHaveLength(1)
      layoutStore.getYDocForTests().off('afterTransaction', handleTransaction)
      layoutStore.setActor(previousActor)
    })

    it.for(['delete', 'replace', 'make-equal'] as const)(
      'returns no-op when beforeTransaction listeners %s the move target',
      async (interference) => {
        createNode()
        await Promise.resolve()
        const ydoc = layoutStore.getYDocForTests()
        const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes')
        const original = ynodes.get(`${graphId}:${nodeId}`)
        const originalPositionChanges: Y.YMapEvent<unknown>[] = []
        original?.observe((event) => {
          if (event.keysChanged.has('position'))
            originalPositionChanges.push(event)
        })
        const nodeListener = vi.fn()
        const globalListener = vi.fn()
        const geometryListener = vi.fn()
        const stopNode = layoutStore.onNodeChange(graphId, nodeId, nodeListener)
        const stopGlobal = layoutStore.onChange(globalListener)
        const stopGeometry = layoutStore.onGeometryChange(geometryListener)

        function interfere(): void {
          ydoc.off('beforeTransaction', interfere)
          if (interference === 'delete') {
            ynodes.delete(`${graphId}:${nodeId}`)
            return
          }
          if (interference === 'replace') {
            const replacement = new Y.Map<unknown>()
            replacement.set('id', nodeId)
            replacement.set('position', { x: 300, y: 400 })
            replacement.set('size', { width: 200, height: 100 })
            replacement.set('zIndex', 0)
            replacement.set('visible', true)
            ynodes.set(`${graphId}:${nodeId}`, replacement)
            return
          }
          original?.set('position', { x: 300, y: 400 })
        }
        ydoc.on('beforeTransaction', interfere)

        const result = layoutStore.applyOperation({
          ...metadata,
          entity: 'node',
          nodeId,
          position: { x: 300, y: 400 },
          type: 'moveNode'
        })
        await Promise.resolve()

        expect(result).toBe('no-op')
        expect(nodeListener).not.toHaveBeenCalled()
        expect(globalListener).not.toHaveBeenCalled()
        expect(geometryListener).toHaveBeenCalledOnce()
        expect(originalPositionChanges).toHaveLength(
          interference === 'make-equal' ? 1 : 0
        )
        expect(
          layoutStore.getNodeLayoutRef(graphId, nodeId).value?.position
        ).toEqual(interference === 'delete' ? undefined : { x: 300, y: 400 })
        stopNode()
        stopGlobal()
        stopGeometry()
      }
    )

    it('filters invalidated batch targets inside the transaction', async () => {
      createNode()
      const secondId = toNodeId('second-batch-target')
      createNode(createTestNode(secondId))
      await Promise.resolve()
      const ydoc = layoutStore.getYDocForTests()
      const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes')
      const original = ynodes.get(`${graphId}:${nodeId}`)
      const originalPositionChanges: Y.YMapEvent<unknown>[] = []
      original?.observe((event) => {
        if (event.keysChanged.has('position'))
          originalPositionChanges.push(event)
      })
      const globalListener = vi.fn()
      const stopGlobal = layoutStore.onChange(globalListener)

      function interfere(): void {
        ydoc.off('beforeTransaction', interfere)
        ynodes.delete(`${graphId}:${nodeId}`)
        ynodes.get(`${graphId}:${secondId}`)?.set('position', { x: 5, y: 6 })
        ynodes
          .get(`${graphId}:${secondId}`)
          ?.set('size', { width: 7, height: 8 })
      }
      ydoc.on('beforeTransaction', interfere)

      const result = layoutStore.applyOperation({
        ...metadata,
        bounds: {
          [nodeId]: { x: 1, y: 2, width: 3, height: 4 },
          [secondId]: { x: 5, y: 6, width: 7, height: 8 }
        },
        entity: 'node',
        nodeIds: [nodeId, secondId],
        type: 'batchUpdateBounds'
      })
      await Promise.resolve()

      expect(result).toBe('no-op')
      expect(globalListener).not.toHaveBeenCalled()
      expect(originalPositionChanges).toHaveLength(0)
      expect(
        layoutStore.getNodeLayoutRef(graphId, secondId).value?.bounds
      ).toEqual({
        x: 5,
        y: 6,
        width: 7,
        height: 8
      })
      stopGlobal()
    })

    it('rejects a reentrant command and preserves the outer actor', () => {
      createNode()
      const ydoc = layoutStore.getYDocForTests()
      const transactions: Y.Transaction[] = []
      const nodeListener = vi.fn()
      const stopNode = layoutStore.onNodeChange(graphId, nodeId, nodeListener)
      let nestedResult:
        | ReturnType<typeof layoutStore.applyOperation>
        | undefined
      function recordTransaction(transaction: Y.Transaction): void {
        transactions.push(transaction)
      }
      function attemptNested(): void {
        ydoc.off('beforeTransaction', attemptNested)
        nestedResult = layoutStore.applyOperation({
          ...metadata,
          actor: 'nested-actor',
          entity: 'node',
          nodeId,
          size: { width: 500, height: 600 },
          type: 'resizeNode'
        })
      }
      ydoc.on('beforeTransaction', attemptNested)
      ydoc.on('afterTransaction', recordTransaction)

      const result = layoutStore.applyOperation({
        ...metadata,
        actor: 'outer-actor',
        entity: 'node',
        nodeId,
        position: { x: 300, y: 400 },
        type: 'moveNode'
      })

      expect(result).toBe('applied')
      expect(nestedResult).toBe('rejected')
      expect(transactions).toHaveLength(1)
      expect(transactions[0].origin).toBe('outer-actor')
      expect(nodeListener).toHaveBeenCalledOnce()
      expect(nodeListener).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: expect.objectContaining({ actor: 'outer-actor' })
        })
      )
      expect(layoutStore.getNodeLayoutRef(graphId, nodeId).value).toMatchObject(
        {
          position: { x: 300, y: 400 },
          size: { width: 200, height: 100 }
        }
      )
      ydoc.off('afterTransaction', recordTransaction)
      stopNode()
    })

    it('reports when a transaction throws before the mutation applies', () => {
      createNode()
      const ydoc = layoutStore.getYDocForTests()
      const error = new Error('before transaction failed')
      const transact = vi.spyOn(ydoc, 'transact')
      transact.mockImplementation(() => {
        throw error
      })

      expect(() =>
        layoutStore.applyOperation({
          ...metadata,
          entity: 'node',
          nodeId,
          position: { x: 300, y: 400 },
          type: 'moveNode'
        })
      ).toThrow(
        expect.objectContaining({
          applied: false,
          cause: error,
          message: 'before transaction failed'
        })
      )
      transact.mockRestore()
    })

    it('reports applied and clears the guard when transact throws afterward', () => {
      createNode()
      const ydoc = layoutStore.getYDocForTests()
      const error = new Error('transaction hook failed')
      const originalTransact = ydoc.transact.bind(ydoc)
      const transact = vi.spyOn(ydoc, 'transact')
      transact.mockImplementation((transaction, origin) => {
        originalTransact(transaction, origin)
        throw error
      })

      let thrown: unknown
      try {
        layoutStore.applyOperation({
          ...metadata,
          entity: 'node',
          nodeId,
          position: { x: 300, y: 400 },
          type: 'moveNode'
        })
      } catch (error) {
        thrown = error
      }
      transact.mockRestore()
      expect(thrown).toBeInstanceOf(LayoutOperationError)
      expect(thrown).toMatchObject({
        applied: true,
        cause: error,
        message: 'transaction hook failed'
      })
      expect(
        layoutStore.applyOperation({
          ...metadata,
          entity: 'node',
          nodeId,
          position: { x: 500, y: 600 },
          type: 'moveNode'
        })
      ).toBe('applied')
    })

    it('reports applied when a batch mutation throws after its first write', () => {
      createNode()
      const ydoc = layoutStore.getYDocForTests()
      const ynode = ydoc
        .getMap<Y.Map<unknown>>('nodes')
        .get(`${graphId}:${nodeId}`)!
      const error = new Error('second write failed')
      const originalSet = ynode.set.bind(ynode)
      const set = vi.spyOn(ynode, 'set')
      set.mockImplementation((key, value) => {
        if (key === 'size') throw error
        return originalSet(key, value)
      })

      expect(() =>
        layoutStore.applyOperation({
          ...metadata,
          bounds: {
            [nodeId]: { x: 1, y: 2, width: 3, height: 4 }
          },
          entity: 'node',
          nodeIds: [nodeId],
          type: 'batchUpdateBounds'
        })
      ).toThrow(
        expect.objectContaining({
          applied: true,
          cause: error,
          message: 'second write failed'
        })
      )
      set.mockRestore()
    })

    it('wraps finalization failures as applied operation errors', () => {
      createNode()
      const error = new Error('change snapshot failed')
      const stop = layoutStore.onChange(vi.fn())
      const originalStructuredClone = structuredClone
      const clone = vi.spyOn(globalThis, 'structuredClone')
      clone.mockImplementation((value) => {
        if (
          typeof value === 'object' &&
          value !== null &&
          'operation' in value
        ) {
          throw error
        }
        return originalStructuredClone(value)
      })

      expect(() =>
        layoutStore.applyOperation({
          ...metadata,
          entity: 'node',
          nodeId,
          position: { x: 300, y: 400 },
          type: 'moveNode'
        })
      ).toThrow(
        expect.objectContaining({
          applied: true,
          cause: error,
          message: 'change snapshot failed'
        })
      )
      clone.mockRestore()
      stop()
    })
  })

  it('notifies geometry once for one remote transaction across entity maps', () => {
    const remote = createRemoteDoc()
    const onGeometryChange = vi.fn()
    const stop = layoutStore.onGeometryChange(onGeometryChange)
    const geometryVersion = layoutStore.geometryVersion

    applyRemoteChanges(remote, () => {
      remote.transact(() => {
        const node = new Y.Map<unknown>()
        node.set('id', 'remote-transaction-node')
        node.set('position', { x: 10, y: 20 })
        node.set('size', { width: 30, height: 40 })
        node.set('zIndex', 0)
        node.set('visible', true)
        remote
          .getMap<Y.Map<unknown>>('nodes')
          .set('remote-transaction-node', node)

        const group = new Y.Map<unknown>()
        group.set('id', 1)
        group.set('bounds', { x: 50, y: 60, width: 70, height: 80 })
        remote.getMap<Y.Map<unknown>>('groups').set('remote-graph:1', group)

        const reroute = new Y.Map<unknown>()
        reroute.set('id', 2)
        reroute.set('position', { x: 90, y: 100 })
        remote.getMap<Y.Map<unknown>>('reroutes').set('remote-graph:2', reroute)
      })
    })

    expect(onGeometryChange).toHaveBeenCalledOnce()
    expect(layoutStore.geometryVersion).toBe(geometryVersion + 1)
    stop()
  })

  it('notifies geometry once for one local transaction across entity maps', () => {
    const ydoc = layoutStore.getYDocForTests()
    const onGeometryChange = vi.fn()
    const stop = layoutStore.onGeometryChange(onGeometryChange)
    const geometryVersion = layoutStore.geometryVersion

    ydoc.transact(() => {
      const node = new Y.Map<unknown>()
      node.set('id', 'local-transaction-node')
      node.set('position', { x: 10, y: 20 })
      node.set('size', { width: 30, height: 40 })
      node.set('zIndex', 0)
      node.set('visible', true)
      ydoc.getMap<Y.Map<unknown>>('nodes').set('local-transaction-node', node)

      const group = new Y.Map<unknown>()
      group.set('id', 1)
      group.set('bounds', { x: 50, y: 60, width: 70, height: 80 })
      ydoc.getMap<Y.Map<unknown>>('groups').set('local-graph:1', group)

      const reroute = new Y.Map<unknown>()
      reroute.set('id', 2)
      reroute.set('position', { x: 90, y: 100 })
      ydoc.getMap<Y.Map<unknown>>('reroutes').set('local-graph:2', reroute)
    })

    expect(onGeometryChange).toHaveBeenCalledOnce()
    expect(layoutStore.geometryVersion).toBe(geometryVersion + 1)
    stop()
  })

  it('isolates errors between geometry change listeners', () => {
    const listenerError = new Error('geometry listener failed')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const stopThrowing = layoutStore.onGeometryChange(() => {
      throw listenerError
    })
    const laterListener = vi.fn()
    const stopLater = layoutStore.onGeometryChange(laterListener)

    expect(() => {
      layoutStore.applyOperation({
        type: 'createNode',
        entity: 'node',
        graphId: GRAPH,
        nodeId: toNodeId('listener-error-node'),
        layout: createTestNode(toNodeId('listener-error-node')),
        timestamp: Date.now(),
        source: LayoutSource.External,
        actor: 'test'
      })
    }).not.toThrow()

    expect(laterListener).toHaveBeenCalledOnce()
    expect(consoleError).toHaveBeenCalledWith(
      'Error in geometry change listener:',
      listenerError
    )
    stopThrowing()
    stopLater()
    consoleError.mockRestore()
  })

  it('projects remote node moves into reactive geometry', async () => {
    const nodeId = toNodeId('remote-move')
    const layout = createTestNode(nodeId)
    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })
    const nodeRef = layoutStore.getNodeLayoutRef(GRAPH, nodeId)
    const refChanges = vi.fn()
    const stop = watch(nodeRef, refChanges)
    const version = layoutStore.geometryVersion
    const remote = createRemoteDoc()

    applyRemoteChanges(remote, () => {
      remote
        .getMap<Y.Map<unknown>>('nodes')
        .get(`${GRAPH}:${nodeId}`)
        ?.set('position', { x: 500, y: 600 })
    })
    await nextTick()

    expect(layoutStore.geometryVersion).toBe(version + 1)
    expect(nodeRef.value?.position).toEqual({ x: 500, y: 600 })
    expect(refChanges).toHaveBeenCalledOnce()
    expect(readRect(nodeId)).toEqual([500, 600, 200, 100])
    stop()
  })

  it('projects remote node creation and deletion into readable geometry', () => {
    const nodeId = toNodeId('remote-create-delete')
    const remote = createRemoteDoc()

    applyRemoteChanges(remote, () => {
      const node = new Y.Map<unknown>()
      node.set('id', nodeId)
      node.set('rect', [640, 360, 320, 180])
      node.set('zIndex', 0)
      node.set('visible', true)
      remote.getMap<Y.Map<unknown>>('nodes').set(`${GRAPH}:${nodeId}`, node)
    })
    expect(readRect(nodeId)).toEqual([640, 360, 320, 180])

    applyRemoteChanges(remote, () => {
      remote.getMap('nodes').delete(`${GRAPH}:${nodeId}`)
    })
    expect(readRect(nodeId)).toBeNull()
  })

  it('projects remote reroute moves into layout and spatial queries', () => {
    const graphId = createUuidv4() as UUID
    const rerouteId = toRerouteId(42)
    layoutStore.applyOperation({
      type: 'createReroute',
      entity: 'reroute',
      graphId,
      rerouteId,
      position: { x: 20, y: 30 },
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })
    const remote = createRemoteDoc()

    applyRemoteChanges(remote, () => {
      remote
        .getMap<Y.Map<unknown>>('reroutes')
        .get(`${graphId}:${rerouteId}`)
        ?.set('position', { x: 400, y: 500 })
    })

    expect(layoutStore.getRerouteLayout(graphId, rerouteId)?.position).toEqual({
      x: 400,
      y: 500
    })
    expect(
      layoutStore.queryRerouteAtPoint(graphId, { x: 20, y: 30 })
    ).toBeNull()
    expect(
      layoutStore.queryRerouteAtPoint(graphId, { x: 400, y: 500 })?.id
    ).toBe(rerouteId)
  })

  it('should create and retrieve nodes', () => {
    const nodeId = toNodeId('test-node-1')
    const layout = createTestNode(nodeId)

    // Create node
    layoutStore.setSource(LayoutSource.External)
    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    // Retrieve node
    const nodeRef = layoutStore.getNodeLayoutRef(GRAPH, nodeId)
    expect(nodeRef.value).toEqual(layout)
  })

  it('should move nodes', () => {
    const nodeId = toNodeId('test-node-2')
    const layout = createTestNode(nodeId)

    // Create node first
    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    // Move node
    const newPosition = { x: 200, y: 300 }
    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      position: newPosition,
      timestamp: Date.now(),
      source: LayoutSource.Vue,
      actor: 'test'
    })

    // Verify position updated
    const nodeRef = layoutStore.getNodeLayoutRef(GRAPH, nodeId)
    expect(nodeRef.value?.position).toEqual(newPosition)
  })

  it('should resize nodes', () => {
    const nodeId = toNodeId('test-node-3')
    const layout = createTestNode(nodeId)

    // Create node
    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    // Resize node
    const newSize = { width: 300, height: 150 }
    layoutStore.applyOperation({
      type: 'resizeNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      size: newSize,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    // Verify size updated
    const nodeRef = layoutStore.getNodeLayoutRef(GRAPH, nodeId)
    expect(nodeRef.value?.size).toEqual(newSize)
  })

  it('should delete nodes', () => {
    const nodeId = toNodeId('test-node-4')
    const layout = createTestNode(nodeId)

    // Create node
    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    // Delete node
    layoutStore.applyOperation({
      type: 'deleteNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    // Verify node deleted
    const nodeRef = layoutStore.getNodeLayoutRef(GRAPH, nodeId)
    expect(nodeRef.value).toBeNull()
  })

  it('should handle source and actor tracking', async () => {
    const nodeId = toNodeId('test-node-5')
    const layout = createTestNode(nodeId)

    // Set source and actor
    layoutStore.setSource(LayoutSource.Vue)
    layoutStore.setActor('user-123')

    // Track change notifications AFTER setting source/actor
    const changes: LayoutChange[] = []
    const unsubscribe = layoutStore.onChange((change) => {
      changes.push(change)
    })

    // Create node
    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })

    // onChange notifications are deferred to a microtask.
    await vi.waitFor(() => {
      expect(changes.length).toBeGreaterThanOrEqual(1)
    })

    const lastChange = changes[changes.length - 1]
    expect(lastChange.source).toBe('vue')
    expect(lastChange.operation.actor).toBe('user-123')

    unsubscribe()
  })

  it('should only notify node-scoped listeners for their node', async () => {
    const nodeA = toNodeId('scoped-node-a')
    const nodeB = toNodeId('scoped-node-b')
    const layoutA = createTestNode(nodeA)
    const layoutB = createTestNode(nodeB)

    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId: nodeA,
      layout: layoutA,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId: nodeB,
      layout: layoutB,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    const scopedChanges: LayoutChange[] = []
    const unsubscribeScoped = layoutStore.onNodeChange(
      GRAPH,
      nodeA,
      (change) => {
        scopedChanges.push(change)
      }
    )

    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId: nodeB,
      position: { x: 400, y: 400 },
      timestamp: Date.now(),
      source: LayoutSource.Vue,
      actor: 'test'
    })

    await vi.waitFor(() => {
      expect(scopedChanges.length).toBe(0)
    })

    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId: nodeA,
      position: { x: 200, y: 250 },
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    await vi.waitFor(() => {
      expect(scopedChanges.length).toBe(1)
    })

    expect(scopedChanges[0].nodeIds).toContain(nodeA)
    unsubscribeScoped()
  })

  it('keeps node-scoped listeners synchronous while deferring global listeners', async () => {
    const nodeId = toNodeId('dispatch-order-node')
    const layout = createTestNode(nodeId)

    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    const callOrder: string[] = []
    const unsubscribeNode = layoutStore.onNodeChange(GRAPH, nodeId, () => {
      callOrder.push('node')
    })
    const unsubscribeGlobal = layoutStore.onChange(() => {
      callOrder.push('global')
    })

    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      position: { x: 320, y: 180 },
      timestamp: Date.now(),
      source: LayoutSource.Vue,
      actor: 'test'
    })

    expect(callOrder).toEqual(['node'])

    await Promise.resolve()

    expect(callOrder).toEqual(['node', 'global'])

    unsubscribeNode()
    unsubscribeGlobal()
  })

  it('isolates node listeners and queued global listeners from mutations', async () => {
    const nodeId = toNodeId('isolated-node-listener')
    const canonicalPosition = { x: 120, y: 110 }
    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      layout: createTestNode(nodeId),
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    const laterNodeListener = vi.fn()
    const globalListener = vi.fn()
    const stopMutating = layoutStore.onNodeChange(GRAPH, nodeId, (change) => {
      change.nodeIds.push(toNodeId('corrupted'))
      change.operation.type = 'deleteNode'
    })
    const stopNode = layoutStore.onNodeChange(GRAPH, nodeId, laterNodeListener)
    const stopGlobal = layoutStore.onChange(globalListener)

    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      position: canonicalPosition,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    expect(laterNodeListener).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeIds: [nodeId],
        operation: expect.objectContaining({
          type: 'moveNode',
          position: canonicalPosition
        })
      })
    )
    await Promise.resolve()
    expect(globalListener).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeIds: [nodeId],
        operation: expect.objectContaining({
          type: 'moveNode',
          position: canonicalPosition
        })
      })
    )
    stopMutating()
    stopNode()
    stopGlobal()
  })

  it('isolates global listeners from mutations', async () => {
    const nodeId = toNodeId('isolated-global-listener')
    const laterListener = vi.fn()
    const stopMutating = layoutStore.onChange((change) => {
      change.nodeIds.push(toNodeId('corrupted'))
      change.operation.type = 'deleteNode'
    })
    const stopLater = layoutStore.onChange(laterListener)

    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      layout: createTestNode(nodeId),
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })
    await Promise.resolve()

    expect(laterListener).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeIds: [nodeId],
        operation: expect.objectContaining({ type: 'createNode' })
      })
    )
    stopMutating()
    stopLater()
  })

  it('clears node-scoped listeners when the viewed graph changes', () => {
    const nodeId = toNodeId('reinit-node')
    const staleListener = vi.fn()

    layoutStore.onNodeChange(GRAPH, nodeId, staleListener)

    layoutStore.clearViewGeometry()
    canvasLayoutMutations().createNode(GRAPH, nodeId, {
      position: { x: 0, y: 0 },
      size: { width: 200, height: 100 },
      zIndex: 0,
      visible: true
    })

    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      position: { x: 10, y: 20 },
      timestamp: Date.now(),
      source: LayoutSource.Vue,
      actor: 'test'
    })

    expect(staleListener).not.toHaveBeenCalled()
  })

  it('defers global listener fan-out until the microtask boundary', async () => {
    const nodeId = toNodeId('global-fanout-node')
    const layout = createTestNode(nodeId)

    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    const globalChanges: LayoutChange[] = []
    const unsubscribe = layoutStore.onChange((change) => {
      globalChanges.push(change)
    })

    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      position: { x: 120, y: 110 },
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })
    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      position: { x: 150, y: 140 },
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    expect(globalChanges).toHaveLength(0)

    await Promise.resolve()

    expect(globalChanges).toHaveLength(2)
    expect(globalChanges.map((change) => change.operation.type)).toEqual([
      'moveNode',
      'moveNode'
    ])

    unsubscribe()
  })

  it('should emit change when batch updating node bounds', async () => {
    const nodeId = toNodeId('test-node-6')
    const layout = createTestNode(nodeId)

    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    const changes: LayoutChange[] = []
    const unsubscribe = layoutStore.onChange((change) => {
      changes.push(change)
    })

    const newBounds = { x: 40, y: 60, width: 220, height: 120 }
    layoutStore.batchUpdateNodeBounds(GRAPH, [{ nodeId, bounds: newBounds }])

    // onChange notifications are deferred to a microtask.
    await vi.waitFor(() => {
      expect(changes.length).toBeGreaterThan(0)
      const lastChange = changes[changes.length - 1]
      expect(lastChange.operation.type).toBe('batchUpdateBounds')
    })

    const lastChange = changes[changes.length - 1]
    if (lastChange.operation.type === 'batchUpdateBounds') {
      expect(lastChange.nodeIds).toContain(nodeId)
      expect(lastChange.operation.bounds[nodeId]).toEqual(newBounds)
    }

    const nodeRef = layoutStore.getNodeLayoutRef(GRAPH, nodeId)
    expect(nodeRef.value?.position).toEqual({ x: 40, y: 60 })
    expect(nodeRef.value?.size).toEqual({ width: 220, height: 120 })

    unsubscribe()
  })

  it('normalizes DOM-sourced heights before storing', () => {
    const nodeId = toNodeId('dom-node')
    const layout = createTestNode(nodeId)

    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    layoutStore.setSource(LayoutSource.DOM)
    layoutStore.batchUpdateNodeBounds(GRAPH, [
      {
        nodeId,
        bounds: {
          x: layout.bounds.x,
          y: layout.bounds.y,
          width: layout.size.width,
          height: layout.size.height + LiteGraph.NODE_TITLE_HEIGHT
        }
      }
    ])

    const nodeRef = layoutStore.getNodeLayoutRef(GRAPH, nodeId)
    expect(nodeRef.value?.size.height).toBe(layout.size.height)
    expect(nodeRef.value?.size.width).toBe(layout.size.width)
    expect(nodeRef.value?.position).toEqual(layout.position)
  })

  it('normalizes very small DOM-sourced heights safely', () => {
    const nodeId = toNodeId('small-dom-node')
    const layout = createTestNode(nodeId)
    layout.size.height = 10

    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    layoutStore.setSource(LayoutSource.DOM)
    layoutStore.batchUpdateNodeBounds(GRAPH, [
      {
        nodeId,
        bounds: {
          x: layout.bounds.x,
          y: layout.bounds.y,
          width: layout.size.width,
          height: layout.size.height + LiteGraph.NODE_TITLE_HEIGHT
        }
      }
    ])

    const nodeRef = layoutStore.getNodeLayoutRef(GRAPH, nodeId)
    expect(nodeRef.value?.size.height).toBeGreaterThanOrEqual(0)
  })

  it('handles undefined NODE_TITLE_HEIGHT without NaN results', () => {
    const nodeId = toNodeId('undefined-title-height')
    const layout = createTestNode(nodeId)

    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    const originalTitleHeightDescriptor = Object.getOwnPropertyDescriptor(
      LiteGraph,
      'NODE_TITLE_HEIGHT'
    )
    Object.defineProperty(LiteGraph, 'NODE_TITLE_HEIGHT', {
      configurable: true,
      value: undefined,
      writable: true
    })

    try {
      layoutStore.setSource(LayoutSource.DOM)
      layoutStore.batchUpdateNodeBounds(GRAPH, [
        {
          nodeId,
          bounds: {
            x: layout.bounds.x,
            y: layout.bounds.y,
            width: layout.size.width,
            height: layout.size.height
          }
        }
      ])

      const nodeRef = layoutStore.getNodeLayoutRef(GRAPH, nodeId)
      expect(nodeRef.value?.size.height).toBe(layout.size.height)
    } finally {
      if (originalTitleHeightDescriptor) {
        Object.defineProperty(
          LiteGraph,
          'NODE_TITLE_HEIGHT',
          originalTitleHeightDescriptor
        )
      }
    }
  })

  it.for([
    { type: 'input' as const, isInput: true },
    { type: 'output' as const, isInput: false }
  ])(
    'should preserve $type slot layouts when deleting a node',
    ({ type, isInput }) => {
      const nodeId = toNodeId('slot-persist-node')
      const layout = createTestNode(nodeId)

      layoutStore.applyOperation({
        type: 'createNode',
        entity: 'node',
        graphId: GRAPH,
        nodeId,
        layout,
        timestamp: Date.now(),
        source: LayoutSource.External,
        actor: 'test'
      })

      const slotKey = getSlotKey(nodeId, 0, isInput)
      const slotLayout: SlotLayout = {
        nodeId,
        index: 0,
        type,
        position: { x: 110, y: 120 },
        bounds: { x: 105, y: 115, width: 10, height: 10 }
      }
      layoutStore.batchUpdateSlotLayouts([{ key: slotKey, layout: slotLayout }])
      expect(layoutStore.getSlotLayout(slotKey)).toEqual(slotLayout)

      layoutStore.applyOperation({
        type: 'deleteNode',
        entity: 'node',
        graphId: GRAPH,
        nodeId,
        timestamp: Date.now(),
        source: LayoutSource.External,
        actor: 'test'
      })

      // Slot layout must survive so Vue-patched components can still drag links
      expect(layoutStore.getSlotLayout(slotKey)).toEqual(slotLayout)
    }
  )
})

describe('reroute layouts outlive an active-graph reseed', () => {
  const GRAPH_ID = createUuidv4()
  const REROUTE = toRerouteId(4242)
  const POSITION = { x: 372, y: 415 }

  function createReroute() {
    layoutStore.setSource(LayoutSource.Canvas)
    layoutStore.applyOperation({
      type: 'createReroute',
      entity: 'reroute',
      graphId: GRAPH_ID,
      rerouteId: REROUTE,
      position: POSITION,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })
  }

  it('survives the view change that follows subgraph navigation', () => {
    createReroute()

    layoutStore.clearViewGeometry()

    expect(layoutStore.getRerouteLayout(GRAPH_ID, REROUTE)?.position).toEqual(
      POSITION
    )
    expect(layoutStore.queryRerouteAtPoint(GRAPH_ID, POSITION)?.id).toBe(
      REROUTE
    )
  })

  it('drops layout and spatial index together on delete', () => {
    createReroute()

    layoutStore.setSource(LayoutSource.Canvas)
    layoutStore.applyOperation({
      type: 'deleteReroute',
      entity: 'reroute',
      graphId: GRAPH_ID,
      rerouteId: REROUTE,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    expect(layoutStore.getRerouteLayout(GRAPH_ID, REROUTE)).toBeNull()
    expect(layoutStore.queryRerouteAtPoint(GRAPH_ID, POSITION)).toBeNull()
  })
})

describe('reroute layout aliases', () => {
  const GRAPH_ID = createUuidv4()
  const REROUTE_ID = toRerouteId(4343)
  const POSITION = { x: 100, y: 100 }

  beforeEach(() => {
    layoutStore.resetForTests()
  })

  function layout() {
    return {
      id: REROUTE_ID,
      position: { ...POSITION },
      radius: 10,
      bounds: { x: 90, y: 90, width: 20, height: 20 }
    }
  }

  function expectCanonicalLayout(version: number): void {
    expect(layoutStore.getRerouteLayout(GRAPH_ID, REROUTE_ID)).toEqual(layout())
    expect(layoutStore.queryRerouteAtPoint(GRAPH_ID, POSITION)).toEqual(
      layout()
    )
    expect(
      layoutStore.queryRerouteAtPoint(GRAPH_ID, { x: 300, y: 300 })
    ).toBeNull()
    expect(layoutStore.geometryVersion).toBe(version)
  }

  it('does not retain the input object', () => {
    const input = layout()
    layoutStore.updateRerouteLayout(GRAPH_ID, REROUTE_ID, input)
    const version = layoutStore.geometryVersion

    input.position.x = 300
    input.bounds.x = 290

    expectCanonicalLayout(version)
  })

  it('does not expose the stored object through get', () => {
    layoutStore.updateRerouteLayout(GRAPH_ID, REROUTE_ID, layout())
    const version = layoutStore.geometryVersion
    const result = layoutStore.getRerouteLayout(GRAPH_ID, REROUTE_ID)!

    result.position.x = 300
    result.bounds.x = 290

    expectCanonicalLayout(version)
  })

  it('does not expose the stored object through spatial queries', () => {
    layoutStore.updateRerouteLayout(GRAPH_ID, REROUTE_ID, layout())
    const version = layoutStore.geometryVersion
    const result = layoutStore.queryRerouteAtPoint(GRAPH_ID, POSITION)!

    result.position.x = 300
    result.bounds.x = 290

    expectCanonicalLayout(version)
  })
})

describe('root-scoped group and reroute layouts', () => {
  const FIRST_GRAPH = createUuidv4()
  const SECOND_GRAPH = createUuidv4()
  const GROUP_ID = toGroupId(77)
  const REROUTE_ID = toRerouteId(88)

  function apply(operation: LayoutOperation): void {
    layoutStore.applyOperation(operation)
  }

  function metadata() {
    return {
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    } as const
  }

  it('isolates colliding local IDs across reads, moves, queries, deletes, and clears', () => {
    for (const [graphId, offset] of [
      [FIRST_GRAPH, 10],
      [SECOND_GRAPH, 100]
    ] as const) {
      apply({
        ...metadata(),
        type: 'createGroup',
        entity: 'group',
        graphId,
        groupId: GROUP_ID,
        layout: {
          id: GROUP_ID,
          position: { x: offset, y: offset },
          size: { width: 40, height: 40 }
        }
      })
      apply({
        ...metadata(),
        type: 'createReroute',
        entity: 'reroute',
        graphId,
        rerouteId: REROUTE_ID,
        position: { x: offset + 5, y: offset + 5 }
      })
    }

    apply({
      ...metadata(),
      type: 'setGroupBounds',
      entity: 'group',
      graphId: FIRST_GRAPH,
      groupId: GROUP_ID,
      position: { x: 20, y: 30 },
      size: { width: 50, height: 60 }
    })
    apply({
      ...metadata(),
      type: 'moveReroute',
      entity: 'reroute',
      graphId: FIRST_GRAPH,
      rerouteId: REROUTE_ID,
      position: { x: 25, y: 35 }
    })

    expect(layoutStore.getGroupLayout(FIRST_GRAPH, GROUP_ID)?.position).toEqual(
      { x: 20, y: 30 }
    )
    expect(
      layoutStore.getGroupLayout(SECOND_GRAPH, GROUP_ID)?.position
    ).toEqual({ x: 100, y: 100 })
    expect(layoutStore.getAllGroups(FIRST_GRAPH).value.size).toBe(1)
    expect(layoutStore.getAllGroups(SECOND_GRAPH).value.size).toBe(1)
    expect(
      layoutStore.getRerouteLayout(FIRST_GRAPH, REROUTE_ID)?.position
    ).toEqual({ x: 25, y: 35 })
    expect(
      layoutStore.getRerouteLayout(SECOND_GRAPH, REROUTE_ID)?.position
    ).toEqual({ x: 105, y: 105 })
    expect(
      layoutStore.queryRerouteAtPoint(FIRST_GRAPH, { x: 25, y: 35 })?.id
    ).toBe(REROUTE_ID)
    expect(
      layoutStore.queryRerouteAtPoint(SECOND_GRAPH, { x: 25, y: 35 })
    ).toBeNull()

    apply({
      ...metadata(),
      type: 'deleteGroup',
      entity: 'group',
      graphId: FIRST_GRAPH,
      groupId: GROUP_ID
    })
    apply({
      ...metadata(),
      type: 'deleteReroute',
      entity: 'reroute',
      graphId: FIRST_GRAPH,
      rerouteId: REROUTE_ID
    })
    expect(layoutStore.getGroupLayout(FIRST_GRAPH, GROUP_ID)).toBeNull()
    expect(layoutStore.getRerouteLayout(FIRST_GRAPH, REROUTE_ID)).toBeNull()
    expect(layoutStore.getGroupLayout(SECOND_GRAPH, GROUP_ID)).not.toBeNull()
    expect(
      layoutStore.getRerouteLayout(SECOND_GRAPH, REROUTE_ID)
    ).not.toBeNull()
  })
})
describe('root-scoped node layouts', () => {
  const FIRST_GRAPH = createUuidv4()
  const SECOND_GRAPH = createUuidv4()
  const GROUP_ID = toGroupId(3)
  const REROUTE_ID = toRerouteId(4)

  beforeEach(() => {
    layoutStore.resetForTests()
  })

  function seedNode(graphId: UUID, nodeId: NodeId, x: number): void {
    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId,
      nodeId,
      layout: {
        id: nodeId,
        position: { x, y: 0 },
        size: { width: 10, height: 10 },
        zIndex: 0,
        visible: true,
        bounds: { x, y: 0, width: 10, height: 10 }
      },
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })
  }

  it('isolates colliding node IDs across root graphs', () => {
    const nodeId = toNodeId('1')
    seedNode(FIRST_GRAPH, nodeId, 10)
    seedNode(SECOND_GRAPH, nodeId, 100)

    layoutStore.applyOperation({
      type: 'deleteNode',
      entity: 'node',
      graphId: FIRST_GRAPH,
      nodeId,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    expect(layoutStore.getNodeLayoutRef(FIRST_GRAPH, nodeId).value).toBeNull()
    expect(
      layoutStore.getNodeLayoutRef(SECOND_GRAPH, nodeId).value?.position
    ).toEqual({ x: 100, y: 0 })
  })

  it('keys nodes whose IDs contain the scope separator', () => {
    const nodeId = toNodeId('sub:7')
    seedNode(FIRST_GRAPH, nodeId, 42)

    expect(
      layoutStore.getNodeLayoutRef(FIRST_GRAPH, nodeId).value?.position
    ).toEqual({ x: 42, y: 0 })
    expect(layoutStore.getNodeLayoutRef(SECOND_GRAPH, nodeId).value).toBeNull()
  })

  it('clearGraph drops one root graph and leaves the other intact', () => {
    const nodeId = toNodeId('1')
    seedNode(FIRST_GRAPH, nodeId, 10)
    seedNode(SECOND_GRAPH, nodeId, 100)

    for (const graphId of [FIRST_GRAPH, SECOND_GRAPH]) {
      layoutStore.applyOperation({
        type: 'createGroup',
        entity: 'group',
        graphId,
        groupId: GROUP_ID,
        layout: {
          id: GROUP_ID,
          position: { x: 0, y: 0 },
          size: { width: 5, height: 5 }
        },
        timestamp: Date.now(),
        source: LayoutSource.Canvas,
        actor: 'test'
      })
      layoutStore.applyOperation({
        type: 'createReroute',
        entity: 'reroute',
        graphId,
        rerouteId: REROUTE_ID,
        position: { x: 0, y: 0 },
        timestamp: Date.now(),
        source: LayoutSource.Canvas,
        actor: 'test'
      })
    }

    layoutStore.clearGraph(FIRST_GRAPH)

    expect(layoutStore.getNodeLayoutRef(FIRST_GRAPH, nodeId).value).toBeNull()
    expect(layoutStore.getGroupLayout(FIRST_GRAPH, GROUP_ID)).toBeNull()
    expect(layoutStore.getRerouteLayout(FIRST_GRAPH, REROUTE_ID)).toBeNull()

    expect(
      layoutStore.getNodeLayoutRef(SECOND_GRAPH, nodeId).value
    ).not.toBeNull()
    expect(layoutStore.getGroupLayout(SECOND_GRAPH, GROUP_ID)).not.toBeNull()
    expect(
      layoutStore.getRerouteLayout(SECOND_GRAPH, REROUTE_ID)
    ).not.toBeNull()
  })
})

describe('layoutStore getNodeLayoutRef setter', () => {
  beforeEach(() => {
    layoutStore.resetForTests()
  })

  const REF_NODE = toNodeId('ref-node')

  function baseLayout(): NodeLayout {
    return {
      id: REF_NODE,
      position: { x: 10, y: 20 },
      size: { width: 100, height: 50 },
      zIndex: 0,
      visible: true,
      bounds: { x: 10, y: 20, width: 100, height: 50 }
    }
  }

  it('creates a node when setter receives a layout for an unknown id', () => {
    const ref = layoutStore.getNodeLayoutRef(GRAPH, REF_NODE)
    const layout = baseLayout()
    expect(ref.value).toBeNull()

    const operations = getOperationsAddedBy(() => {
      ref.value = layout
    })

    expectSingleOperation(operations, {
      type: 'createNode',
      nodeId: REF_NODE,
      layout
    })
    expect(ref.value).toEqual(layout)
  })

  it.for<{
    name: string
    nextLayout: NodeLayout
    expectedOperation: Record<string, unknown>
  }>([
    {
      name: 'moveNode',
      nextLayout: {
        ...baseLayout(),
        position: { x: 99, y: 88 },
        bounds: { x: 99, y: 88, width: 100, height: 50 }
      },
      expectedOperation: {
        type: 'moveNode',
        nodeId: REF_NODE,
        position: { x: 99, y: 88 }
      }
    },
    {
      name: 'resizeNode',
      nextLayout: {
        ...baseLayout(),
        size: { width: 200, height: 80 },
        bounds: { x: 10, y: 20, width: 200, height: 80 }
      },
      expectedOperation: {
        type: 'resizeNode',
        nodeId: REF_NODE,
        size: { width: 200, height: 80 }
      }
    },
    {
      name: 'setNodeZIndex',
      nextLayout: { ...baseLayout(), zIndex: 5 },
      expectedOperation: {
        type: 'setNodeZIndex',
        nodeId: REF_NODE,
        zIndex: 5
      }
    }
  ])(
    'emits a $name operation for layout-only updates',
    ({ nextLayout, expectedOperation }) => {
      const ref = layoutStore.getNodeLayoutRef(GRAPH, REF_NODE)
      ref.value = baseLayout()

      const operations = getOperationsAddedBy(() => {
        ref.value = nextLayout
      })

      expectSingleOperation(operations, expectedOperation)
      expect(ref.value).toEqual(nextLayout)
    }
  )

  it('ignores a null assignment; deletion goes through layoutMutations.deleteNode', () => {
    const ref = layoutStore.getNodeLayoutRef(GRAPH, REF_NODE)
    const layout = baseLayout()
    ref.value = layout

    const operations = getOperationsAddedBy(() => {
      ref.value = null
    })

    expect(operations).toEqual([])
    expect(ref.value).toEqual(layout)
  })
})

describe('layoutStore link layout updates', () => {
  beforeEach(() => {
    layoutStore.resetForTests()
  })

  const stubPath = () => fromPartial<Path2D>({})
  const baseLink = (path = stubPath()) => ({
    id: toLinkId(1),
    path,
    bounds: { x: 0, y: 0, width: 50, height: 50 },
    centerPos: { x: 25, y: 25 },
    sourceNodeId: toNodeId('a'),
    targetNodeId: toNodeId('b'),
    sourceSlot: 0,
    targetSlot: 0
  })

  it('updateLinkLayout short-circuits when bounds and centerPos are unchanged', () => {
    layoutStore.updateLinkLayout(toLinkId(1), baseLink())
    const newPath = stubPath()

    layoutStore.updateLinkLayout(toLinkId(1), baseLink(newPath))

    expect(layoutStore.getLinkLayout(toLinkId(1))?.path).toBe(newPath)
  })

  it('updateLinkLayout replaces stored layout when bounds change', () => {
    layoutStore.updateLinkLayout(toLinkId(1), baseLink())
    const moved = {
      ...baseLink(),
      bounds: { x: 10, y: 10, width: 50, height: 50 }
    }

    layoutStore.updateLinkLayout(toLinkId(1), moved)

    expect(layoutStore.getLinkLayout(toLinkId(1))?.bounds.x).toBe(10)
  })

  it('deleteLinkLayout removes the link and its segment layouts', () => {
    layoutStore.updateLinkLayout(toLinkId(1), baseLink())
    layoutStore.updateLinkSegmentLayout(toLinkId(1), null, {
      path: stubPath(),
      bounds: { x: 0, y: 0, width: 5, height: 5 },
      centerPos: { x: 1, y: 1 }
    })

    expect(layoutStore.queryLinkSegmentAtPoint({ x: 1, y: 1 })).toEqual({
      linkId: toLinkId(1),
      rerouteId: null
    })

    layoutStore.deleteLinkLayout(toLinkId(1))

    expect(layoutStore.getLinkLayout(toLinkId(1))).toBeNull()
    expect(layoutStore.queryLinkSegmentAtPoint({ x: 1, y: 1 })).toBeNull()
  })
})
