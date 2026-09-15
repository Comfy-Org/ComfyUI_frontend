import { describe, expect, it, vi } from 'vitest'

import {
  filterUnavailableCoreMediaMenuActions,
  markCoreMediaMenuCallback
} from './coreMediaMenuActionUtils'

describe('core media menu action provenance', () => {
  it('removes the unavailable core action but preserves an extension action with the same label', () => {
    const coreCallback = vi.fn()
    const extensionCallback = vi.fn()
    const coreAction = {
      content: 'Open Image',
      callback: markCoreMediaMenuCallback(coreCallback, 'preview')
    }
    const extensionAction = {
      content: 'Open Image',
      callback: extensionCallback
    }

    expect(
      filterUnavailableCoreMediaMenuActions(
        [coreAction, extensionAction],
        new Set(['preview'])
      )
    ).toEqual([extensionAction])
  })

  it('filters input and preview actions independently', () => {
    const inputAction = {
      content: 'Paste Image',
      callback: markCoreMediaMenuCallback(vi.fn(), 'input')
    }
    const previewAction = {
      content: 'Save Image',
      callback: markCoreMediaMenuCallback(vi.fn(), 'preview')
    }

    expect(
      filterUnavailableCoreMediaMenuActions(
        [inputAction, previewAction],
        new Set(['input'])
      )
    ).toEqual([previewAction])
  })
})
