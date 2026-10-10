import type { Bounds } from '@/renderer/core/layout/types'

export function unionBounds(boxes: readonly Bounds[]): Bounds | undefined {
  if (!boxes.length) return undefined

  const x1 = Math.min(...boxes.map((b) => b.x))
  const y1 = Math.min(...boxes.map((b) => b.y))
  const x2 = Math.max(...boxes.map((b) => b.x + b.width))
  const y2 = Math.max(...boxes.map((b) => b.y + b.height))
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}

/** Mirrors CropByBBoxes.execute in comfy_extras/nodes_sdpose.py. */
export function cropRegion(
  union: Bounds,
  padding: number,
  imageWidth: number,
  imageHeight: number
): Bounds {
  const x1 = Math.max(0, union.x - padding)
  const y1 = Math.max(0, union.y - padding)
  const x2 = Math.min(imageWidth, union.x + union.width + padding)
  const y2 = Math.min(imageHeight, union.y + union.height + padding)
  if (x2 > x1 && y2 > y1)
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }

  const fallbackSize = Math.trunc(Math.min(imageWidth, imageHeight) * 0.3)
  const fx1 = Math.max(0, Math.floor((imageWidth - fallbackSize) / 2))
  const fy1 = Math.max(0, Math.trunc(imageHeight * 0.1))
  return {
    x: fx1,
    y: fy1,
    width: Math.min(imageWidth, fx1 + fallbackSize) - fx1,
    height: Math.min(imageHeight, fy1 + fallbackSize) - fy1
  }
}

interface Size {
  width: number
  height: number
}

export type KeepAspect = 'stretch' | 'pad'

function roundHalfToEven(value: number): number {
  const floor = Math.floor(value)
  if (value - floor !== 0.5) return Math.round(value)
  return floor % 2 === 0 ? floor : floor + 1
}

export function outputFrame(
  region: Bounds,
  output: Size,
  keepAspect: KeepAspect
): Bounds {
  if (keepAspect === 'stretch') return region

  const scale = Math.min(
    output.width / region.width,
    output.height / region.height
  )
  const padLeft = Math.floor(
    (output.width - roundHalfToEven(region.width * scale)) / 2
  )
  const padTop = Math.floor(
    (output.height - roundHalfToEven(region.height * scale)) / 2
  )
  return {
    x: region.x - padLeft / scale,
    y: region.y - padTop / scale,
    width: output.width / scale,
    height: output.height / scale
  }
}

export function outputSizeFrame(region: Bounds, output: Size): Bounds {
  return {
    x: region.x + (region.width - output.width) / 2,
    y: region.y + (region.height - output.height) / 2,
    width: output.width,
    height: output.height
  }
}

export function previewWorld(image: Size, frames: readonly Bounds[]): Bounds {
  const x1 = Math.min(0, ...frames.map((f) => f.x))
  const y1 = Math.min(0, ...frames.map((f) => f.y))
  const x2 = Math.max(image.width, ...frames.map((f) => f.x + f.width))
  const y2 = Math.max(image.height, ...frames.map((f) => f.y + f.height))
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}

export function fitContain(content: Size, box: Size): Bounds {
  const scale = Math.min(box.width / content.width, box.height / content.height)
  const width = content.width * scale
  const height = content.height * scale
  return {
    x: (box.width - width) / 2,
    y: (box.height - height) / 2,
    width,
    height
  }
}
