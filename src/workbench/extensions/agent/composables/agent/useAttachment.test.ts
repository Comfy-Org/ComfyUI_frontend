import { describe, expect, it, vi } from 'vitest'

import type { ComposerAttachment } from './useComposer'
import { MAX_ATTACHMENT_BYTES, useAttachment } from './useAttachment'

function fileOfSize(name: string, size: number, type = 'image/png'): File {
  const file = new File(['x'], name, { type })
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
  it('T-07 / PM-675 / FE-1323 accepts picked and dropped MP4 attachments as video tiles', async () => {
    // A video object URL in an <img> renders as a broken thumbnail, so only
    // images get a previewUrl.
    const upload = vi.fn(async (file: File) => ({ ref: file.name }))
    const registry = chipRegistry()
    const { addFiles } = useAttachment({ upload, ...registry })

    await addFiles([
      new File(['x'], 'shot.png', { type: 'image/png' }),
      new File(['x'], 'clip.mp4', { type: 'video/mp4' })
    ])

    const previews = Object.fromEntries(
      registry.chips.map((chip) => [chip.name, chip.previewUrl !== undefined])
    )
    expect(previews).toEqual({ 'shot.png': true, 'clip.mp4': false })
    expect(upload).toHaveBeenCalledTimes(2)
  })

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

  it('uses the resolved limit for each file', async () => {
    const upload = vi.fn(async (file: File) => ({ ref: file.name }))
    const maxBytes = vi.fn((file: File) =>
      file.type.startsWith('video/') ? 30 * 1024 * 1024 : MAX_ATTACHMENT_BYTES
    )
    const registry = chipRegistry()
    const { addFiles } = useAttachment({ upload, maxBytes, ...registry })
    const movie = fileOfSize('movie.mp4', 25 * 1024 * 1024, 'video/mp4')

    await addFiles([movie])

    expect(maxBytes).toHaveBeenCalledWith(movie)
    expect(upload).toHaveBeenCalledWith(movie)
  })

  it('rejects against the resolved limit and warns with that limit', async () => {
    const upload = vi.fn()
    const onError = vi.fn()
    const registry = chipRegistry()
    const { addFiles } = useAttachment({
      upload,
      maxBytes: () => 30 * 1024 * 1024,
      onError,
      ...registry
    })

    await addFiles([fileOfSize('huge.mp4', 30 * 1024 * 1024 + 1, 'video/mp4')])

    expect(registry.chips).toEqual([])
    expect(upload).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith('huge.mp4 is larger than 30MB')
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

  it('stages a deferred file before its source resolves', async () => {
    let resolveFile: (file: File | undefined) => void = () => {}
    const resolve = vi.fn(
      () =>
        new Promise<File | undefined>((done) => {
          resolveFile = done
        })
    )
    const upload = vi.fn(async (file: File) => ({ ref: file.name }))
    const registry = chipRegistry()
    const { addDeferredFile } = useAttachment({ upload, ...registry })

    const pending = addDeferredFile('dropped.mp4', resolve)

    expect(registry.chips).toMatchObject([
      { name: 'dropped.mp4', ref: '', uploading: true }
    ])
    expect(upload).not.toHaveBeenCalled()

    resolveFile(fileOfSize('dropped.mp4', 1024, 'video/mp4'))
    await expect(pending).resolves.toMatchObject({ name: 'dropped.mp4' })
    expect(upload).toHaveBeenCalledOnce()
    expect(registry.chips[0]).toMatchObject({
      ref: 'dropped.mp4',
      uploading: false
    })
  })

  it('removes a deferred chip when its source cannot be resolved', async () => {
    const upload = vi.fn()
    const registry = chipRegistry()
    const { addDeferredFile } = useAttachment({ upload, ...registry })

    await expect(
      addDeferredFile('missing.mp4', async () => undefined)
    ).resolves.toBeUndefined()

    expect(registry.chips).toEqual([])
    expect(upload).not.toHaveBeenCalled()
  })

  it('removes an oversized deferred chip and reports the resolved limit', async () => {
    const upload = vi.fn()
    const onError = vi.fn()
    const registry = chipRegistry()
    const oversized = fileOfSize('large.mp4', 30 * 1024 * 1024 + 1, 'video/mp4')
    const { addDeferredFile } = useAttachment({
      upload,
      maxBytes: () => 30 * 1024 * 1024,
      onError,
      ...registry
    })

    await expect(
      addDeferredFile('large.mp4', async () => oversized)
    ).resolves.toBe(oversized)

    expect(registry.chips).toEqual([])
    expect(upload).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith('large.mp4 is larger than 30MB')
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
})
