import { describe, expect, it } from 'vitest'

import type { Document } from '../document'
import { DefaultContentStore } from '../impl/contentStore'
import { rasterKind } from '../kinds/raster'
import { defaultMode } from '../mode'
import type { GroupData, RasterData } from '../node'
import { liveContentIds, pendingUploads } from './nodeBinding'

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function docWith(children: RasterData[]): Document {
  const root: GroupData = {
    kind: 'group',
    id: 'root',
    name: 'root',
    visible: true,
    opacity: 1,
    mode: defaultMode('normal'),
    transform: { x: 0, y: 0, w: 0, h: 0, rotation: 0 },
    locks: { content: false, position: false, visibility: false },
    children,
    passThrough: false
  }
  return { version: 2, width: 64, height: 64, root, channels: [] }
}

describe('pendingUploads', () => {
  it('returns a job for a raster whose content is not yet uploaded', () => {
    const content = new DefaultContentStore()
    const id = content.register(canvas(8, 8))
    const raster = rasterKind.create({
      contentId: id,
      naturalWidth: 8,
      naturalHeight: 8
    })
    const doc = docWith([raster])

    const jobs = pendingUploads(doc, content)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({ contentId: id, channel: 'content' })

    jobs[0].commitUrl('http://x/a.png')
    expect(raster.url).toBe('http://x/a.png')
    expect(pendingUploads(doc, content)).toHaveLength(0)
  })

  it('includes an un-uploaded mask (separate job)', () => {
    const content = new DefaultContentStore()
    const cid = content.register(canvas(8, 8))
    const mid = content.register(canvas(8, 8))
    const raster = rasterKind.create({
      contentId: cid,
      url: 'http://x/base.png',
      mask: { id: 'm', role: 'mask', contentId: mid, enabled: true }
    })
    const jobs = pendingUploads(docWith([raster]), content)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({ contentId: mid, channel: 'mask' })
    jobs[0].commitUrl('http://x/m.png')
    expect(raster.mask!.url).toBe('http://x/m.png')
  })

  it('skips content that has no store entry', () => {
    const content = new DefaultContentStore()
    const raster = rasterKind.create({ contentId: 'missing' })
    expect(pendingUploads(docWith([raster]), content)).toHaveLength(0)
  })

  it('includes un-uploaded document channels as mask jobs', () => {
    const content = new DefaultContentStore()
    const cid = content.register(canvas(8, 8))
    const doc = docWith([])
    doc.channels.push(
      { id: 'sel', role: 'selection', contentId: cid, enabled: true },
      {
        id: 'up',
        role: 'selection',
        contentId: 'other',
        enabled: true,
        url: 'http://x/done.png'
      },
      { id: 'missing', role: 'selection', contentId: 'ghost', enabled: true }
    )
    const jobs = pendingUploads(doc, content)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({ contentId: cid, channel: 'mask' })
    jobs[0].commitUrl('http://x/sel.png')
    expect(doc.channels[0].url).toBe('http://x/sel.png')
    expect(pendingUploads(doc, content)).toHaveLength(0)
  })
})

describe('liveContentIds', () => {
  it('collects refs from every node plus document channels', () => {
    const raster = rasterKind.create({ contentId: 'c-node' })
    const doc = docWith([raster])
    doc.channels.push({
      id: 'sel',
      role: 'selection',
      contentId: 'c-chan',
      enabled: true
    })
    const live = liveContentIds(doc, (node) =>
      'contentId' in node ? [(node as RasterData).contentId] : []
    )
    expect(live).toEqual(new Set(['c-node', 'c-chan']))
  })
})
