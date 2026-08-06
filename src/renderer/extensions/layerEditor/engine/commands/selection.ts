import type { ContentStore } from '../content'
import type { Document } from '../document'
import { Dirty } from '../history'
import type { Command, Direction } from '../history'
import type { ChannelData } from '../node'

export interface SelectionSnapshot {
  channel: ChannelData | null
  selectionId: string | undefined
}

export function snapshotSelection(doc: Document): SelectionSnapshot {
  const channel = doc.channels.find((ch) => ch.role === 'selection') ?? null
  return {
    channel: channel
      ? {
          ...channel,
          bounds: channel.bounds ? { ...channel.bounds } : undefined
        }
      : null,
    selectionId: channel ? channel.id : undefined
  }
}

export function applySelectionSnapshot(
  doc: Document,
  s: SelectionSnapshot
): void {
  doc.channels = doc.channels.filter((ch) => ch.role !== 'selection')
  if (s.channel) doc.channels.push({ ...s.channel })
  doc.selectionId = s.channel ? s.selectionId : undefined
}

export class SetSelectionCommand implements Command {
  readonly dirtyMask = Dirty.SELECTION

  constructor(
    readonly label: string,
    private readonly doc: Document,
    private readonly before: SelectionSnapshot,
    private readonly after: SelectionSnapshot,
    private readonly store: ContentStore
  ) {}

  apply(dir: Direction): void {
    applySelectionSnapshot(this.doc, dir === 'undo' ? this.before : this.after)
  }

  sizeBytes(): number {
    let n = 0
    for (const s of [this.before, this.after]) {
      const e = s.channel ? this.store.get(s.channel.contentId) : null
      if (e) n += e.width * e.height * 4
    }
    return n
  }

  contentRefs(): string[] {
    const refs: string[] = []
    if (this.before.channel) refs.push(this.before.channel.contentId)
    if (this.after.channel) refs.push(this.after.channel.contentId)
    return refs
  }
}
