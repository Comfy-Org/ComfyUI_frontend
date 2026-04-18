import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDownload } from '@/composables/useDownload'

const { mockDownloadFileAsync } = vi.hoisted(() => ({
  mockDownloadFileAsync: vi.fn()
}))

vi.mock('@/base/common/downloadUtil', () => ({
  downloadFileAsync: mockDownloadFileAsync
}))

describe('useDownload', () => {
  beforeEach(() => {
    mockDownloadFileAsync.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with loading false', () => {
    const { loading } = useDownload()
    expect(loading.value).toBe(false)
  })

  it('sets loading true while download is in progress', async () => {
    let resolveDownload!: () => void
    mockDownloadFileAsync.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDownload = resolve
      })
    )

    const { loading, download } = useDownload()
    const promise = download('https://example.com/file.png')

    await nextTick()
    expect(loading.value).toBe(true)

    resolveDownload()
    await promise
    expect(loading.value).toBe(false)
  })

  it('resets loading to false when download fails', async () => {
    mockDownloadFileAsync.mockRejectedValue(new Error('Network error'))

    const { loading, download } = useDownload()

    await expect(download('https://example.com/file.png')).rejects.toThrow(
      'Network error'
    )
    expect(loading.value).toBe(false)
  })

  it('passes url and filename to downloadFileAsync', async () => {
    mockDownloadFileAsync.mockResolvedValue(undefined)

    const { download } = useDownload()
    await download('https://example.com/file.png', 'custom.png')

    expect(mockDownloadFileAsync).toHaveBeenCalledWith(
      'https://example.com/file.png',
      'custom.png'
    )
  })

  it('tracks loading independently per instance', async () => {
    let resolveFirst!: () => void
    mockDownloadFileAsync
      .mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveFirst = resolve
        })
      )
      .mockResolvedValueOnce(undefined)

    const first = useDownload()
    const second = useDownload()

    const promise1 = first.download('https://example.com/a.png')
    await nextTick()

    expect(first.loading.value).toBe(true)
    expect(second.loading.value).toBe(false)

    await second.download('https://example.com/b.png')
    expect(second.loading.value).toBe(false)
    expect(first.loading.value).toBe(true)

    resolveFirst()
    await promise1
    expect(first.loading.value).toBe(false)
  })
})
