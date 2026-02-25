import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAssetUploadProgress } from './useAssetUploadProgress'

type ProgressHandler = (e: ProgressEvent) => void
type EventHandler = () => void

let capturedHandlers: {
  uploadProgress?: ProgressHandler
  load?: EventHandler
  error?: EventHandler
  abort?: EventHandler
}
let sentFormData: FormData | undefined
let sentUrl: string | undefined
let mockStatus: number
let mockResponseText: string

class MockXMLHttpRequest {
  open = vi.fn((_method: string, url: string) => {
    sentUrl = url
  })
  send = vi.fn((data: FormData) => {
    sentFormData = data
  })
  upload = {
    addEventListener: vi.fn((event: string, handler: ProgressHandler) => {
      if (event === 'progress') capturedHandlers.uploadProgress = handler
    })
  }
  addEventListener = vi.fn((event: string, handler: EventHandler) => {
    if (event === 'load') capturedHandlers.load = handler
    if (event === 'error') capturedHandlers.error = handler
    if (event === 'abort') capturedHandlers.abort = handler
  })
  get status() {
    return mockStatus
  }
  get responseText() {
    return mockResponseText
  }
}

vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest)

function makeFile(name: string, size = 1024): File {
  const content = new Uint8Array(size)
  return new File([content], name, { type: 'image/png' })
}

describe('useAssetUploadProgress', () => {
  beforeEach(() => {
    capturedHandlers = {}
    sentFormData = undefined
    sentUrl = undefined
    mockStatus = 200
    mockResponseText = '{"id":"abc","message":"Upload complete"}'
  })

  it('sends a POST with the file as FormData', () => {
    const { upload } = useAssetUploadProgress('http://test:3001/upload')
    const file = makeFile('photo.png')

    void upload('thumbnail', file)

    expect(sentUrl).toBe('http://test:3001/upload')
    expect(sentFormData?.get('file')).toBe(file)
  })

  it('tracks progress via upload.onprogress', () => {
    const { upload, getProgress } = useAssetUploadProgress(
      'http://test:3001/upload'
    )
    const file = makeFile('photo.png', 2000)

    void upload('thumbnail', file)

    expect(getProgress('thumbnail')).toBeDefined()
    expect(getProgress('thumbnail')!.percent).toBe(0)

    capturedHandlers.uploadProgress?.(
      new ProgressEvent('progress', {
        lengthComputable: true,
        loaded: 1000,
        total: 2000
      })
    )

    expect(getProgress('thumbnail')!.percent).toBe(50)
    expect(getProgress('thumbnail')!.loaded).toBe(1000)
    expect(getProgress('thumbnail')!.total).toBe(2000)
  })

  it('marks complete and resolves on successful load', async () => {
    const { upload, getProgress } = useAssetUploadProgress(
      'http://test:3001/upload'
    )

    const promise = upload('thumbnail', makeFile('photo.png'))
    capturedHandlers.load?.()

    const result = await promise
    expect(result).toEqual({ id: 'abc', message: 'Upload complete' })
    expect(getProgress('thumbnail')!.complete).toBe(true)
    expect(getProgress('thumbnail')!.percent).toBe(100)
  })

  it('rejects with error on server error status', async () => {
    const { upload, getProgress } = useAssetUploadProgress(
      'http://test:3001/upload'
    )
    mockStatus = 500

    const promise = upload('thumbnail', makeFile('photo.png'))
    capturedHandlers.load?.()

    await expect(promise).rejects.toThrow('Server responded with 500')
    expect(getProgress('thumbnail')!.error).toBe('Server responded with 500')
  })

  it('rejects on network error', async () => {
    const { upload, getProgress } = useAssetUploadProgress(
      'http://test:3001/upload'
    )

    const promise = upload('thumbnail', makeFile('photo.png'))
    capturedHandlers.error?.()

    await expect(promise).rejects.toThrow('Network error')
    expect(getProgress('thumbnail')!.error).toBe('Network error')
    expect(getProgress('thumbnail')!.complete).toBe(true)
  })

  it('rejects on abort', async () => {
    const { upload, getProgress } = useAssetUploadProgress(
      'http://test:3001/upload'
    )

    const promise = upload('thumbnail', makeFile('photo.png'))
    capturedHandlers.abort?.()

    await expect(promise).rejects.toThrow('Upload aborted')
    expect(getProgress('thumbnail')!.complete).toBe(true)
  })

  it('clearProgress removes the entry', () => {
    const { upload, getProgress, clearProgress } = useAssetUploadProgress(
      'http://test:3001/upload'
    )

    void upload('thumbnail', makeFile('photo.png'))
    expect(getProgress('thumbnail')).toBeDefined()

    clearProgress('thumbnail')
    expect(getProgress('thumbnail')).toBeUndefined()
  })

  it('returns undefined for unknown keys', () => {
    const { getProgress } = useAssetUploadProgress('http://test:3001/upload')

    expect(getProgress('nonexistent')).toBeUndefined()
  })

  it('tracks multiple uploads independently', () => {
    const { upload, getProgress } = useAssetUploadProgress(
      'http://test:3001/upload'
    )

    void upload('thumbnail', makeFile('thumb.png', 1000))

    const firstProgressHandler = capturedHandlers.uploadProgress

    void upload('beforeImage', makeFile('before.png', 2000))

    firstProgressHandler?.(
      new ProgressEvent('progress', {
        lengthComputable: true,
        loaded: 500,
        total: 1000
      })
    )

    capturedHandlers.uploadProgress?.(
      new ProgressEvent('progress', {
        lengthComputable: true,
        loaded: 400,
        total: 2000
      })
    )

    expect(getProgress('thumbnail')!.percent).toBe(50)
    expect(getProgress('beforeImage')!.percent).toBe(20)
  })

  it('ignores non-computable progress events', () => {
    const { upload, getProgress } = useAssetUploadProgress(
      'http://test:3001/upload'
    )

    void upload('thumbnail', makeFile('photo.png'))

    capturedHandlers.uploadProgress?.(
      new ProgressEvent('progress', {
        lengthComputable: false,
        loaded: 0,
        total: 0
      })
    )

    expect(getProgress('thumbnail')!.percent).toBe(0)
  })

  it('uses default upload URL when none is provided', () => {
    const { upload } = useAssetUploadProgress()

    void upload('thumbnail', makeFile('photo.png'))

    expect(sentUrl).toBe('http://localhost:3001/upload')
  })
})
