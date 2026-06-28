import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createSharedObjectUrl,
  releaseSharedObjectUrl,
  retainSharedObjectUrl
} from './objectUrlUtil'

describe('objectUrlUtil', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('retains and releases shared blob URLs by reference count', () => {
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL')
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')

    const url = createSharedObjectUrl(new Blob(['data']))
    retainSharedObjectUrl(url)
    releaseSharedObjectUrl(url)

    expect(revokeObjectURL).not.toHaveBeenCalled()

    releaseSharedObjectUrl(url)

    expect(revokeObjectURL).toHaveBeenCalledWith(url)
  })

  it('ignores missing and non-blob URLs', () => {
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL')

    retainSharedObjectUrl(undefined)
    retainSharedObjectUrl('https://example.com/image.png')
    releaseSharedObjectUrl(undefined)
    releaseSharedObjectUrl('https://example.com/image.png')

    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it('revokes unknown blob URLs once', () => {
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL')

    releaseSharedObjectUrl('blob:unknown')

    expect(revokeObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:unknown')
  })
})
