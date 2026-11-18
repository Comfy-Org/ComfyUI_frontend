import { expect, it, onTestFinished, vi } from 'vitest'

import { readClipboardId } from './clipboardStorage'

it('returns null instead of throwing when storage is blocked', () => {
  const getItem = vi
    .spyOn(window.localStorage, 'getItem')
    .mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })
  onTestFinished(() => getItem.mockRestore())

  expect(readClipboardId()).toBeNull()
})
