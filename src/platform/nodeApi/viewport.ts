/**
 * "The view moved" — pan, zoom, or the canvas being resized.
 *
 * A pack anchoring a floating panel to a node needs to reposition it whenever
 * the view changes. Without this the only options are polling every frame, or
 * chaining onto a renderer draw callback — which is what packs did, and which
 * ties them to the renderer they happened to be written against.
 *
 * Deliberately carries no payload. Where a node *is* on screen is
 * `node.getScreenRect()`; this only says that the answer may have changed, so
 * the pan offset and zoom factor stay the renderer's business.
 */
import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { extensionValue } from '@/lib/litegraph/src/utils/extensionValue'

import type { Unsubscribe } from './widgetHandle'

type Listener = () => void

const listeners = new Set<Listener>()
let chained: object | undefined

/** Chains onto the view's own change hook, preserving whoever holds it. */
function chainOnto(canvas: LGraphCanvas): void {
  const { ds } = canvas
  // One chain per DragAndScale. The canvas is replaced on some graph swaps, so
  // the identity is what is tracked rather than a boolean.
  if (chained === ds) return
  chained = ds
  const previous = ds.onChanged
  ds.onChanged = function (this: unknown, scale, offset) {
    previous?.call(this as never, scale, offset)
    for (const listener of listeners) listener()
  }
}

function tryChain(): void {
  const canvas = extensionValue(LGraphCanvas.active_canvas)
  if (canvas) chainOnto(canvas)
}

function announce(): void {
  tryChain()
  for (const listener of listeners) listener()
}

export function createViewportObserver() {
  return (listener: Listener): Unsubscribe => {
    listeners.add(listener)

    // Installed on subscribe rather than at module load: a pack may subscribe
    // before a canvas exists, and re-trying here costs nothing.
    tryChain()
    if (listeners.size === 1) {
      window.addEventListener('resize', announce)
    }

    return () => {
      listeners.delete(listener)
      if (!listeners.size) window.removeEventListener('resize', announce)
    }
  }
}

/** Test seam — drops chaining state so a fresh canvas can be observed. */
export function resetViewportObserver(): void {
  listeners.clear()
  chained = undefined
  window.removeEventListener('resize', announce)
}
