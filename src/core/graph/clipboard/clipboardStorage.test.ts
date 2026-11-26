import { expect, it, onTestFinished, vi } from 'vitest'

import { safeLocalStorage } from '@/base/storage/safeStorage'

import { readClipboardStorage } from './clipboardStorage'

it('distinguishes blocked storage from an empty clipboard', () => {
  expect(safeLocalStorage.backend).toBe('localStorage')
  const getItem = vi
    .spyOn(window.localStorage, 'getItem')
    .mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })
  onTestFinished(() => getItem.mockRestore())

  expect(readClipboardStorage()).toBeUndefined()
})
