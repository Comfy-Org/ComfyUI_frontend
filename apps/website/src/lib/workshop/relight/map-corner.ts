/** The photo corners the light map card can sit in, in order of preference. */
const MAP_CORNERS = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right'
] as const
export type MapCorner = (typeof MAP_CORNERS)[number]

interface Size {
  readonly width: number
  readonly height: number
}

interface Box extends Size {
  readonly x: number
  readonly y: number
}

/**
 * How far the card keeps from the photo's edges, in pixels. The bottom
 * corners sit higher so the hint pill along the bottom stays clear.
 */
export const MAP_INSET = { edge: 10, bottom: 48 } as const

/** Where the card's box falls in `corner` of a photo `frame` pixels big. */
export function cornerBox(corner: MapCorner, frame: Size, card: Size): Box {
  const right = corner.endsWith('right')
  const bottom = corner.startsWith('bottom')
  return {
    x: right ? frame.width - card.width - MAP_INSET.edge : MAP_INSET.edge,
    y: bottom ? frame.height - card.height - MAP_INSET.bottom : MAP_INSET.edge,
    width: card.width,
    height: card.height
  }
}

/** A light handle's half width before zoom, with a little room around it. */
const HANDLE_REACH = 20

/**
 * The on-screen box of a light handle at `at`, in fractions of the photo,
 * once the photo is scaled by `zoom.scale` and panned by `zoom.x`, `zoom.y`.
 */
export function handleBox(
  at: { readonly x: number; readonly y: number },
  frame: Size,
  zoom: { readonly scale: number; readonly x: number; readonly y: number }
): Box {
  const reach = HANDLE_REACH * zoom.scale
  return {
    x: zoom.x + at.x * frame.width * zoom.scale - reach,
    y: zoom.y + at.y * frame.height * zoom.scale - reach,
    width: reach * 2,
    height: reach * 2
  }
}

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height

/**
 * The first corner, top left first, where the card covers none of the
 * light handles' boxes; top left again when every corner covers one.
 */
export function pickMapCorner(
  frame: Size,
  card: Size,
  handles: readonly Box[]
): MapCorner {
  return (
    MAP_CORNERS.find((corner) => {
      const box = cornerBox(corner, frame, card)
      return !handles.some((handle) => overlaps(box, handle))
    }) ?? 'top-left'
  )
}
