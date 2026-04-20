import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useUpload } from '@/composables/useUpload'
import type { UploadResult } from '@/platform/assets/services/uploadService'

const { mockUploadMedia, mockUploadMediaBatch } = vi.hoisted(() => ({
  mockUploadMedia: vi.fn(),
  mockUploadMediaBatch: vi.fn()
}))

vi.mock('@/platform/assets/services/uploadService', () => ({
  uploadMedia: mockUploadMedia,
  uploadMediaBatch: mockUploadMediaBatch
}))

const successResult = (path = 'input/pic.png'): UploadResult => ({
  success: true,
  path,
  name: path.split('/').pop() ?? path,
  subfolder: path.includes('/') ? path.split('/').slice(0, -1).join('/') : '',
  response: { name: path }
})

const makeFile = (name = 'pic.png') =>
  new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' })

describe('useUpload', () => {
  beforeEach(() => {
    mockUploadMedia.mockReset()
    mockUploadMediaBatch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with loading false', () => {
    const { loading } = useUpload()
    expect(loading.value).toBe(false)
  })

  it('sets loading true while upload is in progress', async () => {
    let resolveUpload!: (value: UploadResult) => void
    mockUploadMedia.mockReturnValue(
      new Promise<UploadResult>((resolve) => {
        resolveUpload = resolve
      })
    )

    const { loading, upload } = useUpload()
    const promise = upload({ source: makeFile() })

    await nextTick()
    expect(loading.value).toBe(true)

    resolveUpload(successResult())
    await promise
    expect(loading.value).toBe(false)
  })

  it('resets loading to false when upload fails unexpectedly', async () => {
    mockUploadMedia.mockRejectedValue(new Error('Network error'))

    const { loading, upload } = useUpload()

    await expect(upload({ source: makeFile() })).rejects.toThrow(
      'Network error'
    )
    expect(loading.value).toBe(false)
  })

  it('returns the UploadResult from uploadMedia unchanged', async () => {
    const expected = successResult('sub/pic.png')
    mockUploadMedia.mockResolvedValue(expected)

    const { upload } = useUpload()
    const result = await upload({ source: makeFile() })

    expect(result).toEqual(expected)
  })

  it('passes input and config through to uploadMedia', async () => {
    mockUploadMedia.mockResolvedValue(successResult())

    const { upload } = useUpload()
    const file = makeFile()
    await upload({ source: file }, { type: 'input', subfolder: 'sub' })

    expect(mockUploadMedia).toHaveBeenCalledWith(
      { source: file },
      { type: 'input', subfolder: 'sub' }
    )
  })

  it('skips concurrent calls while upload is in progress', async () => {
    let resolveFirst!: (value: UploadResult) => void
    mockUploadMedia.mockReturnValueOnce(
      new Promise<UploadResult>((resolve) => {
        resolveFirst = resolve
      })
    )

    const { loading, upload } = useUpload()
    const first = upload({ source: makeFile('a.png') })
    await nextTick()
    expect(loading.value).toBe(true)

    const second = await upload({ source: makeFile('b.png') })
    expect(second.success).toBe(false)
    expect(second.error).toBe('Upload already in progress')
    expect(mockUploadMedia).toHaveBeenCalledTimes(1)

    resolveFirst(successResult())
    await first
    expect(loading.value).toBe(false)
  })

  it('tracks loading independently per instance', async () => {
    let resolveFirst!: (value: UploadResult) => void
    mockUploadMedia
      .mockReturnValueOnce(
        new Promise<UploadResult>((resolve) => {
          resolveFirst = resolve
        })
      )
      .mockResolvedValueOnce(successResult('b.png'))

    const first = useUpload()
    const second = useUpload()

    const promise1 = first.upload({ source: makeFile('a.png') })
    await nextTick()

    expect(first.loading.value).toBe(true)
    expect(second.loading.value).toBe(false)

    await second.upload({ source: makeFile('b.png') })
    expect(second.loading.value).toBe(false)
    expect(first.loading.value).toBe(true)

    resolveFirst(successResult('a.png'))
    await promise1
    expect(first.loading.value).toBe(false)
  })

  it('uploadBatch sets loading during batch and passes inputs/config through', async () => {
    let resolveBatch!: (value: UploadResult[]) => void
    mockUploadMediaBatch.mockReturnValue(
      new Promise<UploadResult[]>((resolve) => {
        resolveBatch = resolve
      })
    )

    const { loading, uploadBatch } = useUpload()
    const files = [makeFile('a.png'), makeFile('b.png')]
    const promise = uploadBatch(
      files.map((f) => ({ source: f })),
      { type: 'input' }
    )

    await nextTick()
    expect(loading.value).toBe(true)
    expect(mockUploadMediaBatch).toHaveBeenCalledWith(
      [{ source: files[0] }, { source: files[1] }],
      { type: 'input' }
    )

    resolveBatch([successResult('a.png'), successResult('b.png')])
    await promise
    expect(loading.value).toBe(false)
  })

  it('uploadBatch skips when already loading and returns a skipped result per input', async () => {
    let resolveFirst!: (value: UploadResult) => void
    mockUploadMedia.mockReturnValueOnce(
      new Promise<UploadResult>((resolve) => {
        resolveFirst = resolve
      })
    )

    const { upload, uploadBatch } = useUpload()
    const first = upload({ source: makeFile('a.png') })
    await nextTick()

    const batch = await uploadBatch([
      { source: makeFile('b.png') },
      { source: makeFile('c.png') }
    ])
    expect(batch).toHaveLength(2)
    expect(batch.every((r) => !r.success)).toBe(true)
    expect(batch.every((r) => r.error === 'Upload already in progress')).toBe(
      true
    )
    expect(mockUploadMediaBatch).not.toHaveBeenCalled()

    resolveFirst(successResult('a.png'))
    await first
  })
})
