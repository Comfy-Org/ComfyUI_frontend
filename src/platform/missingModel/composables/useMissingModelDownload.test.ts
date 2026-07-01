import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'

const mockDownloadModel = vi.hoisted(() => vi.fn())
const mockFetchModelMetadata = vi.hoisted(() => vi.fn())
const mockOpenGatedRepoPage = vi.hoisted(() => vi.fn())

vi.mock('@/platform/missingModel/missingModelDownload', () => ({
  downloadModel: mockDownloadModel,
  fetchModelMetadata: mockFetchModelMetadata,
  openGatedRepoPage: mockOpenGatedRepoPage
}))

import { useMissingModelDownload } from './useMissingModelDownload'

describe('useMissingModelDownload', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.resetAllMocks()
    mockFetchModelMetadata.mockResolvedValue({
      fileSize: null,
      gatedRepoUrl: null
    })
  })

  it('stores fetched file size metadata', async () => {
    const url =
      'https://huggingface.co/bfl/FLUX.1/resolve/main/model.safetensors'
    mockFetchModelMetadata.mockResolvedValueOnce({
      fileSize: 1024,
      gatedRepoUrl: null
    })

    const { prefetchModelMetadata } = useMissingModelDownload()
    await prefetchModelMetadata(url)

    const store = useMissingModelStore()
    expect(store.fileSizes[url]).toBe(1024)
    expect(store.gatedRepoUrls[url]).toBeUndefined()
  })

  it('stores fetched gated repo metadata', async () => {
    const url =
      'https://huggingface.co/bfl/FLUX.1/resolve/main/model.safetensors'
    mockFetchModelMetadata.mockResolvedValueOnce({
      fileSize: null,
      gatedRepoUrl: 'https://huggingface.co/bfl/FLUX.1'
    })

    const { prefetchModelMetadata } = useMissingModelDownload()
    await prefetchModelMetadata(url)

    const store = useMissingModelStore()
    expect(store.fileSizes[url]).toBeUndefined()
    expect(store.gatedRepoUrls[url]).toBe('https://huggingface.co/bfl/FLUX.1')
  })

  it('swallows metadata fetch failures so mounted rows do not throw', async () => {
    const url =
      'https://huggingface.co/bfl/FLUX.1/resolve/main/model.safetensors'
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = new Error('metadata failed')
    mockFetchModelMetadata.mockRejectedValueOnce(error)

    const { prefetchModelMetadata } = useMissingModelDownload()
    await expect(prefetchModelMetadata(url)).resolves.toBeUndefined()

    const store = useMissingModelStore()
    expect(store.fileSizes).toEqual({})
    expect(store.gatedRepoUrls).toEqual({})
    expect(consoleWarn).toHaveBeenCalledWith(
      `[MissingModelDownload] Failed to fetch metadata for ${url}:`,
      error
    )
    consoleWarn.mockRestore()
  })

  it('skips metadata fetches when metadata is already stored', async () => {
    const store = useMissingModelStore()
    const sizedUrl = 'https://example.com/model.safetensors'
    const gatedUrl =
      'https://huggingface.co/bfl/FLUX.1/resolve/main/model.safetensors'
    store.setFileSize(sizedUrl, 1024)
    store.setGatedRepoUrl(gatedUrl, 'https://huggingface.co/bfl/FLUX.1')

    const { prefetchModelMetadata } = useMissingModelDownload()
    await prefetchModelMetadata(sizedUrl)
    await prefetchModelMetadata(gatedUrl)

    expect(mockFetchModelMetadata).not.toHaveBeenCalled()
  })

  it('revalidates stored gated metadata and downloads after access succeeds', async () => {
    const store = useMissingModelStore()
    const gatedUrl =
      'https://huggingface.co/bfl/FLUX.1/resolve/main/model.safetensors'
    const model = {
      name: 'model.safetensors',
      url: gatedUrl,
      directory: 'checkpoints'
    }
    store.setFolderPaths({ checkpoints: ['/models/checkpoints'] })
    store.setGatedRepoUrl(gatedUrl, 'https://huggingface.co/bfl/FLUX.1')
    mockFetchModelMetadata.mockResolvedValueOnce({
      fileSize: 2048,
      gatedRepoUrl: null
    })

    const { downloadMissingModel } = useMissingModelDownload()
    await downloadMissingModel(model)

    expect(mockFetchModelMetadata).toHaveBeenCalledWith(gatedUrl)
    expect(store.fileSizes[gatedUrl]).toBe(2048)
    expect(store.gatedRepoUrls[gatedUrl]).toBeUndefined()
    expect(mockDownloadModel).toHaveBeenCalledWith(model, {
      checkpoints: ['/models/checkpoints']
    })
    expect(mockOpenGatedRepoPage).not.toHaveBeenCalled()
  })

  it('passes folder paths to the platform download helper', async () => {
    const store = useMissingModelStore()
    const url =
      'https://huggingface.co/bfl/FLUX.1/resolve/main/model.safetensors'
    const model = {
      name: 'model.safetensors',
      url,
      directory: 'checkpoints'
    }
    store.setFolderPaths({ checkpoints: ['/models/checkpoints'] })

    const { downloadMissingModel } = useMissingModelDownload()
    await downloadMissingModel(model)

    expect(mockDownloadModel).toHaveBeenCalledWith(model, {
      checkpoints: ['/models/checkpoints']
    })
    expect(mockOpenGatedRepoPage).not.toHaveBeenCalled()
  })

  it('opens stored gated repo metadata when revalidation does not unlock access', async () => {
    const store = useMissingModelStore()
    const url =
      'https://huggingface.co/bfl/FLUX.1/resolve/main/model.safetensors'
    const model = {
      name: 'model.safetensors',
      url,
      directory: 'checkpoints'
    }
    store.setFolderPaths({ checkpoints: ['/models/checkpoints'] })
    store.setGatedRepoUrl(url, 'https://huggingface.co/bfl/FLUX.1')

    const { downloadMissingModel } = useMissingModelDownload()
    await downloadMissingModel(model)

    expect(mockFetchModelMetadata).toHaveBeenCalledWith(url)
    expect(mockOpenGatedRepoPage).toHaveBeenCalledWith(
      'https://huggingface.co/bfl/FLUX.1'
    )
    expect(mockDownloadModel).not.toHaveBeenCalled()
  })

  it('opens stored gated repo metadata when revalidation fails', async () => {
    const store = useMissingModelStore()
    const url =
      'https://huggingface.co/bfl/FLUX.1/resolve/main/model.safetensors'
    const repoUrl = 'https://huggingface.co/bfl/FLUX.1'
    const model = {
      name: 'model.safetensors',
      url,
      directory: 'checkpoints'
    }
    const error = new Error('metadata failed')
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    store.setGatedRepoUrl(url, repoUrl)
    mockFetchModelMetadata.mockRejectedValueOnce(error)

    const { downloadMissingModel } = useMissingModelDownload()
    await downloadMissingModel(model)

    expect(mockFetchModelMetadata).toHaveBeenCalledWith(url)
    expect(store.gatedRepoUrls[url]).toBe(repoUrl)
    expect(consoleWarn).toHaveBeenCalledWith(
      `[MissingModelDownload] Failed to revalidate gated metadata for ${url}:`,
      error
    )
    expect(mockOpenGatedRepoPage).toHaveBeenCalledWith(repoUrl)
    expect(mockDownloadModel).not.toHaveBeenCalled()
    consoleWarn.mockRestore()
  })

  it('keeps stored gated metadata when revalidation is still gated', async () => {
    const store = useMissingModelStore()
    const url =
      'https://huggingface.co/bfl/FLUX.1/resolve/main/model.safetensors'
    const storedRepoUrl = 'https://huggingface.co/bfl/FLUX.1'
    const refreshedRepoUrl = 'https://huggingface.co/bfl/FLUX.1-updated'
    const model = {
      name: 'model.safetensors',
      url,
      directory: 'checkpoints'
    }
    store.setGatedRepoUrl(url, storedRepoUrl)
    mockFetchModelMetadata.mockResolvedValueOnce({
      fileSize: null,
      gatedRepoUrl: refreshedRepoUrl
    })

    const { downloadMissingModel } = useMissingModelDownload()
    await downloadMissingModel(model)

    expect(mockFetchModelMetadata).toHaveBeenCalledWith(url)
    expect(store.gatedRepoUrls[url]).toBe(refreshedRepoUrl)
    expect(mockOpenGatedRepoPage).toHaveBeenCalledWith(refreshedRepoUrl)
    expect(mockDownloadModel).not.toHaveBeenCalled()
  })
})
