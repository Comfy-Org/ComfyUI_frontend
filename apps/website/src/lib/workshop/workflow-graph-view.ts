import type { GraphPicture } from './workflow-graph'

/**
 * Where a published graph should open. Fitting one thousands of units wide
 * into the panel renders a 14-unit node title at three or four pixels, so the
 * drawing opens at the zoom that makes those titles readable, on the node the
 * workflow starts from, and the reader drags and zooms out from there.
 */
export interface OpeningView {
  readonly scale: number
  readonly panX: number
  readonly panY: number
}

const TITLE_UNITS = 14
const READABLE_TITLE_PX = 11
const MAX_SCALE = 3
const MARGIN = 40

const RESTING: OpeningView = { scale: 1, panX: 0, panY: 0 }

export function readableScale(viewBox: string, panelWidth: number): number {
  const width = Number(viewBox.split(' ')[2])
  if (!panelWidth || !Number.isFinite(width) || width <= 0) return 1
  const fitted = TITLE_UNITS * (panelWidth / width)
  return Math.min(MAX_SCALE, Math.max(1, READABLE_TITLE_PX / fitted))
}

export function openingView(
  picture: GraphPicture,
  panelWidth: number
): OpeningView {
  const scale = readableScale(picture.viewBox, panelWidth)
  if (scale === 1 || picture.nodes.length === 0) return RESTING

  // A template often opens with a note holding install links, which is the
  // last thing worth landing on: the workflow starts at the first node that
  // takes something in or hands something on.
  const order = [...picture.nodes].sort((a, b) => a.x - b.x || a.y - b.y)
  const first =
    order.find((node) => node.inputs.length > 0 || node.outputs.length > 0) ??
    order[0]

  // Zooming is about the drawing's middle, so panning to a node means undoing
  // where that middle carried it.
  const [x, y, width, height] = picture.viewBox.split(' ').map(Number)
  const centreX = x + width / 2
  const centreY = y + height / 2
  return {
    scale,
    panX: x + MARGIN - centreX - scale * (first.x - centreX),
    panY: y + MARGIN - centreY - scale * (first.y - centreY)
  }
}
