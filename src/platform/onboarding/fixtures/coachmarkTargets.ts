import type { RectTarget } from '../coachmarkRegistry'

/** An element with a non-zero measured rect, so it counts as laid out. */
export function laidOut(rect = new DOMRect(10, 10, 80, 30)): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => rect
  return el
}

export function hidden(): HTMLElement {
  return laidOut(new DOMRect(0, 0, 0, 0))
}

/** A laid-out node in the document, addressable by `data-node-id`. */
export function mountNode(nodeId = '7'): HTMLElement {
  const node = laidOut()
  node.setAttribute('data-node-id', nodeId)
  document.body.append(node)
  return node
}

export interface TestRectTarget extends RectTarget {
  move: () => void
  listenerCount: () => number
}

/** Stands in for a canvas node: reports its own rect, moves with the camera. */
export function movingTarget(nodeId = '7'): TestRectTarget {
  const listeners = new Set<() => void>()
  return {
    getRect: () =>
      document
        .querySelector<HTMLElement>(`[data-node-id="${nodeId}"]`)
        ?.getBoundingClientRect() ?? null,
    onMove: (notify) => {
      listeners.add(notify)
      return () => listeners.delete(notify)
    },
    move: () => listeners.forEach((notify) => notify()),
    listenerCount: () => listeners.size
  }
}
