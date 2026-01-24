import type { Positionable } from '@/lib/litegraph/src/interfaces'
import { Rectangle } from '@/lib/litegraph/src/infrastructure/Rectangle'
import type {
  LGraphCanvas,
  LGraphGroup,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { vi } from 'vitest'

/**
 * Creates a mock LGraphNode with minimal required properties
 */
export function createMockLGraphNode(
  overrides: Partial<LGraphNode> | Record<string, unknown> = {}
): LGraphNode {
  const partial: Partial<LGraphNode> = {
    id: 1,
    pos: [0, 0],
    size: [100, 100],
    title: 'Test Node',
    mode: LGraphEventMode.ALWAYS,
    ...(overrides as Partial<LGraphNode>)
  }
  return partial as Partial<LGraphNode> as LGraphNode
}

/**
 * Creates a mock Positionable object
 */
export function createMockPositionable(
  overrides: Partial<Positionable> = {}
): Positionable {
  const partial: Partial<Positionable> = {
    id: 1,
    pos: [0, 0],
    ...overrides
  }
  return partial as Partial<Positionable> as Positionable
}

/**
 * Creates a mock LGraphGroup with minimal required properties
 */
export function createMockLGraphGroup(
  overrides: Partial<LGraphGroup> = {}
): LGraphGroup {
  const partial: Partial<LGraphGroup> = {
    id: 1,
    pos: [0, 0],
    boundingRect: new Rectangle(0, 0, 100, 100),
    ...overrides
  }
  return partial as Partial<LGraphGroup> as LGraphGroup
}

/**
 * Creates a mock SubgraphNode with sub-nodes
 */
export function createMockSubgraphNode(
  subNodes: LGraphNode[],
  overrides: Partial<LGraphNode> | Record<string, unknown> = {}
): LGraphNode {
  const baseNode = createMockLGraphNode(overrides)
  return Object.assign(baseNode, {
    isSubgraphNode: () => true,
    subgraph: {
      nodes: subNodes
    }
  })
}

/**
 * Creates a mock LGraphCanvas with minimal required properties for testing
 */
export function createMockCanvas(
  overrides: Partial<LGraphCanvas> = {}
): LGraphCanvas {
  return {
    setDirty: vi.fn(),
    state: {
      selectionChanged: false
    },
    ...overrides
  } as LGraphCanvas
}
