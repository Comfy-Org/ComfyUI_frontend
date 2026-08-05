import type { ContentStore } from '../content'
import { Dirty } from '../history'
import type { Command, Direction } from '../history'

export interface ContentSlot {
  contentId: string
  url?: string
}

export interface PatchRect {
  x: number
  y: number
  w: number
  h: number
}

export function extractPatch(
  src: Uint8ClampedArray,
  srcWidth: number,
  rect: PatchRect
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rect.w * rect.h * 4)
  const rowBytes = rect.w * 4
  for (let y = 0; y < rect.h; y++) {
    const off = ((rect.y + y) * srcWidth + rect.x) * 4
    out.set(src.subarray(off, off + rowBytes), y * rowBytes)
  }
  return out
}

export class SetContentCommand implements Command {
  readonly dirtyMask = Dirty.DRAWABLE

  constructor(
    readonly label: string,
    private readonly slot: ContentSlot,
    private readonly before: string,
    private readonly after: string,
    private readonly store: ContentStore,
    private readonly beforeUrl?: string
  ) {}

  apply(dir: Direction): void {
    if (dir === 'undo') {
      this.slot.contentId = this.before
      this.slot.url = this.beforeUrl
    } else {
      this.slot.contentId = this.after
      this.slot.url = this.store.get(this.after)?.uploadedUrl ?? undefined
    }
  }

  sizeBytes(): number {
    let n = 0
    for (const id of [this.before, this.after]) {
      const e = this.store.get(id)
      if (e) n += e.width * e.height * 4
    }
    return n
  }

  contentRefs(): string[] {
    return [this.before, this.after].filter(Boolean)
  }
}

export interface RegionPatch {
  rect: PatchRect
  before: Uint8ClampedArray
  after: Uint8ClampedArray
}

export class SetContentRegionCommand implements Command {
  readonly dirtyMask = Dirty.DRAWABLE

  constructor(
    readonly label: string,
    private readonly slot: ContentSlot,
    private readonly patches: RegionPatch[],
    private readonly store: ContentStore,
    private readonly beforeUrl?: string
  ) {}

  apply(dir: Direction): void {
    const entry = this.store.get(this.slot.contentId)
    if (!entry) return
    const next = document.createElement('canvas')
    next.width = entry.width
    next.height = entry.height
    const g = next.getContext('2d')
    if (!g) return
    g.drawImage(entry.canvas, 0, 0)
    for (const p of this.patches) {
      const img = g.createImageData(p.rect.w, p.rect.h)
      img.data.set(dir === 'undo' ? p.before : p.after)
      g.putImageData(img, p.rect.x, p.rect.y)
    }
    const url = dir === 'undo' ? this.beforeUrl : undefined
    this.slot.contentId = this.store.register(
      next,
      url ? { uploadedUrl: url } : undefined
    )
    this.slot.url = url
  }

  sizeBytes(): number {
    let n = 128
    for (const p of this.patches) n += p.before.byteLength + p.after.byteLength
    return n
  }
}
