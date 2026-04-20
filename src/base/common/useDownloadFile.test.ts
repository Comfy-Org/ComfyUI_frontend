import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDownloadFile } from '@/base/common/useDownloadFile'

const { mockDownloadFileAsync } = vi.hoisted(() => ({
  mockDownloadFileAsync: vi.fn()
}))

vi.mock('@/base/common/downloadUtil', () => ({
  downloadFileAsync: mockDownloadFileAsync
}))

describe('useDownloadFile', () => {
  beforeEach(() => {
    mockDownloadFileAsync.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with isLoading false and no error', () => {
    const { isLoading, error } = useDownloadFile()
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeUndefined()
  })

  it('sets isLoading true while download is in progress', async () => {
    let resolveDownload!: () => void
    mockDownloadFileAsync.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDownload = resolve
      })
    )

    const { isLoading, execute } = useDownloadFile()
    const promise = execute('https://example.com/file.png')

    await nextTick()
    expect(isLoading.value).toBe(true)

    resolveDownload()
    await promise
    expect(isLoading.value).toBe(false)
  })

  it('sets error ref when download fails', async () => {
    mockDownloadFileAsync.mockRejectedValue(new Error('Network error'))

    const { error, execute } = useDownloadFile()
    await execute('https://example.com/file.png')

    expect(error.value).toBeInstanceOf(Error)
    expect(error.value?.message).toBe('Network error')
  })

  it('clears error on next successful download', async () => {
    mockDownloadFileAsync.mockRejectedValueOnce(new Error('fail'))
    mockDownloadFileAsync.mockResolvedValueOnce(undefined)

    const { error, isLoading, execute } = useDownloadFile()

    await execute('https://example.com/a.png')
    expect(error.value).toBeDefined()
    expect(isLoading.value).toBe(false)

    await execute('https://example.com/b.png')
    expect(error.value).toBeUndefined()
  })

  it('passes url and filename to downloadFileAsync', async () => {
    mockDownloadFileAsync.mockResolvedValue(undefined)

    const { execute } = useDownloadFile()
    await execute('https://example.com/file.png', 'custom.png')

    expect(mockDownloadFileAsync).toHaveBeenCalledWith(
      'https://example.com/file.png',
      'custom.png'
    )
  })

  it('ignores concurrent calls while download is in progress', async () => {
    let resolveDownload!: () => void
    mockDownloadFileAsync.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDownload = resolve
      })
    )

    const { isLoading, execute } = useDownloadFile()
    const promise = execute('https://example.com/a.png')
    await nextTick()
    expect(isLoading.value).toBe(true)

    await execute('https://example.com/b.png')
    expect(mockDownloadFileAsync).toHaveBeenCalledTimes(1)

    resolveDownload()
    await promise
    expect(isLoading.value).toBe(false)
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

    const first = useDownloadFile()
    const second = useDownloadFile()

    const promise1 = first.execute('https://example.com/a.png')
    await nextTick()

    expect(first.isLoading.value).toBe(true)
    expect(second.isLoading.value).toBe(false)

    await second.execute('https://example.com/b.png')
    expect(second.isLoading.value).toBe(false)
    expect(first.isLoading.value).toBe(true)

    resolveFirst()
    await promise1
    expect(first.isLoading.value).toBe(false)
  })
})
