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

const DEFAULT_STATE: Readonly<NodeImageState> = Object.freeze({
  ...createDefaultState(),
  imgs: Object.freeze([]) as unknown as HTMLImageElement[],
  imageRects: Object.freeze([]) as unknown as Rect[]
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
    const simpleProperties: (keyof NodeImageState)[] = [
      'imageRects',
      'pointerDown',
      'overIndex',
      'imageIndex'
    ]

    const nodeRecord = node as unknown as Record<string, unknown>

    for (const prop of simpleProperties) {
      const existingValue = nodeRecord[prop]

      Object.defineProperty(node, prop, {
        get() {
          const locatorId = getNodeLocatorId(node)
          if (!locatorId) return undefined
          return (peekState(locatorId) ?? DEFAULT_STATE)[prop]
        },
        set(value: unknown) {
          const locatorId = getNodeLocatorId(node)
          if (!locatorId) return
          setStateProperty(
            locatorId,
            prop,
            value as NodeImageState[typeof prop]
          )
        },
        configurable: true,
        enumerable: true
      })

      if (existingValue !== undefined) {
        nodeRecord[prop] = existingValue
      }
    }

    // imgs needs special handling: return undefined when empty to preserve
    // node.imgs?.length optional chaining semantics
    const existingImgs = node.imgs

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

    if (existingImgs !== undefined) {
      node.imgs = existingImgs
    }
  }

  return {
    getState,
    clearState,
    clearAll,
    installPropertyProjection
  }
})
