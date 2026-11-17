import type { Point, Pointing, Rect, Size } from './geometry'
import happy from './fennec/happy.webp'
import idle from './fennec/idle.webp'
import pointLeft from './fennec/point-left.webp'
import pointRight from './fennec/point-right.webp'
import talkOpen from './fennec/talk-open.webp'
import talkWide from './fennec/talk-wide.webp'
import thinking from './fennec/thinking.webp'

/**
 * The square her frames are shown in, in CSS pixels. The cutouts are 768 px
 * square on one shared canvas and are scaled to fit it.
 */
export const COMPANION_SIZE: Size = { width: 144, height: 144 }

const FRAME_PX = 768

/**
 * Where her index fingertip is inside her square when she points each way,
 * from the cutouts' README (x = 101 and x = 661 on the 768 px frames; the line
 * to line a callout up with is 54 to 55% of the way down).
 */
export const COMPANION_FINGERTIPS: Record<Pointing, Point> = {
  left: {
    x: (101 / FRAME_PX) * COMPANION_SIZE.width,
    y: 0.545 * COMPANION_SIZE.height
  },
  right: {
    x: (661 / FRAME_PX) * COMPANION_SIZE.width,
    y: 0.55 * COMPANION_SIZE.height
  }
}

/** The space between her fingertip and the ring of what she points at. */
export const COMPANION_FINGER_GAP = 10

/**
 * Her head inside her square, which a line she says or the tips she offers
 * come from: the bubble sits to its right, with its tail on it.
 */
const COMPANION_HEAD: Rect = { x: 30, y: 12, width: 60, height: 56 }

/** Her head on the screen when her square has its top-left corner at `position`. */
export function companionHead(position: Point): Rect {
  return {
    x: position.x + COMPANION_HEAD.x,
    y: position.y + COMPANION_HEAD.y,
    width: COMPANION_HEAD.width,
    height: COMPANION_HEAD.height
  }
}

/** The frames of her cutouts: one transparent image per file in `fennec/`. */
export const COMPANION_FRAMES = [
  'idle',
  'talk-open',
  'talk-wide',
  'thinking',
  'point-left',
  'point-right',
  'happy'
] as const

export type CompanionFrame = (typeof COMPANION_FRAMES)[number]

/**
 * The cutouts, one transparent 768 px image per frame. To change a frame,
 * replace its file in `fennec/` and keep the same square canvas, so that the
 * frames line up when they swap.
 */
export const COMPANION_ART: Record<CompanionFrame, string> = {
  idle,
  'talk-open': talkOpen,
  'talk-wide': talkWide,
  thinking,
  'point-left': pointLeft,
  'point-right': pointRight,
  happy
}
