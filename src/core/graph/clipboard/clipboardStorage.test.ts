import { expect, it, onTestFinished, vi } from 'vitest'

import { readClipboardStorage } from './clipboardStorage'

it('distinguishes blocked storage from an empty clipboard', () => {
  const getItem = vi
    .spyOn(window.localStorage, 'getItem')
    .mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })
  onTestFinished(() => getItem.mockRestore())

  expect(readClipboardStorage()).toBeUndefined()
})
