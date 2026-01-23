
import { Rectangle } from '@/lib/litegraph/src/infrastructure/Rectangle'
import type {
  LGraphGroup,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import type { Positionable } from '@/lib/litegraph/src/interfaces'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'

/**
 * Creates a mock LGraphNode with minimal required properties
 */
export function createMockLGraphNode(
  overrides: Partial<LGraphNode> | Record<string, unknown> = {}
): LGraphNode {
  const partial = {
    id: 1,
    pos: [0, 0],
    size: [100, 100],
    title: 'Test Node',
    mode: LGraphEventMode.ALWAYS,
    ...(overrides as Partial<LGraphNode>)
  }
  return partial as LGraphNode
}

/**
 * Creates a mock Positionable object
 */
export function createMockPositionable(
  overrides: Partial<Positionable> = {}
): Positionable {
  return {
    id: 1,
    pos: [0, 0],
    ...overrides
  } as Positionable
}

/**
 * Creates a mock LGraphGroup with minimal required properties
 */
export function createMockLGraphGroup(
  overrides: Partial<LGraphGroup> = {}
): LGraphGroup {
  return {
    id: 1,
    pos: [0, 0],
    boundingRect: new Rectangle(0, 0, 100, 100),
    ...overrides
  } as LGraphGroup
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
