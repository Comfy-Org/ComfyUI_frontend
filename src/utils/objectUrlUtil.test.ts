import { describe, expect, it, vi } from 'vitest'

import {
  createSharedObjectUrl,
  releaseSharedObjectUrl,
  retainSharedObjectUrl
} from './objectUrlUtil'

describe('objectUrlUtil', () => {
  it('creates and releases an object URL', () => {
    const revokespy = vi.spyOn(URL, 'revokeObjectURL')
    const url = createSharedObjectUrl(new Blob(['test']))
    expect(url).toMatch(/^blob:/)

    releaseSharedObjectUrl(url)
    expect(revokespy).toHaveBeenCalledWith(url)
    revokespy.mockRestore()
  })

  it('retains and releases with ref counting', () => {
    const revokespy = vi.spyOn(URL, 'revokeObjectURL')
    const url = createSharedObjectUrl(new Blob(['test']))

    retainSharedObjectUrl(url)
    releaseSharedObjectUrl(url)
    expect(revokespy).not.toHaveBeenCalled()

    releaseSharedObjectUrl(url)
    expect(revokespy).toHaveBeenCalledWith(url)
    revokespy.mockRestore()
  })

  it('ignores non-blob URLs', () => {
    const revokespy = vi.spyOn(URL, 'revokeObjectURL')

    retainSharedObjectUrl('https://example.com')
    releaseSharedObjectUrl('https://example.com')
    expect(revokespy).not.toHaveBeenCalled()

    retainSharedObjectUrl(undefined)
    releaseSharedObjectUrl(undefined)
    expect(revokespy).not.toHaveBeenCalled()

    revokespy.mockRestore()
  })
})
