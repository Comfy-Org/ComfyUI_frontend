import type { DecodedImage } from '@e2e/fixtures/helpers/decodedImage'
import type {
  ClientBox,
  HookDrawing
} from '@e2e/reporters/nodes2Acceptance/layout'

const CHANNEL_TOLERANCE = 24
const BASELINE_SHARE = 0.1
const MIN_COLOUR_PIXELS = 3

const colourKey = (rgba: Buffer, offset: number) =>
  ((rgba[offset] >> 4) << 8) |
  ((rgba[offset + 1] >> 4) << 4) |
  (rgba[offset + 2] >> 4)

function differs(a: Buffer, b: Buffer, offset: number) {
  return (
    Math.abs(a[offset] - b[offset]) +
      Math.abs(a[offset + 1] - b[offset + 1]) +
      Math.abs(a[offset + 2] - b[offset + 2]) >
    CHANNEL_TOLERANCE
  )
}

function countColours(
  image: DecodedImage,
  box: ClientBox,
  include: (offset: number) => boolean = () => true
) {
  const counts = new Map<number, number>()
  const left = Math.max(0, Math.floor(box.x))
  const top = Math.max(0, Math.floor(box.y))
  const right = Math.min(image.width, Math.ceil(box.x + box.width))
  const bottom = Math.min(image.height, Math.ceil(box.y + box.height))
  for (let y = top; y < bottom; y++)
    for (let x = left; x < right; x++) {
      const offset = (y * image.width + x) * 4
      if (!include(offset)) continue
      const key = colourKey(image.rgba, offset)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  return counts
}

function changedBox(withHooks: DecodedImage, withoutHooks: DecodedImage) {
  let pixels = 0
  let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity]
  for (let y = 0; y < withHooks.height; y++)
    for (let x = 0; x < withHooks.width; x++) {
      if (
        !differs(
          withHooks.rgba,
          withoutHooks.rgba,
          (y * withHooks.width + x) * 4
        )
      )
        continue
      pixels++
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x + 1)
      bottom = Math.max(bottom, y + 1)
    }
  return pixels
    ? {
        pixels,
        box: { x: left, y: top, width: right - left, height: bottom - top }
      }
    : null
}

const pad = (box: ClientBox, amount: number): ClientBox => ({
  x: box.x - amount,
  y: box.y - amount,
  width: box.width + amount * 2,
  height: box.height + amount * 2
})

/** What a node's draw hooks visibly add on classic: screenshots of the node with the hooks on and off, and the node's box in those images. */
export function hookDrawing(
  withHooks: DecodedImage,
  withoutHooks: DecodedImage,
  node: ClientBox
): HookDrawing | null {
  if (withHooks.rgba.length !== withoutHooks.rgba.length) return null
  const changed = changedBox(withHooks, withoutHooks)
  if (!changed) return null
  const drawn = countColours(withHooks, changed.box, (offset) =>
    differs(withHooks.rgba, withoutHooks.rgba, offset)
  )
  const baseline = countColours(withoutHooks, pad(changed.box, 8))
  const colours = [...drawn]
    .filter(
      ([key, count]) =>
        count >= MIN_COLOUR_PIXELS &&
        (baseline.get(key) ?? 0) <= count * BASELINE_SHARE
    )
    .map(([key]) => key)
  return {
    pixels: changed.pixels,
    distinctPixels: colours.reduce((sum, key) => sum + drawn.get(key)!, 0),
    colours,
    box: {
      x: changed.box.x - node.x,
      y: changed.box.y - node.y,
      width: changed.box.width,
      height: changed.box.height
    },
    nodeSize: { width: node.width, height: node.height }
  }
}

function anchoredStart(
  offset: number,
  length: number,
  classicSize: number,
  start: number,
  size: number
) {
  return offset + length / 2 <= classicSize / 2
    ? start + offset
    : start + size - (classicSize - offset)
}

/** Pixels in the drawing's own colours found where the drawing sits on another rendering of the node, keeping its distance to the nearest edges. */
export function drawingFound(
  image: DecodedImage,
  node: ClientBox,
  drawing: HookDrawing
) {
  const { box, nodeSize } = drawing
  const region = pad(
    {
      x: anchoredStart(box.x, box.width, nodeSize.width, node.x, node.width),
      y: anchoredStart(box.y, box.height, nodeSize.height, node.y, node.height),
      width: box.width,
      height: box.height
    },
    8 + Math.max(box.width, box.height) * 0.1
  )
  const wanted = new Set(drawing.colours)
  let found = 0
  for (const [key, count] of countColours(image, region))
    if (wanted.has(key)) found += count
  return found
}
