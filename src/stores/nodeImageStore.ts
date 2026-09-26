import { defineStore } from 'pinia'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { Point, Rect } from '@/lib/litegraph/src/interfaces'
import type { NodeLocatorId } from '@/types/nodeIdentification'

interface PointerDownState {
  index: number | null
  pos: Point
}

interface NodeImageState {
  imgs: HTMLImageElement[]
  imageIndex: number | null
  imageRects: Rect[]
  pointerDown: PointerDownState | null
  overIndex: number | null
}

function createDefaultState(): NodeImageState {
  return {
    imgs: [],
    imageIndex: null,
    imageRects: [],
    pointerDown: null,
    overIndex: null
  }
}

type ReadonlyNodeImageState = Readonly<
  Omit<NodeImageState, 'imgs' | 'imageRects'>
> & {
  readonly imgs: readonly HTMLImageElement[]
  readonly imageRects: readonly Rect[]
}

const DEFAULT_STATE: ReadonlyNodeImageState = Object.freeze({
  imgs: Object.freeze([]),
  imageIndex: null,
  imageRects: Object.freeze([]),
  pointerDown: null,
  overIndex: null
})

/**
 * Module-scoped resolver for converting nodes to locator IDs.
 * Set once during app bootstrap via {@link setNodeLocatorResolver} to
 * avoid a circular dependency: LGraph → nodeImageStore → workflowStore → app → litegraph.
 */
let _nodeLocatorResolver:
  | ((node: LGraphNode) => NodeLocatorId | undefined)
  | undefined

export function setNodeLocatorResolver(
  resolver: (node: LGraphNode) => NodeLocatorId | undefined
): void {
  _nodeLocatorResolver = resolver
}

function getNodeLocatorId(node: LGraphNode): NodeLocatorId | undefined {
  return _nodeLocatorResolver?.(node)
}

export const useNodeImageStore = defineStore('nodeImage', () => {
  const state = new Map<NodeLocatorId, NodeImageState>()

  function getState(locatorId: NodeLocatorId): NodeImageState {
    const existing = state.get(locatorId)
    if (existing) return existing

    const entry = createDefaultState()
    state.set(locatorId, entry)
    return entry
  }

  function peekState(locatorId: NodeLocatorId): NodeImageState | undefined {
    return state.get(locatorId)
  }

  function clearState(locatorId: NodeLocatorId): void {
    state.delete(locatorId)
  }

  function clearAll(): void {
    state.clear()
  }

  function setStateProperty<K extends keyof NodeImageState>(
    locatorId: NodeLocatorId,
    prop: K,
    value: NodeImageState[K]
  ): void {
    getState(locatorId)[prop] = value
  }

  function installPropertyProjection(node: LGraphNode): void {
    if (!_nodeLocatorResolver) return

    const simpleProperties: (keyof NodeImageState)[] = [
      'imageRects',
      'pointerDown',
      'overIndex',
      'imageIndex'
    ]

    const existing = {
      imgs: node.imgs,
      imageIndex: node.imageIndex,
      imageRects: node.imageRects,
      pointerDown: node.pointerDown,
      overIndex: node.overIndex
    }

    for (const prop of simpleProperties) {
      Object.defineProperty(node, prop, {
        get() {
          const locatorId = getNodeLocatorId(node)
          if (!locatorId) return undefined
          return (peekState(locatorId) ?? DEFAULT_STATE)[prop]
        },
        set(value: NodeImageState[typeof prop]) {
          const locatorId = getNodeLocatorId(node)
          if (!locatorId) return
          setStateProperty(locatorId, prop, value)
        },
        configurable: true,
        enumerable: true
      })
    }

    // imgs needs special handling: return undefined when empty to preserve
    // node.imgs?.length optional chaining semantics
    Object.defineProperty(node, 'imgs', {
      get() {
        const locatorId = getNodeLocatorId(node)
        if (!locatorId) return undefined
        const s = peekState(locatorId)
        return s?.imgs.length ? s.imgs : undefined
      },
      set(value: HTMLImageElement[] | undefined) {
        const locatorId = getNodeLocatorId(node)
        if (!locatorId) return
        getState(locatorId).imgs = value ?? []
      },
      configurable: true,
      enumerable: true
    })

    if (existing.imageRects !== undefined) node.imageRects = existing.imageRects
    if (existing.pointerDown !== undefined)
      node.pointerDown = existing.pointerDown
    if (existing.overIndex !== undefined) node.overIndex = existing.overIndex
    if (existing.imageIndex !== undefined) node.imageIndex = existing.imageIndex
    if (existing.imgs !== undefined) node.imgs = existing.imgs
  }

  return {
    getState,
    clearState,
    clearAll,
    installPropertyProjection
  }
})
