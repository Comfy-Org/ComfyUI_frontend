import { describe, expect, it } from 'vitest'

import {
  CANVAS_CLIPBOARD_ID_KEY,
  CANVAS_CLIPBOARD_KEY,
  snapshotCanvasClipboard
} from './clipboardStorage'

describe('snapshotCanvasClipboard', () => {
  it('restores a stored slot and its id', () => {
    localStorage.setItem(CANVAS_CLIPBOARD_KEY, '{"nodes":[]}')
    localStorage.setItem(CANVAS_CLIPBOARD_ID_KEY, 'copy-1')
    const restore = snapshotCanvasClipboard()
    localStorage.setItem(CANVAS_CLIPBOARD_KEY, '{"nodes":[{}]}')
    localStorage.setItem(CANVAS_CLIPBOARD_ID_KEY, 'template-copy')

    restore()

    expect(localStorage.getItem(CANVAS_CLIPBOARD_KEY)).toBe('{"nodes":[]}')
    expect(localStorage.getItem(CANVAS_CLIPBOARD_ID_KEY)).toBe('copy-1')
  })

  it('clears the slot and its id when the clipboard was empty', () => {
    const restore = snapshotCanvasClipboard()
    localStorage.setItem(CANVAS_CLIPBOARD_KEY, '{"nodes":[{}]}')
    localStorage.setItem(CANVAS_CLIPBOARD_ID_KEY, 'template-copy')

    restore()

    expect(localStorage.getItem(CANVAS_CLIPBOARD_KEY)).toBeNull()
    expect(localStorage.getItem(CANVAS_CLIPBOARD_ID_KEY)).toBeNull()
  })
})
