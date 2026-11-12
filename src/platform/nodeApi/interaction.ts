import { ComfyApiError } from './errors'
import type { NodeHandle } from './nodeHandle'
import type { Unsubscribe } from './widgetHandle'

export interface NodeMoveEvent {
  readonly node: NodeHandle
  readonly position: { readonly x: number; readonly y: number }
}

export interface NodeMoveTarget {
  readonly rootGraphId: string
  readonly nodeId: string
}

/** Supplies document-scoped movement from the renderer. */
export type NodeMoveSource = (
  onMove: (target: NodeMoveTarget, position: { x: number; y: number }) => void
) => Unsubscribe

/** Reports a completed drag with every document-scoped node it moved. */
export type NodeDragEndSource = (
  onDragEnd: (targets: readonly NodeMoveTarget[]) => void
) => Unsubscribe

let source: NodeMoveSource | undefined
let dragEndSource: NodeDragEndSource | undefined

export function provideNodeMoveSource(provider: NodeMoveSource): void {
  source = provider
}

export function provideNodeDragEndSource(provider: NodeDragEndSource): void {
  dragEndSource = provider
}

/** Test seam. */
export function resetNodeMoveSource(): void {
  source = undefined
  dragEndSource = undefined
}

export function createNodeMoveObserver(
  handleFor: (target: NodeMoveTarget) => NodeHandle | undefined
) {
  return function onNodeMoved(
    listener: (event: NodeMoveEvent) => void
  ): Unsubscribe {
    if (!source) {
      throw new ComfyApiError(
        'Node movement is unavailable: the host has not provided a source.'
      )
    }
    return source((target, position) => {
      const node = handleFor(target)
      if (!node || node.isDeleted) return
      listener({ node, position })
    })
  }
}

/** Observes completed Nodes 2.0 drags. */
export function createNodeDragEndObserver(
  handleFor: (target: NodeMoveTarget) => NodeHandle | undefined
) {
  return function onNodeDragEnd(
    listener: (nodes: readonly NodeHandle[]) => void
  ): Unsubscribe {
    if (!dragEndSource) {
      throw new ComfyApiError(
        'Drag completion is unavailable: the host has not provided a source.'
      )
    }
    return dragEndSource((targets) => {
      const nodes = targets
        .map(handleFor)
        .filter((node): node is NodeHandle => !!node && !node.isDeleted)
      if (nodes.length) listener(nodes)
    })
  }
}
