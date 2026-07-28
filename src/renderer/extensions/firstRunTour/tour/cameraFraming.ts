import { delay } from 'es-toolkit'

import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import {
  CARD_GLIDE_MS,
  CARD_WIDTH,
  CURSOR_GAP
} from '@/platform/onboarding/coachmarkLayout'
import { app } from '@/scripts/app'
import type { NodeId } from '@/types/nodeId'

const FOCUS_DURATION_MS = 450
/** Never magnify past this: the aim is a node that reads, not one that dominates. */
const MAX_FOCUS_SCALE = 0.6
const CARD_COLUMN = CARD_WIDTH + CURSOR_GAP * 2

interface Viewport {
  width: number
  height: number
}

/**
 * Fill fraction that frames `bounds` beside the card. The fit centres the node
 * and so splits the free width evenly, hence room for a card column on each
 * side. Inverts litegraph's fit, which solves each axis as
 * `(fill * side) / max(bound, 300)` and takes the smaller, so the binding axis
 * has to be handed the larger fill.
 */
export function focusFill(bounds: ReadOnlyRect, viewport: Viewport): number {
  const [, , width, height] = bounds
  const sideRoom = viewport.width - CARD_COLUMN * 2
  const usableWidth = sideRoom > 0 ? sideRoom : viewport.width
  const scale = Math.min(
    usableWidth / Math.max(width, 1),
    viewport.height / Math.max(height, 1),
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
  const canvas = app.canvas
  const viewport = canvas?.canvas.getBoundingClientRect()
  if (!canvas || !viewport?.width || !viewport.height) return
  canvas.ds.fitToBounds(bounds, { zoom: focusFill(bounds, viewport) })
  canvas.setDirty(true, true)
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
  const canvas = app.canvas
  const node = canvas?.graph?.getNodeById(nodeId)
  const viewport = canvas?.canvas.getBoundingClientRect()
  if (!canvas || !node || !viewport?.width || !viewport.height) return

  const bounds = node.boundingRect

  window.addEventListener('resize', () => fitInstantly(bounds), { signal })

  if (prefersReducedMotion()) return fitInstantly(bounds)

  if (glide) await delay(CARD_GLIDE_MS, { signal })
  canvas.animateToBounds(bounds, {
    zoom: focusFill(bounds, viewport),
    duration: FOCUS_DURATION_MS
  })
  await delay(FOCUS_DURATION_MS, { signal })
}
