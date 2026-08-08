import { describe, expect, it, vi } from 'vitest'

import type { ComposerAttachment } from './useComposer'
import { MAX_ATTACHMENT_BYTES, useAttachment } from './useAttachment'

function fileOfSize(name: string, size: number): File {
  const file = new File(['x'], name, { type: 'image/png' })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function chipRegistry() {
  const chips: ComposerAttachment[] = []
  return {
    chips,
    stage: (attachment: ComposerAttachment) => chips.push(attachment),
    update: (id: string, patch: Partial<ComposerAttachment>) => {
      const index = chips.findIndex((chip) => chip.id === id)
      if (index >= 0) chips[index] = { ...chips[index], ...patch }
    },
    remove: (id: string) => {
      const index = chips.findIndex((chip) => chip.id === id)
      if (index >= 0) chips.splice(index, 1)
    }
  }
}

describe('useAttachment', () => {
  it('rejects files over 20MB before staging or uploading', async () => {
    const upload = vi.fn()
    const onError = vi.fn()
    const registry = chipRegistry()
    const { addFiles } = useAttachment({ upload, onError, ...registry })

    await addFiles([fileOfSize('huge.png', MAX_ATTACHMENT_BYTES + 1)])

    expect(registry.chips).toEqual([])
    expect(upload).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith('huge.png is larger than 20MB')
  })

  it('stages an uploading chip immediately, then settles it with the server ref', async () => {
    let resolveUpload: (result: { ref: string }) => void = () => {}
    const upload = vi.fn(
      () =>
        new Promise<{ ref: string }>((resolve) => {
          resolveUpload = resolve
        })
    )
    const registry = chipRegistry()
    const { addFiles } = useAttachment({ upload, ...registry })

    const batch = addFiles([fileOfSize('cat.png', 1024)])

    expect(registry.chips).toHaveLength(1)
    expect(registry.chips[0]).toMatchObject({
      name: 'cat.png',
      ref: '',
      uploading: true
    })
    expect(registry.chips[0].previewUrl).toBeTruthy()

    resolveUpload({ ref: 'uploaded_cat.png' })
    await batch
    expect(registry.chips[0]).toMatchObject({
      ref: 'uploaded_cat.png',
      uploading: false
    })
  })

  it('removes the chip and surfaces the error when the upload fails', async () => {
    const upload = vi.fn().mockRejectedValue(new Error('network down'))
    const onError = vi.fn()
    const registry = chipRegistry()
    const { addFiles } = useAttachment({ upload, onError, ...registry })

    await addFiles([fileOfSize('cat.png', 1024)])

    expect(registry.chips).toEqual([])
    expect(onError).toHaveBeenCalledOnce()
  })

  it('keeps earlier settled chips and continues the batch when one upload fails', async () => {
    const upload = vi
      .fn()
      .mockResolvedValueOnce({ ref: 'a.png' })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ ref: 'c.png' })
    const onError = vi.fn()
    const registry = chipRegistry()
    const { addFiles } = useAttachment({ upload, onError, ...registry })

    await addFiles([
      fileOfSize('a.png', 10),
      fileOfSize('b.png', 10),
      fileOfSize('c.png', 10)
    ])

    expect(registry.chips.map((chip) => chip.ref)).toEqual(['a.png', 'c.png'])
    expect(registry.chips.every((chip) => chip.uploading === false)).toBe(true)
    expect(onError).toHaveBeenCalledWith('b.png could not be uploaded')
  })

  it('calls preventDefault before doing any work on drop', async () => {
    const upload = vi.fn().mockResolvedValue({ ref: 'r' })
    const registry = chipRegistry()
    const { onDrop } = useAttachment({ upload, ...registry })
    const preventDefault = vi.fn()
    const event = {
      preventDefault,
      dataTransfer: { files: [] as unknown as FileList }
    } as unknown as DragEvent

    await onDrop(event)
    expect(preventDefault).toHaveBeenCalledOnce()
  })
})
