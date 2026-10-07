import { describe, expect, it } from 'vitest'

import {
  CANVAS_CLIPBOARD_ID_KEY,
  CANVAS_CLIPBOARD_KEY,
  snapshotCanvasClipboard
} from './canvasClipboard'

describe('snapshotCanvasClipboard', () => {
  it.for([
    { name: 'a stored copy', slot: '{"nodes":[]}', id: 'copy-1' },
    { name: 'an empty clipboard', slot: null, id: null }
  ])('restores the slot and its id to $name', ({ slot, id }) => {
    if (slot !== null) localStorage.setItem(CANVAS_CLIPBOARD_KEY, slot)
    if (id !== null) localStorage.setItem(CANVAS_CLIPBOARD_ID_KEY, id)
    const restore = snapshotCanvasClipboard()
    localStorage.setItem(CANVAS_CLIPBOARD_KEY, '{"nodes":[{}]}')
    localStorage.setItem(CANVAS_CLIPBOARD_ID_KEY, 'template-copy')

    restore()

    expect(localStorage.getItem(CANVAS_CLIPBOARD_KEY)).toBe(slot)
    expect(localStorage.getItem(CANVAS_CLIPBOARD_ID_KEY)).toBe(id)
  })
})
