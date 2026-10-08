import { describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'
import {
  AgentApiError,
  AgentResponseUnreadableError
} from '../../services/agent/agentRestClient'
import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import type { ComposerAttachment } from '../../types/composerAttachment'
import { MAX_ATTACHMENT_BYTES, useAttachment } from './useAttachment'

vi.mock(import('@/platform/telemetry/reportError'))

function fileOfSize(name: string, size: number, type = 'image/png'): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function identicalFile(name: string, size: number, type = 'image/png'): File {
  const file = new File(['x'], name, { type, lastModified: 0 })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function chipRegistry() {
  const chips: ComposerAttachment[] = []
  return {
    chips,
    stage: (attachment: ComposerAttachment) => {
      chips.push(attachment)
      return true
    },
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
  it('deduplicates a file within a batch and across pending drops', async () => {
    const store = useAgentComposerStore()
    const upload = vi.fn(async (file: File) => ({ ref: file.name }))
    const onDuplicate = vi.fn()
    const { addFiles } = useAttachment({
      upload,
      onDuplicate,
      stage: store.addAttachment,
      update: store.updateAttachment,
      remove: store.removeAttachment
    })
    const file = new File(['image'], 'cat.png', { lastModified: 1 })
    const batch = addFiles([file, file, file])
    expect(onDuplicate).toHaveBeenCalledExactlyOnceWith(['cat.png', 'cat.png'])
    const repeated = addFiles([
      new File(['image'], 'cat.png', { lastModified: 1 })
    ])
    expect(store.attachments).toHaveLength(1)
    await expect(repeated).resolves.toBe(false)
    await expect(batch).resolves.toBe(true)
    expect(upload).toHaveBeenCalledOnce()
    expect(onDuplicate).toHaveBeenLastCalledWith(['cat.png'])
    expect(onDuplicate).toHaveBeenCalledTimes(2)
  })

  it('ignores a settled duplicate but allows a removed file to be added again', async () => {
    const store = useAgentComposerStore()
    const upload = vi.fn(async (file: File) => ({ ref: file.name }))
    const onDuplicate = vi.fn()
    const { addFiles } = useAttachment({
      upload,
      onDuplicate,
      stage: store.addAttachment,
      update: store.updateAttachment,
      remove: store.removeAttachment
    })
    const file = new File(['image'], 'cat.png', { lastModified: 1 })
    await addFiles([file])
    expect(onDuplicate).not.toHaveBeenCalled()
    const original = store.attachments[0]
    store.referenceAttachment(original.id)
    store.referenceAttachment(original.id)
    await expect(addFiles([file])).resolves.toBe(false)
    expect(store.attachments).toEqual([original])
    expect(store.prompt.references).toHaveLength(2)
    store.removeAttachment(original.id)
    await expect(addFiles([file])).resolves.toBe(true)
    expect(store.attachments).toHaveLength(1)
    expect(store.attachments[0].id).not.toBe(original.id)
    expect(store.attachments[0].ref).toBe('cat.png')
    expect(upload).toHaveBeenCalledOnce()
    expect(onDuplicate).toHaveBeenCalledExactlyOnceWith(['cat.png'])
  })

  it.for([
    { body: 'different size', lastModified: 1 },
    { body: 'image', lastModified: 2 }
  ])(
    'keeps same-named files with distinct source metadata: %j',
    async (source) => {
      const store = useAgentComposerStore()
      const upload = vi.fn(async (file: File) => ({ ref: file.name }))
      const { addFiles } = useAttachment({
        upload,
        stage: store.addAttachment,
        update: store.updateAttachment,
        remove: store.removeAttachment
      })
      await addFiles([
        new File(['image'], 'cat.png', { lastModified: 1 }),
        new File([source.body], 'cat.png', {
          lastModified: source.lastModified
        })
      ])
      expect(store.attachments.map(({ name }) => name)).toEqual([
        'cat.png',
        'cat.png'
      ])
      expect(upload).toHaveBeenCalledTimes(2)
    }
  )

  it('allows a failed file upload to be retried', async () => {
    const store = useAgentComposerStore()
    const upload = vi.fn(async (file: File) => ({ ref: file.name }))
    upload.mockRejectedValueOnce(new Error('Upload failed'))
    const onDuplicate = vi.fn()
    const { addFiles } = useAttachment({
      upload,
      onDuplicate,
      stage: store.addAttachment,
      update: store.updateAttachment,
      remove: store.removeAttachment
    })
    const file = new File(['image'], 'cat.png', { lastModified: 1 })
    await expect(addFiles([file])).resolves.toBe(false)
    await expect(addFiles([file])).resolves.toBe(true)
    expect(store.attachments).toHaveLength(1)
    expect(upload).toHaveBeenCalledTimes(2)
    expect(onDuplicate).not.toHaveBeenCalled()
  })

  it('keeps a fresh re-addition after a cancelled upload settles late', async () => {
    const store = useAgentComposerStore()
    let resolveOldUpload: (result: { ref: string }) => void = () => {}
    const oldUpload = new Promise<{ ref: string }>((resolve) => {
      resolveOldUpload = resolve
    })
    const upload = vi.fn(async (file: File) => ({ ref: file.name }))
    upload.mockReturnValueOnce(oldUpload)
    const { addFiles, cancelUpload } = useAttachment({
      upload,
      stage: store.addAttachment,
      update: store.updateAttachment,
      remove: store.removeAttachment
    })
    const file = new File(['image'], 'cat.png', { lastModified: 1 })
    const pending = addFiles([file])
    const oldId = store.attachments[0].id
    cancelUpload(oldId)
    await expect(addFiles([file])).resolves.toBe(true)
    const replacement = store.attachments[0]
    expect(replacement.id).not.toBe(oldId)
    resolveOldUpload({ ref: 'obsolete.png' })
    await pending
    expect(store.attachments).toEqual([replacement])
    expect(replacement.ref).toBe('cat.png')
  })

  it('keeps same-named deferred files from distinct source URIs', async () => {
    const store = useAgentComposerStore()
    const upload = vi.fn(async (file: File) => ({ ref: file.name }))
    const resolve = async () => new File(['image'], 'cat.png')
    const { addDeferredFile } = useAttachment({
      upload,
      stage: store.addAttachment,
      update: store.updateAttachment,
      remove: store.removeAttachment
    })
    await Promise.all([
      addDeferredFile('cat.png', resolve, 'uri:/first'),
      addDeferredFile('cat.png', resolve, 'uri:/second')
    ])
    expect(store.attachments).toHaveLength(2)
    expect(upload).toHaveBeenCalledTimes(2)
  })

  it('deduplicates a deferred source while loading and after upload', async () => {
    const store = useAgentComposerStore()
    const upload = vi.fn(async (file: File) => ({ ref: file.name }))
    const resolve = vi.fn(async () => new File(['image'], 'cat.png'))
    const { addDeferredFile } = useAttachment({
      upload,
      stage: store.addAttachment,
      update: store.updateAttachment,
      remove: store.removeAttachment
    })
    const pending = addDeferredFile('cat.png', resolve, 'uri:/source')
    const repeated = addDeferredFile('cat.png', resolve, 'uri:/source')
    expect(store.attachments).toHaveLength(1)
    await expect(repeated).resolves.toBe('duplicate')
    await expect(pending).resolves.toBe('uploaded')
    await expect(
      addDeferredFile('cat.png', resolve, 'uri:/source')
    ).resolves.toBe('duplicate')
    expect(resolve).toHaveBeenCalledOnce()
    expect(upload).toHaveBeenCalledOnce()
  })

  it('keeps image preview URLs separate from picked video sources', async () => {
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

  it.for([
    { name: 'clip.mp4', type: 'video/mp4', mediaKind: 'video' },
    { name: 'recording', type: 'audio/mpeg', mediaKind: 'audio' }
  ])(
    'previews picked $mediaKind while uploading and then uses its server file',
    async ({ name, type, mediaKind }) => {
      let resolveUpload: (result: {
        ref: string
        url: string
      }) => void = () => {}
      const registry = chipRegistry()
      const { addFiles } = useAttachment({
        ...registry,
        upload: () =>
          new Promise((resolve) => {
            resolveUpload = resolve
          })
      })
      const pending = addFiles([new File(['media'], name, { type })])
      expect(registry.chips[0]).toMatchObject({
        mediaKind,
        mediaUrl: expect.stringMatching(/^blob:/),
        uploading: true
      })
      expect(registry.chips[0].previewUrl).toBeUndefined()
      resolveUpload({
        ref: 'stored-media',
        url: '/api/view?filename=stored-media&type=input'
      })
      await pending
      expect(registry.chips[0]).toMatchObject({
        mediaKind,
        mediaUrl: '/api/view?filename=stored-media&type=input',
        uploading: false
      })
      expect(registry.chips[0].previewUrl).toBeUndefined()
    }
  )

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
    let resolveUpload: (result: {
      ref: string
      url?: string
    }) => void = () => {}
    const upload = vi.fn(
      () =>
        new Promise<{ ref: string; url?: string }>((resolve) => {
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

    resolveUpload({
      ref: 'uploaded_cat.png',
      url: '/api/view?filename=uploaded_cat.png&type=input'
    })
    await batch
    expect(registry.chips[0]).toMatchObject({
      ref: 'uploaded_cat.png',
      previewUrl: '/api/view?filename=uploaded_cat.png&type=input',
      uploading: false
    })
  })

  it('reuses the prior upload when the same file is attached again', async () => {
    const upload = vi.fn(async (file: File) => ({
      ref: `uploaded_${file.name}`
    }))
    const registry = chipRegistry()
    const { addFiles } = useAttachment({ upload, ...registry })

    await addFiles([identicalFile('cat.png', 1024)])
    await addFiles([identicalFile('cat.png', 1024)])

    expect(upload).toHaveBeenCalledOnce()
    expect(registry.chips.map(({ ref }) => ref)).toEqual([
      'uploaded_cat.png',
      'uploaded_cat.png'
    ])
  })

  it('uploads again when the same name and size carry different content', async () => {
    const upload = vi.fn(async (file: File) => ({
      ref: `uploaded_${file.name}`
    }))
    const registry = chipRegistry()
    const { addFiles } = useAttachment({ upload, ...registry })

    await addFiles([identicalFile('cat.png', 1024)])
    const edited = identicalFile('cat.png', 1024)
    Object.defineProperty(edited, 'lastModified', { value: 1 })
    await addFiles([edited])

    expect(upload).toHaveBeenCalledTimes(2)
  })

  it('uploads distinct bytes even when all file metadata matches', async () => {
    const upload = vi
      .fn<(file: File) => Promise<{ ref: string }>>()
      .mockResolvedValueOnce({ ref: 'first.png' })
      .mockResolvedValueOnce({ ref: 'second.png' })
    const registry = chipRegistry()
    const { addFiles } = useAttachment({ upload, ...registry })

    await addFiles([
      new File(['cat-a'], 'cat.png', { lastModified: 0, type: 'image/png' })
    ])
    await addFiles([
      new File(['cat-b'], 'cat.png', { lastModified: 0, type: 'image/png' })
    ])

    expect(upload).toHaveBeenCalledTimes(2)
    expect(registry.chips.map(({ ref }) => ref)).toEqual([
      'first.png',
      'second.png'
    ])
  })

  it('uploads the same file again once completed uploads are forgotten', async () => {
    const upload = vi.fn(async (file: File) => ({
      ref: `uploaded_${file.name}`
    }))
    const registry = chipRegistry()
    const { addFiles, forgetUploads } = useAttachment({ upload, ...registry })

    await addFiles([identicalFile('cat.png', 1024)])
    forgetUploads()
    await addFiles([identicalFile('cat.png', 1024)])

    expect(upload).toHaveBeenCalledTimes(2)
  })

  it('does not reuse an upload that finished after uploads were forgotten', async () => {
    let finishFirst: (result: { ref: string }) => void = () => {}
    const upload = vi
      .fn<(file: File) => Promise<{ ref: string }>>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = resolve
          })
      )
      .mockResolvedValue({ ref: 'uploaded_again.png' })
    const registry = chipRegistry()
    const { addFiles, forgetUploads } = useAttachment({ upload, ...registry })

    const first = addFiles([identicalFile('cat.png', 1024)])
    forgetUploads()
    finishFirst({ ref: 'uploaded_before.png' })
    await first
    await addFiles([identicalFile('cat.png', 1024)])

    expect(upload).toHaveBeenCalledTimes(2)
    expect(registry.chips.map(({ ref }) => ref)).toEqual([
      'uploaded_before.png',
      'uploaded_again.png'
    ])
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
    await expect(pending).resolves.toBe('uploaded')
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
    ).resolves.toBe('unsupported')

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
    ).resolves.toBe('failed')

    expect(registry.chips).toEqual([])
    expect(upload).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith('large.mp4 is larger than 30 MB')
  })

  it('removes the chip and surfaces the error when the upload fails', async () => {
    const privateFilename = 'private-cat.png'
    const privatePath = `/Users/alice/Secret/${privateFilename}`
    const error = new Error(`upload failed for ${privatePath}`)
    const upload = vi.fn().mockRejectedValue(error)
    const onError = vi.fn()
    const registry = chipRegistry()
    const { addFiles } = useAttachment({ upload, onError, ...registry })

    await addFiles([fileOfSize(privateFilename, 1024, 'image/png')])

    expect(registry.chips).toEqual([])
    expect(onError).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      surface: 'agent',
      errorType: 'agent_attachment_upload_failed',
      tags: {
        failure_kind: 'caught_unexpected',
        feature_area: 'agent',
        operation: 'save',
        outcome: 'failed',
        integration_target: 'assets',
        feature_flag: 'agent_panel',
        feature_flag_state: 'enabled',
        project_context: 'agent_composer',
        upload_failure_cause: 'unknown',
        file_type: 'image/png',
        file_size_bytes: 1024
      }
    })
    const reportedError = vi.mocked(reportError).mock.calls[0][0] as Error
    expect(reportedError).not.toBe(error)
    expect(reportedError.message).toBe('Agent attachment upload failed')
    expect(`${reportedError.message}\n${reportedError.stack}`).not.toContain(
      privateFilename
    )
    expect(`${reportedError.message}\n${reportedError.stack}`).not.toContain(
      privatePath
    )
  })

  it.for([
    {
      label: 'an API error',
      cause: new AgentApiError('nope', 503, undefined),
      expectedCause: 'http_503'
    },
    {
      label: 'an unreadable response',
      cause: new AgentResponseUnreadableError(new Error('bad json')),
      expectedCause: 'unreadable_response'
    },
    {
      label: 'an upload error with a timeout-like message',
      cause: new Error('Timed out after an upstream timeout'),
      expectedCause: 'unknown'
    }
  ])(
    'tags the upload failure cause for $label',
    async ({ cause, expectedCause }) => {
      const upload = vi.fn().mockRejectedValue(cause)
      const registry = chipRegistry()
      const { addFiles } = useAttachment({ upload, ...registry })

      await addFiles([fileOfSize('shot.png', 2048, 'image/png')])

      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            upload_failure_cause: expectedCause,
            file_type: 'image/png',
            file_size_bytes: 2048
          })
        })
      )
    }
  )

  it.for([
    { label: 'empty', fileType: '' },
    { label: 'overlong', fileType: `application/${'x'.repeat(128)}` }
  ])(
    'reports a $label browser-provided MIME type as unknown',
    async ({ fileType }) => {
      const upload = vi.fn().mockRejectedValue(new Error('upload failed'))
      const registry = chipRegistry()
      const { addFiles } = useAttachment({ upload, ...registry })

      await addFiles([fileOfSize('unknown.bin', 128, fileType)])

      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            file_type: 'unknown',
            file_size_bytes: 128
          })
        })
      )
    }
  )

  it('does not report a path from a constructed MIME parameter', async () => {
    const privatePath = '/Users/alice/Secret/private.txt'
    const upload = vi.fn().mockRejectedValue(new Error('upload failed'))
    const registry = chipRegistry()
    const { addFiles } = useAttachment({ upload, ...registry })

    await addFiles([
      fileOfSize('unknown.bin', 128, `text/plain; name="${privatePath}"`)
    ])

    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ file_type: 'unknown' })
      })
    )
    expect(JSON.stringify(vi.mocked(reportError).mock.calls)).not.toContain(
      privatePath
    )
  })

  it('tags an aborted-by-timeout upload with the timeout failure cause', async () => {
    vi.useFakeTimers()
    try {
      const upload = vi.fn(() => new Promise<{ ref: string }>(() => {}))
      const registry = chipRegistry()
      const { addFiles } = useAttachment({
        upload,
        uploadTimeoutMs: 1000,
        ...registry
      })

      const pending = addFiles([fileOfSize('stuck.png', 512, 'image/png')])
      await vi.advanceTimersByTimeAsync(1000)
      await pending

      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            upload_failure_cause: 'timeout',
            file_type: 'image/png',
            file_size_bytes: 512
          })
        })
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('tags a non-cancelled AbortError upload with the aborted failure cause', async () => {
    const upload = vi
      .fn()
      .mockRejectedValue(new DOMException('request aborted', 'AbortError'))
    const registry = chipRegistry()
    const { addFiles } = useAttachment({ upload, ...registry })

    await addFiles([fileOfSize('shot.png', 512, 'image/png')])

    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({
          upload_failure_cause: 'aborted',
          file_type: 'image/png',
          file_size_bytes: 512
        })
      })
    )
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

  it('shares three upload slots across overlapping selections and deferred assets', async () => {
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let active = 0
    let peak = 0
    const upload = vi.fn(async (file: File) => {
      active += 1
      peak = Math.max(peak, active)
      await gate
      active -= 1
      return { ref: file.name }
    })
    const registry = chipRegistry()
    const { addFiles, addDeferredFile } = useAttachment({
      upload,
      ...registry
    })

    const first = addFiles(['a', 'b', 'c'].map((name) => fileOfSize(name, 1)))
    const second = addFiles(['d', 'e', 'f'].map((name) => fileOfSize(name, 1)))
    const deferred = addDeferredFile('g', async () => fileOfSize('g', 1))
    await Promise.resolve()
    const startedBeforeRelease = upload.mock.calls.length
    release()
    await Promise.all([first, second, deferred])

    expect(startedBeforeRelease).toBe(3)
    expect(peak).toBe(3)
    expect(registry.chips.map(({ ref }) => ref)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g'
    ])
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
    expect(registry.chips).toEqual([])
    await pending

    expect(signal?.aborted).toBe(true)
    expect(registry.chips).toEqual([])
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
    expect(registry.chips.map(({ name }) => name)).toEqual([
      '0.png',
      '1.png',
      '2.png'
    ])

    await vi.waitFor(() => {
      for (const resolve of resolvers) resolve()
      expect(upload).toHaveBeenCalledTimes(3)
    })
    await pending

    expect(upload).toHaveBeenCalledTimes(3)
    expect(onError).not.toHaveBeenCalled()
  })

  it('removes active and queued uploads synchronously when the panel goes away', async () => {
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

    const pending = addFiles(
      ['a.png', 'b.png', 'c.png', 'queued.png'].map((name) =>
        fileOfSize(name, 1)
      )
    )
    cancelAllUploads()
    expect(registry.chips).toEqual([])
    await pending

    expect(signals.map(({ aborted }) => aborted)).toEqual([true, true, true])
    expect(registry.chips).toEqual([])
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

      await expect(pending).resolves.toBe('failed')
      expect(registry.chips).toEqual([])
      expect(upload).not.toHaveBeenCalled()
      expect(onError).toHaveBeenCalledWith('stuck.mp4 could not be uploaded')
      expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
        surface: 'agent',
        errorType: 'agent_attachment_fetch_failed',
        tags: expect.objectContaining({
          feature_area: 'agent',
          integration_target: 'assets',
          outcome: 'failed',
          upload_failure_cause: 'timeout',
          file_type: 'unknown',
          file_size_bytes: -1
        })
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it.for(['rejected', 'oversized', 'unsupported'] as const)(
    'ignores a %s deferred source after cancellation',
    async (outcome) => {
      let resolveSource: (file: File | undefined) => void = () => {}
      let rejectSource: (cause: Error) => void = () => {}
      const source = new Promise<File | undefined>((resolve, reject) => {
        resolveSource = resolve
        rejectSource = reject
      })
      const upload = vi.fn()
      const onError = vi.fn()
      const registry = chipRegistry()
      const { addDeferredFile, cancelAllUploads } = useAttachment({
        upload,
        onError,
        ...registry
      })
      const pending = addDeferredFile('cancelled.png', () => source)
      cancelAllUploads()
      const finish = {
        rejected: () => rejectSource(new Error('source failed')),
        oversized: () =>
          resolveSource(fileOfSize('cancelled.png', MAX_ATTACHMENT_BYTES + 1)),
        unsupported: () => resolveSource(undefined)
      }
      finish[outcome]()

      await expect(pending).resolves.toBe('cancelled')
      expect(registry.chips).toEqual([])
      expect(upload).not.toHaveBeenCalled()
      expect(onError).not.toHaveBeenCalled()
      expect(reportError).not.toHaveBeenCalled()
    }
  )

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
