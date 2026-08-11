import type { ContentStore } from '../content'
import type { Command, Direction } from '../history'
import { Dirty } from '../history'
import type { ChannelData, RasterData, Transform } from '../node'

export interface RasterSnapshot {
  contentId: string
  url?: string
  naturalWidth: number
  naturalHeight: number
  transform: Transform
  mask?: ChannelData
}

export function snapshotRaster(node: RasterData): RasterSnapshot {
  return {
    contentId: node.contentId,
    url: node.url,
    naturalWidth: node.naturalWidth,
    naturalHeight: node.naturalHeight,
    transform: { ...node.transform },
    mask: node.mask ? { ...node.mask } : undefined
  }
}

export class BakeRasterCommand implements Command {
  readonly dirtyMask = Dirty.DRAWABLE

  constructor(
    readonly label: string,
    private readonly node: RasterData,
    private readonly before: RasterSnapshot,
    private readonly after: RasterSnapshot,
    private readonly store: ContentStore
  ) {}

  apply(dir: Direction): void {
    const s = dir === 'undo' ? this.before : this.after
    this.node.contentId = s.contentId
    this.node.url = s.url
    this.node.naturalWidth = s.naturalWidth
    this.node.naturalHeight = s.naturalHeight
    this.node.transform = { ...s.transform }
    this.node.mask = s.mask ? { ...s.mask } : undefined
  }

  sizeBytes(): number {
    let n = 0
    const ids = [this.before.contentId, this.after.contentId]
    if (this.before.mask) ids.push(this.before.mask.contentId)
    if (this.after.mask) ids.push(this.after.mask.contentId)
    for (const id of ids) {
      const e = this.store.get(id)
      if (e) n += e.width * e.height * 4
    }
    return n
  }

  contentRefs(): string[] {
    const refs = [this.before.contentId, this.after.contentId]
    if (this.before.mask) refs.push(this.before.mask.contentId)
    if (this.after.mask) refs.push(this.after.mask.contentId)
    return refs.filter(Boolean)
  }
}
