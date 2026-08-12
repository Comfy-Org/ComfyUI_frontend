import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createSharedObjectUrl,
  releaseSharedObjectUrl,
  retainSharedObjectUrl
} from '@/utils/objectUrlUtil'

describe('shared object URLs', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('revokes a created URL only after all references are released', () => {
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:test')
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {})

    const url = createSharedObjectUrl(new Blob(['image']))
    retainSharedObjectUrl(url)
    releaseSharedObjectUrl(url)

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).not.toHaveBeenCalled()

    releaseSharedObjectUrl(url)

    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(url)
  })

  it('ignores empty and non-blob URLs', () => {
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {})

    retainSharedObjectUrl(undefined)
    retainSharedObjectUrl('https://example.com/image.png')
    releaseSharedObjectUrl(undefined)
    releaseSharedObjectUrl('https://example.com/image.png')

    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it('revokes unknown blob URLs immediately', () => {
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {})

    releaseSharedObjectUrl('blob:external')

    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:external')
  })
})
