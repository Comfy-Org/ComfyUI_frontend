import type {
  INodeInputSlot,
  INodeOutputSlot,
  Positionable
} from '@/lib/litegraph/src/interfaces'
import { Rectangle } from '@/lib/litegraph/src/infrastructure/Rectangle'
import type {
  CanvasPointerEvent,
  LGraph,
  LGraphCanvas,
  LGraphGroup,
  LinkNetwork
} from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode, LGraphNode } from '@/lib/litegraph/src/litegraph'
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

/**
 * Creates a mock LGraph with trigger function
 */
export function createMockLGraph(overrides: Partial<LGraph> = {}): LGraph {
  return {
    trigger: vi.fn(),
    ...overrides
  } as LGraph
}

/**
 * Creates a mock CanvasPointerEvent
 */
export function createMockCanvasPointerEvent(
  canvasX: number,
  canvasY: number,
  overrides: Partial<CanvasPointerEvent> = {}
): CanvasPointerEvent {
  return {
    canvasX,
    canvasY,
    ...overrides
  } as CanvasPointerEvent
}

/**
 * Creates a mock CanvasRenderingContext2D
 */
export function createMockCanvasRenderingContext2D(
  overrides: Partial<CanvasRenderingContext2D> = {}
): CanvasRenderingContext2D {
  const partial: Partial<CanvasRenderingContext2D> = {
    measureText: vi.fn(() => ({ width: 10 }) as TextMetrics),
    ...overrides
  }
  return partial as CanvasRenderingContext2D
}

/**
 * Creates a mock LinkNetwork
 */
export function createMockLinkNetwork(
  overrides: Partial<LinkNetwork> = {}
): LinkNetwork {
  return {
    ...overrides
  } as LinkNetwork
}

/**
 * Creates a mock INodeInputSlot
 */
export function createMockNodeInputSlot(
  overrides: Partial<INodeInputSlot> = {}
): INodeInputSlot {
  return {
    ...overrides
  } as INodeInputSlot
}

/**
 * Creates a mock INodeOutputSlot
 */
export function createMockNodeOutputSlot(
  overrides: Partial<INodeOutputSlot> = {}
): INodeOutputSlot {
  return {
    ...overrides
  } as INodeOutputSlot
}

/**
 * Creates a LGraphNode with Float64Array boundingRect for testing position methods
 */
export function createMockLGraphNodeWithArrayBoundingRect(
  name: string
): LGraphNode {
  const node = new LGraphNode(name)
  // The actual node has a Float64Array boundingRect, we just need to type it correctly
  return node
}

/**
 * Creates a mock FileList from an array of files
 */
export function createMockFileList(files: File[]): FileList {
  const fileList = {
    ...files,
    length: files.length,
    item: (index: number) => files[index] ?? null,
    [Symbol.iterator]: function* () {
      yield* files
    }
  }
  return fileList as FileList
}
