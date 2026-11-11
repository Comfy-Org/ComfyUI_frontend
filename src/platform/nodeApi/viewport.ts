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
import { reportError } from '@comfyorg/telemetry/reportError'
import type { DragAndScale } from '@/lib/litegraph/src/litegraph'
import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { extensionValue } from '@/lib/litegraph/src/utils/extensionValue'

import type { Unsubscribe } from './widgetHandle'

type Listener = () => void
type ChangeHandler = NonNullable<DragAndScale['onChanged']>

interface Chain {
  readonly ds: DragAndScale
  readonly previous: ChangeHandler | undefined
  readonly handler: ChangeHandler
}

const listeners = new Set<Listener>()
let chained: Chain | undefined

function notifyListeners(): void {
  for (const listener of listeners) {
    try {
      listener()
    } catch (error) {
      reportError(error, {
        errorType: 'node_api_viewport_listener_failure',
        surface: 'graph'
      })
    }
  }
}

function unchain(): void {
  if (chained && chained.ds.onChanged === chained.handler) {
    chained.ds.onChanged = chained.previous
  }
  chained = undefined
}

function chainOnto(canvas: LGraphCanvas): void {
  const { ds } = canvas
  if (chained?.ds === ds) return
  unchain()
  const previous = ds.onChanged
  const handler: ChangeHandler = function (this: unknown, scale, offset) {
    previous?.call(this as never, scale, offset)
    if (chained?.handler === handler) notifyListeners()
  }
  ds.onChanged = handler
  chained = { ds, previous, handler }
}

function tryChain(): void {
  const canvas = extensionValue(LGraphCanvas.active_canvas)
  if (canvas) chainOnto(canvas)
}

function announce(): void {
  tryChain()
  notifyListeners()
}

export function createViewportObserver() {
  return (listener: Listener): Unsubscribe => {
    listeners.add(listener)

    tryChain()
    if (listeners.size === 1) {
      window.addEventListener('resize', announce)
    }

    return () => {
      listeners.delete(listener)
      if (listeners.size) return
      window.removeEventListener('resize', announce)
      unchain()
    }
  }
}

/** Test seam — drops every subscriber and gives the canvas its handler back. */
export function resetViewportObserver(): void {
  listeners.clear()
  unchain()
  window.removeEventListener('resize', announce)
}
