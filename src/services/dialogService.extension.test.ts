import { expect, it } from 'vitest'

import { useExtensionDialogService } from './dialogService'

it('throws a TypeError before registration', () => {
  expect(() => useExtensionDialogService()).toThrowError(TypeError)
  expect(() => useExtensionDialogService()).toThrow(
    'Extension dialog service accessed before registerExtensionDialogService'
  )
})
