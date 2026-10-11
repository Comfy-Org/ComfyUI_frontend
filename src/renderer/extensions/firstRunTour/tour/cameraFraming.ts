import { delay } from 'es-toolkit'

import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import {
  CARD_GLIDE_MS,
  CARD_WIDTH,
  CURSOR_GAP,
  topSafeInset
} from '@/platform/onboarding/coachmarkLayout'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { NodeId } from '@/types/nodeId'

const FOCUS_DURATION_MS = 450
/** Never magnify past this: the aim is a node that reads, not one that dominates. */
export const MAX_FOCUS_SCALE = 0.65
const CARD_COLUMN = CARD_WIDTH + CURSOR_GAP * 2

interface Viewport {
  width: number
  height: number
}

/**
 * Fill fraction that frames `bounds` beside the card. The fit centres the node
 * and so splits the free space evenly, hence room for a card column on each
 * side, and for the top bar on each end — the canvas runs the full height of
 * the window, underneath that bar, so a node fitted to the whole of it hides
 * its own title behind the workflow tabs. Inverts litegraph's fit, which
 * solves each axis as `(fill * side) / max(bound, 300)` and takes the smaller,
 * so the binding axis has to be handed the larger fill.
 */
export function focusFill(bounds: ReadOnlyRect, viewport: Viewport): number {
  const [, , width, height] = bounds
  const sideRoom = viewport.width - CARD_COLUMN * 2
  const usableWidth = sideRoom > 0 ? sideRoom : viewport.width
  const endRoom = viewport.height - topSafeInset() * 2
  const usableHeight = endRoom > 0 ? endRoom : viewport.height
  const scale = Math.min(
    usableWidth / Math.max(width, 1),
    usableHeight / Math.max(height, 1),
    MAX_FOCUS_SCALE
  )
  return Math.max(
    (scale * Math.max(width, 300)) / viewport.width,
    (scale * Math.max(height, 300)) / viewport.height
  )
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Re-solves the fill each time: it is a fraction of a viewport that can resize. */
function fitInstantly(bounds: ReadOnlyRect) {
  const canvas = useCanvasStore().canvas
  const viewport = canvas?.canvas.getBoundingClientRect()
  if (!canvas || !viewport?.width || !viewport.height) return
  canvas.ds.fitToBounds(bounds, { zoom: focusFill(bounds, viewport) })
  canvas.setDirty(true, true)
}

const SETTLED_PX = 8
const SETTLED_SCALE = 0.01

/** The scale litegraph's fit lands on: it takes whichever axis binds first. */
function framedScale(bounds: ReadOnlyRect, viewport: Viewport): number {
  const zoom = focusFill(bounds, viewport)
  return Math.min(
    (zoom * viewport.width) / Math.max(bounds[2], 300),
    (zoom * viewport.height) / Math.max(bounds[3], 300)
  )
}

/** Back onto a step already framed would otherwise animate 0px for 750ms. */
function alreadyFramed(
  bounds: ReadOnlyRect,
  ds: { offset: ArrayLike<number>; scale: number },
  viewport: Viewport
): boolean {
  const centreX = (bounds[0] + bounds[2] / 2 + ds.offset[0]) * ds.scale
  const centreY = (bounds[1] + bounds[3] / 2 + ds.offset[1]) * ds.scale
  return (
    Math.abs(ds.scale - framedScale(bounds, viewport)) <= SETTLED_SCALE &&
    Math.abs(centreX - viewport.width / 2) < SETTLED_PX &&
    Math.abs(centreY - viewport.height / 2) < SETTLED_PX
  )
}

/**
 * Brings a node into view for the step that spotlights it. Resolves once the
 * camera has landed, so an opening tour reveals its card on a still view.
 *
 * @param glide Wait out the card's travel to this step first, so only one thing
 * moves at a time. The tour's first card has nowhere to travel from.
 */
export async function frameNode(
  nodeId: NodeId,
  signal: AbortSignal,
  { glide = true }: { glide?: boolean } = {}
): Promise<void> {
  const canvas = useCanvasStore().canvas
  const node = canvas?.graph?.getNodeById(nodeId)
  const viewport = canvas?.canvas.getBoundingClientRect()
  if (!canvas || !node || !viewport?.width || !viewport.height) return

  const bounds = node.boundingRect

  window.addEventListener('resize', () => fitInstantly(bounds), { signal })

  if (prefersReducedMotion()) return fitInstantly(bounds)
  if (alreadyFramed(bounds, canvas.ds, viewport)) return

  if (glide) await delay(CARD_GLIDE_MS, { signal })
  canvas.animateToBounds(bounds, {
    zoom: focusFill(bounds, viewport),
    duration: FOCUS_DURATION_MS
  })
  await delay(FOCUS_DURATION_MS, { signal })
}
