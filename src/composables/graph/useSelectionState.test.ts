import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { useSelectionState } from '@/composables/graph/useSelectionState'
import type { Positionable } from '@/lib/litegraph/src/interfaces'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { isImageNode, isLGraphNode } from '@/utils/litegraphUtil'
import { filterOutputNodes } from '@/utils/nodeFilterUtil'

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: vi.fn(),
  isImageNode: vi.fn(),
  isLoad3dNode: vi.fn(() => false)
}))

vi.mock('@/utils/nodeFilterUtil', () => ({
  filterOutputNodes: vi.fn()
}))

interface TestNodeConfig {
  type?: string
  mode?: LGraphEventMode
  flags?: { collapsed?: boolean }
  pinned?: boolean
  removable?: boolean
}

class MockPositionable implements Positionable {
  readonly id = 0
  readonly pos: [number, number] = [0, 0]
  readonly boundingRect = [0, 0, 100, 100] as const
  type: string
  mode: LGraphEventMode
  flags?: { collapsed?: boolean }
  pinned?: boolean
  removable?: boolean

  constructor(config: TestNodeConfig = {}) {
    this.type = config.type ?? 'TestNode'
    this.mode = config.mode ?? LGraphEventMode.ALWAYS
    this.flags = config.flags
    this.pinned = config.pinned
    this.removable = config.removable
  }

  move(): void {}
  snapToGrid(): boolean {
    return false
  }
  isSubgraphNode(): boolean {
    return false
  }
}

function createTestNode(config: TestNodeConfig = {}): MockPositionable {
  return new MockPositionable(config)
}

class MockNonNode implements Positionable {
  readonly id = 0
  readonly pos: [number, number] = [0, 0]
  readonly boundingRect = [0, 0, 100, 100] as const
  readonly isNode = false
  type: string

  constructor(type: string) {
    this.type = type
  }

  move(): void {}
  snapToGrid(): boolean {
    return false
  }
}

const mockComment = new MockNonNode('comment')
const mockConnection = new MockNonNode('connection')

describe('useSelectionState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))

    vi.mocked(isLGraphNode).mockImplementation((item: unknown) => {
      if (typeof item !== 'object' || item === null) return false
      return !('isNode' in item && item.isNode === false)
    })
    vi.mocked(isImageNode).mockReturnValue(false)
    vi.mocked(filterOutputNodes).mockImplementation((nodes) =>
      nodes.filter((n) => n.type === 'OutputNode')
    )
  })

  describe('Selection Detection', () => {
    test('should return false when nothing selected', () => {
      const { hasAnySelection } = useSelectionState()
      expect(hasAnySelection.value).toBe(false)
    })

    test('should return true when items selected', () => {
      const canvasStore = useCanvasStore()
      const node1 = createTestNode()
      const node2 = createTestNode()
      canvasStore.selectedItems.push(node1, node2)

      const { hasAnySelection } = useSelectionState()
      expect(hasAnySelection.value).toBe(true)
    })
  })

  describe('Node Type Filtering', () => {
    test('should pick only LGraphNodes from mixed selections', () => {
      const canvasStore = useCanvasStore()
      const graphNode = createTestNode()
      canvasStore.selectedItems.push(graphNode, mockComment, mockConnection)

      const { selectedNodes } = useSelectionState()
      expect(selectedNodes.value).toHaveLength(1)
      expect(selectedNodes.value[0]).toEqual(graphNode)
    })
  })

  describe('Node State Computation', () => {
    test('should detect bypassed nodes', () => {
      const canvasStore = useCanvasStore()
      const bypassedNode = createTestNode({ mode: LGraphEventMode.BYPASS })
      canvasStore.selectedItems.push(bypassedNode)

      const { selectedNodes } = useSelectionState()
      const isBypassed = selectedNodes.value.some(
        (n) => n.mode === LGraphEventMode.BYPASS
      )
      expect(isBypassed).toBe(true)
    })

    test('should detect pinned/collapsed states', () => {
      const canvasStore = useCanvasStore()
      const pinnedNode = createTestNode({ pinned: true })
      const collapsedNode = createTestNode({ flags: { collapsed: true } })
      canvasStore.selectedItems.push(pinnedNode, collapsedNode)

      const { selectedNodes } = useSelectionState()
      const isPinned = selectedNodes.value.some((n) => n.pinned === true)
      const isCollapsed = selectedNodes.value.some(
        (n) => n.flags?.collapsed === true
      )
      const isBypassed = selectedNodes.value.some(
        (n) => n.mode === LGraphEventMode.BYPASS
      )
      expect(isPinned).toBe(true)
      expect(isCollapsed).toBe(true)
      expect(isBypassed).toBe(false)
    })

    test('should provide non-reactive state computation', () => {
      const canvasStore = useCanvasStore()
      const node = createTestNode({ pinned: true })
      canvasStore.selectedItems.push(node)

      const { selectedNodes } = useSelectionState()
      const isPinned = selectedNodes.value.some((n) => n.pinned === true)
      const isCollapsed = selectedNodes.value.some(
        (n) => n.flags?.collapsed === true
      )
      const isBypassed = selectedNodes.value.some(
        (n) => n.mode === LGraphEventMode.BYPASS
      )

      expect(isPinned).toBe(true)
      expect(isCollapsed).toBe(false)
      expect(isBypassed).toBe(false)

      canvasStore.selectedItems.length = 0
      const { selectedNodes: newSelectedNodes } = useSelectionState()
      const newIsPinned = newSelectedNodes.value.some((n) => n.pinned === true)
      expect(newIsPinned).toBe(false)
    })
  })
})
