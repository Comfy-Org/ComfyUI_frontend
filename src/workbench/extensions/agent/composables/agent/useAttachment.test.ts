import { describe, expect, it, vi } from 'vitest'

import { MAX_ATTACHMENT_BYTES, useAttachment } from './useAttachment'

function fileOfSize(name: string, size: number): File {
  const file = new File(['x'], name, { type: 'image/png' })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('useAttachment', () => {
  it('rejects files over 20MB before uploading', async () => {
    const upload = vi.fn()
    const onError = vi.fn()
    const { addFiles } = useAttachment({ upload, onError })

    const staged = await addFiles([
      fileOfSize('huge.png', MAX_ATTACHMENT_BYTES + 1)
    ])

    expect(staged).toEqual([])
    expect(upload).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledOnce()
  })

  it('uploads a valid file and forwards its server ref and name', async () => {
    const upload = vi
      .fn()
      .mockResolvedValue({ ref: 'uploaded_cat.png', url: 'blob:cat' })
    const { addFiles } = useAttachment({ upload })

    const staged = await addFiles([fileOfSize('cat.png', 1024)])

    expect(upload).toHaveBeenCalledOnce()
    expect(staged).toEqual([
      {
        id: 'uploaded_cat.png:cat.png',
        name: 'cat.png',
        ref: 'uploaded_cat.png',
        previewUrl: 'blob:cat'
      }
    ])
  })

  it('does not stage a file whose upload fails, and surfaces the error', async () => {
    const upload = vi.fn().mockRejectedValue(new Error('network down'))
    const onError = vi.fn()
    const { addFiles } = useAttachment({ upload, onError })

    const staged = await addFiles([fileOfSize('cat.png', 1024)])

    expect(staged).toEqual([])
    expect(onError).toHaveBeenCalledOnce()
  })

  it('keeps earlier staged files and continues the batch when one upload fails', async () => {
    const upload = vi
      .fn()
      .mockResolvedValueOnce({ ref: 'a.png', url: 'blob:a' })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ ref: 'c.png', url: 'blob:c' })
    const onError = vi.fn()
    const { addFiles, pending } = useAttachment({ upload, onError })

    const staged = await addFiles([
      fileOfSize('a.png', 10),
      fileOfSize('b.png', 10),
      fileOfSize('c.png', 10)
    ])

    expect(staged.map((item) => item.ref)).toEqual(['a.png', 'c.png'])
    expect(onError).toHaveBeenCalledWith('b.png could not be uploaded')
    expect(pending.value).toBe(false)
  })

  it('calls preventDefault before doing any work on drop', async () => {
    const upload = vi.fn().mockResolvedValue({ ref: 'r' })
    const { onDrop } = useAttachment({ upload })
    const preventDefault = vi.fn()
    const event = {
      preventDefault,
      dataTransfer: { files: [] as unknown as FileList }
    } as unknown as DragEvent

    await onDrop(event)
    expect(preventDefault).toHaveBeenCalledOnce()
  })
})
