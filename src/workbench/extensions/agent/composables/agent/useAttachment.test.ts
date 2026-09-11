import { describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'

import type { ComposerAttachment } from './useComposer'
import {
  MAX_ATTACHMENT_BYTES,
  resolveAttachmentLimit,
  useAttachment
} from './useAttachment'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

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
  it('adds previews for picked images but not picked videos', async () => {
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
    expect(onError).toHaveBeenCalledWith('huge.png is larger than 20 MB')
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
    expect(upload).toHaveBeenCalledWith(movie, expect.any(AbortSignal))
  })

  it('stages a whole batch before uploading it concurrently', async () => {
    const resolvers: Array<(result: { ref: string }) => void> = []
    const upload = vi.fn(
      () =>
        new Promise<{ ref: string }>((resolve) => {
          resolvers.push(resolve)
        })
    )
    const registry = chipRegistry()
    const { addFiles } = useAttachment({ upload, ...registry })

    const pending = addFiles([
      fileOfSize('a.png', 1),
      fileOfSize('b.png', 1),
      fileOfSize('c.png', 1)
    ])

    expect(registry.chips.map(({ name }) => name)).toEqual([
      'a.png',
      'b.png',
      'c.png'
    ])
    expect(upload).toHaveBeenCalledTimes(3)

    resolvers[2]({ ref: 'c.png' })
    resolvers[0]({ ref: 'a.png' })
    resolvers[1]({ ref: 'b.png' })
    await pending
    expect(registry.chips.map(({ ref }) => ref)).toEqual([
      'a.png',
      'b.png',
      'c.png'
    ])
  })

  it('aborts and removes an upload that exceeds the configured timeout', async () => {
    vi.useFakeTimers()
    try {
      let signal: AbortSignal | undefined
      const upload = vi.fn((_file: File, uploadSignal?: AbortSignal) => {
        signal = uploadSignal
        return new Promise<{ ref: string }>(() => {})
      })
      const onError = vi.fn()
      const registry = chipRegistry()
      const { addFiles } = useAttachment({
        upload,
        uploadTimeoutMs: 1000,
        onError,
        ...registry
      })

      const pending = addFiles([fileOfSize('stuck.png', 1)])
      await vi.advanceTimersByTimeAsync(1000)
      await pending

      expect(signal?.aborted).toBe(true)
      expect(registry.chips).toEqual([])
      expect(onError).toHaveBeenCalledWith('stuck.png could not be uploaded')
    } finally {
      vi.useRealTimers()
    }
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
    expect(onError).toHaveBeenCalledWith('huge.mp4 is larger than 30 MB')
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
    expect(onError).toHaveBeenCalledWith('large.mp4 is larger than 30 MB')
  })

  it('removes the chip and surfaces the error when the upload fails', async () => {
    const cause = new Error('network down')
    const upload = vi.fn().mockRejectedValue(cause)
    const onError = vi.fn()
    const registry = chipRegistry()
    const { addFiles } = useAttachment({ upload, onError, ...registry })

    await addFiles([fileOfSize('cat.png', 1024)])

    expect(registry.chips).toEqual([])
    expect(onError).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(cause, {
      errorType: 'agent_attachment_upload_failed'
    })
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

  it('keeps a dropped folder from saturating the connection pool', async () => {
    const resolvers: Array<(result: { ref: string }) => void> = []
    const upload = vi.fn(() => {
      return new Promise<{ ref: string }>((resolve) => {
        resolvers.push(resolve)
      })
    })
    const registry = chipRegistry()
    const { addFiles } = useAttachment({ upload, ...registry })

    const pending = addFiles(
      Array.from({ length: 8 }, (_unused, index) =>
        fileOfSize(`${index}.png`, 1)
      )
    )

    expect(registry.chips).toHaveLength(8)
    expect(upload).toHaveBeenCalledTimes(3)

    resolvers[0]({ ref: '0.png' })
    await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(4))

    await vi.waitFor(() => {
      for (const resolve of resolvers) resolve({ ref: 'done' })
      expect(upload).toHaveBeenCalledTimes(8)
    })
    await pending
  })

  it('scales the upload deadline to the file size', async () => {
    vi.useFakeTimers()
    try {
      let signal: AbortSignal | undefined
      const upload = vi.fn((_file: File, uploadSignal: AbortSignal) => {
        signal = uploadSignal
        return new Promise<{ ref: string }>(() => {})
      })
      const registry = chipRegistry()
      const { addFiles } = useAttachment({
        upload,
        maxBytes: () => 200 * 1024 * 1024,
        ...registry
      })

      const pending = addFiles([fileOfSize('big.png', 100 * 1024 * 1024)])
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

      expect(signal?.aborted).toBe(false)

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
      await pending
      expect(signal?.aborted).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('aborts a cancelled upload without reporting it as a failure', async () => {
    let signal: AbortSignal | undefined
    const upload = vi.fn((_file: File, uploadSignal: AbortSignal) => {
      signal = uploadSignal
      return new Promise<{ ref: string }>((_resolve, reject) => {
        uploadSignal.addEventListener('abort', () =>
          reject(uploadSignal.reason)
        )
      })
    })
    const onError = vi.fn()
    const registry = chipRegistry()
    const { addFiles, cancelUpload } = useAttachment({
      upload,
      onError,
      ...registry
    })

    const pending = addFiles([fileOfSize('cat.png', 1024)])
    cancelUpload(registry.chips[0].id)
    await pending

    expect(signal?.aborted).toBe(true)
    expect(onError).not.toHaveBeenCalled()
  })

  it('never starts an upload cancelled while it waited in the queue', async () => {
    const resolvers: Array<() => void> = []
    const upload = vi.fn((file: File) => {
      return new Promise<{ ref: string }>((resolve) => {
        resolvers.push(() => resolve({ ref: file.name }))
      })
    })
    const onError = vi.fn()
    const registry = chipRegistry()
    const { addFiles, cancelUpload } = useAttachment({
      upload,
      onError,
      ...registry
    })

    const pending = addFiles(
      Array.from({ length: 4 }, (_unused, index) =>
        fileOfSize(`${index}.png`, 1)
      )
    )
    const queued = registry.chips[3]
    cancelUpload(queued.id)

    await vi.waitFor(() => {
      for (const resolve of resolvers) resolve()
      expect(upload).toHaveBeenCalledTimes(3)
    })
    await pending

    expect(upload).toHaveBeenCalledTimes(3)
    expect(onError).not.toHaveBeenCalled()
  })

  it('aborts every in-flight upload when the panel goes away', async () => {
    const signals: AbortSignal[] = []
    const upload = vi.fn((_file: File, uploadSignal: AbortSignal) => {
      signals.push(uploadSignal)
      return new Promise<{ ref: string }>((_resolve, reject) => {
        uploadSignal.addEventListener('abort', () =>
          reject(uploadSignal.reason)
        )
      })
    })
    const registry = chipRegistry()
    const { addFiles, cancelAllUploads } = useAttachment({
      upload,
      ...registry
    })

    const pending = addFiles([fileOfSize('a.png', 1), fileOfSize('b.png', 1)])
    cancelAllUploads()
    await pending

    expect(signals.map(({ aborted }) => aborted)).toEqual([true, true])
  })

  it('removes a deferred chip whose source never resolves', async () => {
    vi.useFakeTimers()
    try {
      const upload = vi.fn()
      const onError = vi.fn()
      const registry = chipRegistry()
      const { addDeferredFile } = useAttachment({
        upload,
        onError,
        ...registry
      })

      const pending = addDeferredFile(
        'stuck.mp4',
        () => new Promise<File | undefined>(() => {})
      )
      await vi.advanceTimersByTimeAsync(60 * 1000)

      await expect(pending).resolves.toBeUndefined()
      expect(registry.chips).toEqual([])
      expect(upload).not.toHaveBeenCalled()
      expect(onError).toHaveBeenCalledWith('stuck.mp4 could not be uploaded')
      expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
        errorType: 'agent_attachment_fetch_failed'
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('signals a settled batch once, not once per file', async () => {
    const upload = vi.fn(async (file: File) => ({ ref: file.name }))
    const onUploaded = vi.fn()
    const registry = chipRegistry()
    const { addFiles } = useAttachment({ upload, onUploaded, ...registry })

    await addFiles([
      fileOfSize('a.png', 1),
      fileOfSize('b.png', 1),
      fileOfSize('c.png', 1)
    ])

    expect(onUploaded).toHaveBeenCalledOnce()
  })
})

describe('resolveAttachmentLimit', () => {
  const MULTIPART_ENVELOPE_BYTES = 1024

  it('falls back to the built-in limit for an unusable advertised value', () => {
    for (const advertised of [undefined, null, 0, -1, Number.NaN, '100MB'])
      expect(resolveAttachmentLimit(advertised)).toBeLessThanOrEqual(
        MAX_ATTACHMENT_BYTES
      )
    expect(resolveAttachmentLimit(null)).toBe(
      MAX_ATTACHMENT_BYTES - MULTIPART_ENVELOPE_BYTES
    )
  })

  it('keeps a client ceiling below an implausible advertised value', () => {
    expect(resolveAttachmentLimit(Number.MAX_SAFE_INTEGER)).toBe(
      512 * 1024 * 1024 - MULTIPART_ENVELOPE_BYTES
    )
  })

  it('leaves room for the multipart envelope the server also counts', () => {
    const advertised = 100 * 1024 * 1024
    expect(resolveAttachmentLimit(advertised)).toBe(
      advertised - MULTIPART_ENVELOPE_BYTES
    )
  })
})
