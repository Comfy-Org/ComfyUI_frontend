import { beforeEach, describe, expect, it } from 'vitest'

import { DefaultContentStore } from './contentStore'

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

describe('DefaultContentStore', () => {
  let store: DefaultContentStore
  beforeEach(() => {
    store = new DefaultContentStore()
  })

  it('registers with a generated id and snapshots dimensions', () => {
    const id = store.register(canvas(4, 6))
    expect(id).toMatch(/^content-/)
    expect(store.get(id)).toMatchObject({
      width: 4,
      height: 6,
      uploadedUrl: null
    })
  })

  it('tracks dirty (un-uploaded) ids and clears them on markUploaded', () => {
    const a = store.register(canvas(2, 2))
    const b = store.register(canvas(2, 2), { uploadedUrl: 'http://x/b.png' })
    expect(store.dirtyIds()).toEqual([a])
    store.markUploaded(a, 'http://x/a.png')
    expect(store.dirtyIds()).toEqual([])
    expect(store.get(b)!.uploadedUrl).toBe('http://x/b.png')
  })

  it('garbage-collects entries not in the live set', () => {
    const a = store.register(canvas(2, 2))
    const b = store.register(canvas(2, 2))
    store.collectGarbage(new Set([b]))
    expect(store.has(a)).toBe(false)
    expect(store.has(b)).toBe(true)
  })

  it('estimates total bytes as w*h*4', () => {
    store.register(canvas(10, 10))
    expect(store.totalBytes()).toBe(400)
  })
})
