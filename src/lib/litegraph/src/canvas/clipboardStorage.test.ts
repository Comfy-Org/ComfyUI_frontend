import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CANVAS_CLIPBOARD_ID_KEY,
  CANVAS_CLIPBOARD_KEY,
  discardClipboardId,
  discardClipboardStorage,
  isExpectedStorageError,
  readClipboardId
} from './clipboardStorage'

type StorageMethod = 'getItem' | 'setItem' | 'removeItem'

/**
 * Runs `body` with the named `localStorage` methods throwing `SecurityError`,
 * as Firefox does on every access when site storage is blocked. Restores them
 * before returning: the suite's own cleanup calls `removeItem`.
 */
function withBlockedStorage(methods: StorageMethod[], body: () => void): void {
  const spies = methods.map((method) =>
    vi.spyOn(window.localStorage, method).mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })
  )
  try {
    body()
  } finally {
    for (const spy of spies) spy.mockRestore()
  }
}

afterEach(() => {
  localStorage.removeItem(CANVAS_CLIPBOARD_KEY)
  localStorage.removeItem(CANVAS_CLIPBOARD_ID_KEY)
})

describe('isExpectedStorageError', () => {
  it.for([
    { name: 'QuotaExceededError', expected: true },
    { name: 'SecurityError', expected: true },
    { name: 'InvalidStateError', expected: false }
  ])(
    'treats a $name DOMException as expected=$expected',
    ({ name, expected }) => {
      expect(isExpectedStorageError(new DOMException('x', name))).toBe(expected)
    }
  )

  it('does not treat an ordinary Error as expected', () => {
    expect(isExpectedStorageError(new Error('Storage failed'))).toBe(false)
  })
})

describe('readClipboardId', () => {
  it('returns the stored stamp', () => {
    localStorage.setItem(CANVAS_CLIPBOARD_ID_KEY, 'stamp')
    expect(readClipboardId()).toBe('stamp')
  })

  it('returns null instead of throwing when storage is blocked', () => {
    withBlockedStorage(['getItem'], () => {
      expect(readClipboardId()).toBeNull()
    })
  })
})

describe('discardClipboardStorage', () => {
  it('removes both entries', () => {
    localStorage.setItem(CANVAS_CLIPBOARD_KEY, '{}')
    localStorage.setItem(CANVAS_CLIPBOARD_ID_KEY, 'stamp')

    discardClipboardStorage()

    expect(localStorage.getItem(CANVAS_CLIPBOARD_KEY)).toBeNull()
    expect(localStorage.getItem(CANVAS_CLIPBOARD_ID_KEY)).toBeNull()
  })

  it('does not throw when storage is blocked', () => {
    withBlockedStorage(['removeItem'], () => {
      expect(() => discardClipboardStorage()).not.toThrow()
    })
  })
})

describe('discardClipboardId', () => {
  it('removes the stamp and leaves the payload', () => {
    localStorage.setItem(CANVAS_CLIPBOARD_KEY, '{}')
    localStorage.setItem(CANVAS_CLIPBOARD_ID_KEY, 'stamp')

    discardClipboardId()

    expect(localStorage.getItem(CANVAS_CLIPBOARD_KEY)).toBe('{}')
    expect(localStorage.getItem(CANVAS_CLIPBOARD_ID_KEY)).toBeNull()
  })

  it('does not throw when storage is blocked', () => {
    withBlockedStorage(['removeItem'], () => {
      expect(() => discardClipboardId()).not.toThrow()
    })
  })
})
