import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { DefaultContentStore } from '../impl/contentStore'
import { History } from '../history'
import {
  SetContentCommand,
  SetContentRegionCommand,
  extractPatch
} from './setContent'

// happy-dom has no 2d context; the region command refuses to touch the slot
// without one, so give it a minimal stub.
let restoreGetContext: (() => void) | null = null
beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as { getContext: unknown }
  const original = proto.getContext
  proto.getContext = () => ({
    drawImage() {},
    putImageData() {},
    createImageData: (w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4)
    }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4)
    })
  })
  restoreGetContext = () => {
    proto.getContext = original
  }
})
afterAll(() => restoreGetContext?.())

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

describe('SetContentCommand', () => {
  it('swaps the slot content id on undo/redo', () => {
    const store = new DefaultContentStore()
    const before = store.register(canvas(8, 8))
    const after = store.register(canvas(8, 8))
    const slot = { contentId: after }
    const cmd = new SetContentCommand('Paint', slot, before, after, store)

    cmd.apply('undo')
    expect(slot.contentId).toBe(before)
    cmd.apply('redo')
    expect(slot.contentId).toBe(after)
  })

  it('reports the after-content byte size for the history budget', () => {
    const store = new DefaultContentStore()
    const after = store.register(canvas(10, 10))
    const cmd = new SetContentCommand(
      'Paint',
      { contentId: after },
      'x',
      after,
      store
    )
    expect(cmd.sizeBytes()).toBe(400)
  })

  it('drives History undo/redo end-to-end', () => {
    const store = new DefaultContentStore()
    const a = store.register(canvas(4, 4))
    const b = store.register(canvas(4, 4))
    const slot = { contentId: b }
    const history = new History()
    history.push(new SetContentCommand('Paint', slot, a, b, store))

    expect(slot.contentId).toBe(b)
    history.undo()
    expect(slot.contentId).toBe(a)
    history.redo()
    expect(slot.contentId).toBe(b)
  })
})

describe('extractPatch', () => {
  it('copies the rect rows out of a full RGBA buffer', () => {
    const src = new Uint8ClampedArray(4 * 4 * 4)
    for (let i = 0; i < 16; i++) src.set([i, i, i, 255], i * 4)
    const patch = extractPatch(src, 4, { x: 1, y: 1, w: 2, h: 2 })
    expect(patch.length).toBe(2 * 2 * 4)
    expect(patch[0]).toBe(5)
    expect(patch[4]).toBe(6)
    expect(patch[8]).toBe(9)
    expect(patch[12]).toBe(10)
  })

  it('handles a full-buffer rect as an identity copy', () => {
    const src = Uint8ClampedArray.of(1, 2, 3, 4, 5, 6, 7, 8)
    expect([...extractPatch(src, 2, { x: 0, y: 0, w: 2, h: 1 })]).toEqual([
      ...src
    ])
  })
})

describe('SetContentRegionCommand', () => {
  const rect = { x: 1, y: 1, w: 2, h: 2 }
  const patch = (v: number) =>
    new Uint8ClampedArray(rect.w * rect.h * 4).fill(v)
  const patches = () => [{ rect, before: patch(0), after: patch(255) }]

  it('budget cost is the patches, not the full layer', () => {
    const store = new DefaultContentStore()
    const after = store.register(canvas(1024, 1024))
    const cmd = new SetContentRegionCommand(
      'Paint',
      { contentId: after },
      patches(),
      store
    )
    expect(cmd.sizeBytes()).toBeLessThan(1024)
  })

  it('multiple scattered patches sum instead of spanning their bounding box', () => {
    const store = new DefaultContentStore()
    const after = store.register(canvas(1024, 1024))
    const two = [
      { rect: { x: 0, y: 0, w: 2, h: 2 }, before: patch(0), after: patch(1) },
      {
        rect: { x: 1000, y: 1000, w: 2, h: 2 },
        before: patch(0),
        after: patch(1)
      }
    ]
    const cmd = new SetContentRegionCommand(
      'Paint',
      { contentId: after },
      two,
      store
    )
    expect(cmd.sizeBytes()).toBeLessThan(2048)
  })

  it('holds no content refs, so the pre-stroke canvas can be garbage-collected', () => {
    const store = new DefaultContentStore()
    const before = store.register(canvas(8, 8))
    const after = store.register(canvas(8, 8))
    const slot = { contentId: after }
    const history = new History()
    history.push(new SetContentRegionCommand('Paint', slot, patches(), store))
    expect(history.contentRefs().has(before)).toBe(false)
    store.collectGarbage(new Set([after]))
    expect(store.has(before)).toBe(false)
  })

  it('undo/redo rebuild fresh content entries instead of swapping ids', () => {
    const store = new DefaultContentStore()
    const after = store.register(canvas(8, 8))
    const slot: { contentId: string; url?: string } = {
      contentId: after,
      url: undefined
    }
    const cmd = new SetContentRegionCommand(
      'Paint',
      slot,
      patches(),
      store,
      'http://x/a.png'
    )

    cmd.apply('undo')
    expect(slot.contentId).not.toBe(after)
    expect(slot.url).toBe('http://x/a.png')
    expect(store.get(slot.contentId)?.uploadedUrl).toBe('http://x/a.png')

    const undone = slot.contentId
    cmd.apply('redo')
    expect(slot.contentId).not.toBe(undone)
    expect(slot.url).toBeUndefined()
    expect(store.get(slot.contentId)?.uploadedUrl).toBeNull()
    expect(store.get(slot.contentId)?.width).toBe(8)
  })

  it('is a no-op when the current content entry is missing', () => {
    const store = new DefaultContentStore()
    const slot = { contentId: 'gone' }
    const cmd = new SetContentRegionCommand('Paint', slot, patches(), store)
    cmd.apply('undo')
    expect(slot.contentId).toBe('gone')
  })
})
