import type { ContentStore } from '../content'
import { walk } from '../document'
import type { Document } from '../document'
import type { NodeBase, RasterData } from '../node'

export interface UploadJob {
  contentId: string
  channel: 'content' | 'mask'
  canvas: HTMLCanvasElement
  commitUrl: (url: string) => void
}

export function pendingUploads(
  doc: Document,
  content: ContentStore
): UploadJob[] {
  const jobs: UploadJob[] = []
  walk(doc.root, (node) => {
    if (node.kind === 'raster') {
      const r = node as RasterData
      if (r.contentId && !r.url) {
        const e = content.get(r.contentId)
        if (e)
          jobs.push({
            contentId: r.contentId,
            channel: 'content',
            canvas: e.canvas,
            commitUrl: (u) => (r.url = u)
          })
      }
    }
    const m = node.mask
    if (m && m.contentId && !m.url && m.enabled !== undefined) {
      const e = content.get(m.contentId)
      if (e)
        jobs.push({
          contentId: m.contentId,
          channel: 'mask',
          canvas: e.canvas,
          commitUrl: (u) => (m.url = u)
        })
    }
  })
  for (const ch of doc.channels) {
    if (ch.contentId && !ch.url) {
      const e = content.get(ch.contentId)
      if (e)
        jobs.push({
          contentId: ch.contentId,
          channel: 'mask',
          canvas: e.canvas,
          commitUrl: (u) => (ch.url = u)
        })
    }
  }
  return jobs
}

export function liveContentIds(
  doc: Document,
  refsOf: (node: NodeBase) => string[]
): Set<string> {
  const set = new Set<string>()
  walk(doc.root, (node) => {
    for (const id of refsOf(node)) set.add(id)
  })
  for (const ch of doc.channels) set.add(ch.contentId)
  return set
}
