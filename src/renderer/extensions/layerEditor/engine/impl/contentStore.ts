import type { ContentEntry, ContentStore } from '../content'
import { generateId } from '../id'

export class DefaultContentStore implements ContentStore {
  private entries = new Map<string, ContentEntry>()

  register(
    canvas: HTMLCanvasElement,
    opts?: { id?: string; uploadedUrl?: string }
  ): string {
    const id = opts?.id ?? generateId('content')
    this.entries.set(id, {
      id,
      canvas,
      width: canvas.width,
      height: canvas.height,
      uploadedUrl: opts?.uploadedUrl ?? null
    })
    return id
  }

  get(id: string): ContentEntry | undefined {
    return this.entries.get(id)
  }

  has(id: string): boolean {
    return this.entries.has(id)
  }

  dirtyIds(): string[] {
    const out: string[] = []
    for (const e of this.entries.values())
      if (e.uploadedUrl === null) out.push(e.id)
    return out
  }

  markUploaded(id: string, url: string): void {
    const e = this.entries.get(id)
    if (e) e.uploadedUrl = url
  }

  collectGarbage(liveIds: Set<string>): void {
    for (const id of [...this.entries.keys()]) {
      if (!liveIds.has(id)) this.entries.delete(id)
    }
  }

  totalBytes(): number {
    let n = 0
    for (const e of this.entries.values()) n += e.width * e.height * 4
    return n
  }
}
