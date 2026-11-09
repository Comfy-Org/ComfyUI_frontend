import { describe, expect, it, vi } from 'vitest'

import {
  discardClipboardId,
  isExpectedStorageError,
  readClipboardId
} from './clipboardStorage'

type StorageMethod = 'getItem' | 'setItem' | 'removeItem'

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
  it('returns null instead of throwing when storage is blocked', () => {
    withBlockedStorage(['getItem'], () => {
      expect(readClipboardId()).toBeNull()
    })
  })
})

describe('discardClipboardId', () => {
  it('does not throw when storage is blocked', () => {
    withBlockedStorage(['removeItem'], () => {
      expect(() => discardClipboardId()).not.toThrow()
    })
  })
})
