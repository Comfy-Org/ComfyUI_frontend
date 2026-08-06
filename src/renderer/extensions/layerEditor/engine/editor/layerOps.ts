import type { RGBA } from '../blend'
import { blendComposite } from '../blend'
import { linearToSrgb, srgbToLinear } from '../color'
import { BakeRasterCommand, snapshotRaster } from '../commands/bakeContent'
import { PropCommand } from '../commands/prop'
import { RemoveNodeCommand } from '../commands/structure'
import type { ContentStore } from '../content'
import { findNode } from '../document'
import type { Command } from '../history'
import { CommandGroup, Dirty } from '../history'
import type { EffectiveMode } from '../mode'
import { defaultMode, resolveMode } from '../mode'
import type { GroupData, RasterData, Rect, SceneNode } from '../node'
import {
  bakeMaskInto,
  bakePlaced,
  isIdentityPlacement,
  placedBounds,
  drawPlacedInto
} from '../render/bake'

export function alphaBBox(
  data: Uint8ClampedArray,
  w: number,
  h: number
): Rect | null {
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

function effectiveTransform(
  node: SceneNode,
  bitmap: { width: number; height: number }
) {
  const t = node.transform
  if (t.w > 0 && t.h > 0) return t
  return { x: 0, y: 0, w: bitmap.width, h: bitmap.height, rotation: 0 }
}

function placedLayerData(
  node: SceneNode,
  bitmap: HTMLCanvasElement,
  union: Rect
): Uint8ClampedArray | null {
  const c = document.createElement('canvas')
  c.width = union.w
  c.height = union.h
  const g = c.getContext('2d')
  if (!g) return null
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  drawPlacedInto(g, bitmap, effectiveTransform(node, bitmap), union.x, union.y)
  return g.getImageData(0, 0, union.w, union.h).data
}

function placedMaskData(
  node: SceneNode,
  content: ContentStore,
  union: Rect
): Uint8ClampedArray | null {
  const m = node.mask
  if (!m || !m.enabled) return null
  const entry = content.get(m.contentId)
  if (!entry) return null
  return placedLayerData(node, entry.canvas, union)
}

function isPlainNormal(mode: EffectiveMode): boolean {
  return mode.blend === 'normal' && mode.composite === 'union'
}

export function compositePair(
  bottom: {
    data: Uint8ClampedArray
    mask: Uint8ClampedArray | null
    mode: EffectiveMode
    opacity: number
  },
  top: {
    data: Uint8ClampedArray
    mask: Uint8ClampedArray | null
    mode: EffectiveMode
    opacity: number
  },
  pixels: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels * 4)
  const fast = isPlainNormal(bottom.mode) && isPlainNormal(top.mode)
  for (let p = 0, i = 0; p < pixels; p++, i += 4) {
    const bm = bottom.mask ? bottom.mask[i] / 255 : 1
    const tm = top.mask ? top.mask[i] / 255 : 1
    if (fast) {
      const ba = (bottom.data[i + 3] / 255) * bottom.opacity * bm
      const ta = (top.data[i + 3] / 255) * top.opacity * tm
      const a = ta + ba * (1 - ta)
      if (a <= 0) {
        out[i + 3] = 0
        continue
      }
      for (let ch = 0; ch < 3; ch++) {
        const bl = srgbToLinear(bottom.data[i + ch] / 255)
        const tl = srgbToLinear(top.data[i + ch] / 255)
        out[i + ch] = Math.round(
          linearToSrgb((tl * ta + bl * ba * (1 - ta)) / a) * 255
        )
      }
      out[i + 3] = Math.round(a * 255)
      continue
    }
    const bPx: RGBA = [
      srgbToLinear(bottom.data[i] / 255),
      srgbToLinear(bottom.data[i + 1] / 255),
      srgbToLinear(bottom.data[i + 2] / 255),
      bottom.data[i + 3] / 255
    ]
    const tPx: RGBA = [
      srgbToLinear(top.data[i] / 255),
      srgbToLinear(top.data[i + 1] / 255),
      srgbToLinear(top.data[i + 2] / 255),
      top.data[i + 3] / 255
    ]
    const backdrop = blendComposite(
      bottom.mode,
      [0, 0, 0, 0],
      bPx,
      bottom.opacity,
      bm
    )
    const merged = blendComposite(top.mode, backdrop, tPx, top.opacity, tm)
    const a = Math.max(0, Math.min(1, merged[3]))
    out[i] = Math.round(linearToSrgb(Math.max(0, Math.min(1, merged[0]))) * 255)
    out[i + 1] = Math.round(
      linearToSrgb(Math.max(0, Math.min(1, merged[1]))) * 255
    )
    out[i + 2] = Math.round(
      linearToSrgb(Math.max(0, Math.min(1, merged[2]))) * 255
    )
    out[i + 3] = Math.round(a * 255)
  }
  return out
}

export interface LayerOpDeps {
  root: GroupData
  content: ContentStore
  push(cmd: Command): void
  bitmapOf(node: SceneNode): HTMLCanvasElement | null
}

export function mergeDown(deps: LayerOpDeps, topId: string): boolean {
  const children = deps.root.children
  const topIndex = children.findIndex((n) => n.id === topId)
  if (topIndex <= 0) return false
  const top = children[topIndex]
  if (!top.visible) return false
  let bottomIndex = -1
  for (let i = topIndex - 1; i >= 0; i--) {
    if (!children[i].visible) continue
    if (children[i].kind === 'raster') bottomIndex = i
    break
  }
  if (bottomIndex < 0) return false
  const bottom = children[bottomIndex] as RasterData
  if (bottom.locks.content) return false

  const topBitmap = deps.bitmapOf(top)
  const bottomBitmap = deps.bitmapOf(bottom)
  if (!topBitmap || !bottomBitmap) return false

  const tb = placedBounds(effectiveTransform(top, topBitmap))
  const bb = placedBounds(bottom.transform)
  const ux = Math.min(tb.x, bb.x)
  const uy = Math.min(tb.y, bb.y)
  const union: Rect = {
    x: ux,
    y: uy,
    w: Math.max(tb.x + tb.w, bb.x + bb.w) - ux,
    h: Math.max(tb.y + tb.h, bb.y + bb.h) - uy
  }
  if (union.w > 16384 || union.h > 16384) return false

  const topData = placedLayerData(top, topBitmap, union)
  const bottomData = placedLayerData(bottom, bottomBitmap, union)
  if (!topData || !bottomData) return false

  const merged = compositePair(
    {
      data: bottomData,
      mask: placedMaskData(bottom, deps.content, union),
      mode: resolveMode(bottom.mode),
      opacity: bottom.opacity
    },
    {
      data: topData,
      mask: placedMaskData(top, deps.content, union),
      mode: resolveMode(top.mode),
      opacity: top.opacity
    },
    union.w * union.h
  )

  const canvas = document.createElement('canvas')
  canvas.width = union.w
  canvas.height = union.h
  const g = canvas.getContext('2d')
  if (!g) return false
  const img = g.createImageData(union.w, union.h)
  img.data.set(merged)
  g.putImageData(img, 0, 0)

  const group = new CommandGroup('Merge Down')

  const before = snapshotRaster(bottom)
  bottom.contentId = deps.content.register(canvas)
  bottom.url = undefined
  bottom.naturalWidth = union.w
  bottom.naturalHeight = union.h
  bottom.transform = {
    x: union.x,
    y: union.y,
    w: union.w,
    h: union.h,
    rotation: 0
  }
  bottom.mask = undefined
  group.children.push(
    new BakeRasterCommand(
      'Merge Down',
      bottom,
      before,
      snapshotRaster(bottom),
      deps.content
    )
  )

  if (bottom.opacity !== 1) {
    const prev = bottom.opacity
    bottom.opacity = 1
    group.children.push(
      new PropCommand(
        'Opacity',
        Dirty.META,
        () => bottom.opacity,
        (v) => (bottom.opacity = v),
        prev,
        1
      )
    )
  }
  if (bottom.mode.blend !== 'normal' || bottom.mode.composite !== 'union') {
    const prev = bottom.mode
    bottom.mode = defaultMode('normal')
    group.children.push(
      new PropCommand(
        'Mode',
        Dirty.DRAWABLE,
        () => bottom.mode,
        (v) => (bottom.mode = v),
        prev,
        bottom.mode
      )
    )
  }

  children.splice(topIndex, 1)
  group.children.push(
    new RemoveNodeCommand(`Merge ${top.name}`, deps.root, top, topIndex)
  )

  deps.push(group)
  return true
}

export function canRasterizeLayer(root: GroupData, id: string): boolean {
  const node = findNode(root, id)?.node ?? null
  if (!node || node.kind !== 'raster') return false
  const raster = node as RasterData
  return !isIdentityPlacement(
    raster.transform,
    raster.naturalWidth,
    raster.naturalHeight
  )
}

export function rasterizeLayer(deps: LayerOpDeps, id: string): boolean {
  const node = findNode(deps.root, id)?.node
  if (!node || node.kind !== 'raster') return false
  const raster = node as RasterData
  const t = { ...raster.transform }
  if (isIdentityPlacement(t, raster.naturalWidth, raster.naturalHeight))
    return false
  const entry = deps.content.get(raster.contentId)
  if (!entry) return false
  const baked = bakePlaced(entry.canvas, t)
  if (!baked) return false
  const before = snapshotRaster(raster)
  raster.contentId = deps.content.register(baked.canvas)
  raster.url = undefined
  raster.naturalWidth = baked.bounds.w
  raster.naturalHeight = baked.bounds.h
  raster.transform = {
    x: baked.bounds.x,
    y: baked.bounds.y,
    w: baked.bounds.w,
    h: baked.bounds.h,
    rotation: 0
  }
  if (raster.mask) {
    const maskEntry = deps.content.get(raster.mask.contentId)
    const bakedMask = maskEntry
      ? bakeMaskInto(maskEntry.canvas, t, baked.bounds, 'black')
      : null
    if (bakedMask) {
      raster.mask = {
        ...raster.mask,
        contentId: deps.content.register(bakedMask),
        url: undefined
      }
    }
  }
  deps.push(
    new BakeRasterCommand(
      'Rasterize Layer',
      raster,
      before,
      snapshotRaster(raster),
      deps.content
    )
  )
  return true
}

export function cropToContent(deps: LayerOpDeps, id: string): boolean {
  const node = deps.root.children.find((n) => n.id === id)
  if (!node || node.kind !== 'raster') return false
  const raster = node as RasterData
  if (raster.transform.rotation !== 0) return false
  const entry = deps.content.get(raster.contentId)
  if (!entry) return false
  const g = entry.canvas.getContext('2d')
  if (!g) return false
  const data = g.getImageData(0, 0, entry.width, entry.height).data
  const box = alphaBBox(data, entry.width, entry.height)
  if (!box) return false
  if (
    box.x === 0 &&
    box.y === 0 &&
    box.w === entry.width &&
    box.h === entry.height
  )
    return false

  const cropped = document.createElement('canvas')
  cropped.width = box.w
  cropped.height = box.h
  const cg = cropped.getContext('2d')
  if (!cg) return false
  cg.drawImage(entry.canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h)

  const sx = raster.transform.w / (raster.naturalWidth || 1)
  const sy = raster.transform.h / (raster.naturalHeight || 1)
  const before = snapshotRaster(raster)
  raster.contentId = deps.content.register(cropped)
  raster.url = undefined
  raster.naturalWidth = box.w
  raster.naturalHeight = box.h
  raster.transform = {
    x: raster.transform.x + box.x * sx,
    y: raster.transform.y + box.y * sy,
    w: box.w * sx,
    h: box.h * sy,
    rotation: 0
  }
  if (raster.mask) {
    const maskEntry = deps.content.get(raster.mask.contentId)
    if (maskEntry) {
      const croppedMask = document.createElement('canvas')
      croppedMask.width = box.w
      croppedMask.height = box.h
      const mg = croppedMask.getContext('2d')
      if (mg) {
        mg.drawImage(
          maskEntry.canvas,
          box.x,
          box.y,
          box.w,
          box.h,
          0,
          0,
          box.w,
          box.h
        )
        raster.mask = {
          ...raster.mask,
          contentId: deps.content.register(croppedMask),
          url: undefined
        }
      }
    }
  }
  deps.push(
    new BakeRasterCommand(
      'Crop to Content',
      raster,
      before,
      snapshotRaster(raster),
      deps.content
    )
  )
  return true
}

export function layerToCanvasSize(
  deps: LayerOpDeps,
  id: string,
  docW: number,
  docH: number
): boolean {
  const node = deps.root.children.find((n) => n.id === id)
  if (!node || node.kind !== 'raster') return false
  const raster = node as RasterData
  const entry = deps.content.get(raster.contentId)
  if (!entry) return false
  if (
    raster.transform.x === 0 &&
    raster.transform.y === 0 &&
    raster.transform.rotation === 0 &&
    raster.naturalWidth === docW &&
    raster.naturalHeight === docH &&
    raster.transform.w === docW &&
    raster.transform.h === docH
  ) {
    return false
  }
  const canvas = document.createElement('canvas')
  canvas.width = docW
  canvas.height = docH
  const g = canvas.getContext('2d')
  if (!g) return false
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  drawPlacedInto(g, entry.canvas, raster.transform, 0, 0)

  const oldTransform = { ...raster.transform }
  const before = snapshotRaster(raster)
  raster.contentId = deps.content.register(canvas)
  raster.url = undefined
  raster.naturalWidth = docW
  raster.naturalHeight = docH
  raster.transform = { x: 0, y: 0, w: docW, h: docH, rotation: 0 }
  if (raster.mask) {
    const maskEntry = deps.content.get(raster.mask.contentId)
    const bakedMask = maskEntry
      ? bakeMaskInto(
          maskEntry.canvas,
          oldTransform,
          { x: 0, y: 0, w: docW, h: docH },
          'white'
        )
      : null
    if (bakedMask) {
      raster.mask = {
        ...raster.mask,
        contentId: deps.content.register(bakedMask),
        url: undefined
      }
    }
  }
  deps.push(
    new BakeRasterCommand(
      'Layer to Canvas Size',
      raster,
      before,
      snapshotRaster(raster),
      deps.content
    )
  )
  return true
}
