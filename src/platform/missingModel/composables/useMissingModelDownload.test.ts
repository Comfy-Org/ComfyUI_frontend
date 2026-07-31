import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as MissingModelDownload from '@/platform/missingModel/missingModelDownload'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'

const mocks = vi.hoisted(() => ({
  downloadModel: vi.fn<typeof MissingModelDownload.downloadModel>(),
  fetchModelMetadata: vi.fn<typeof MissingModelDownload.fetchModelMetadata>(),
  isTrustedHuggingFaceUrl:
    vi.fn<typeof MissingModelDownload.isTrustedHuggingFaceUrl>(),
  openGatedRepoPage: vi.fn<typeof MissingModelDownload.openGatedRepoPage>()
}))

vi.mock('@/platform/missingModel/missingModelDownload', () => ({
  downloadModel: mocks.downloadModel,
  fetchModelMetadata: mocks.fetchModelMetadata,
  isTrustedHuggingFaceUrl: mocks.isTrustedHuggingFaceUrl,
  openGatedRepoPage: mocks.openGatedRepoPage
}))

import { useMissingModelDownload } from './useMissingModelDownload'

const downloadUrl =
  'https://huggingface.co/org/model/resolve/main/model.safetensors'
const repoUrl = 'https://huggingface.co/org/model'

describe('useMissingModelDownload', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    delete window.__comfyDesktop2
    mocks.isTrustedHuggingFaceUrl.mockImplementation((url) => url === repoUrl)
    mocks.fetchModelMetadata.mockResolvedValue({
      fileSize: null,
      gatedRepoUrl: null
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stores fetched file metadata', async () => {
    mocks.fetchModelMetadata.mockResolvedValueOnce({
      fileSize: 1024,
      gatedRepoUrl: null
    })

    await useMissingModelDownload().prefetchModelMetadata(downloadUrl)

    expect(useMissingModelStore().fileSizes[downloadUrl]).toBe(1024)
  })

  it('stores fetched gated repository metadata', async () => {
    mocks.fetchModelMetadata.mockResolvedValueOnce({
      fileSize: null,
      gatedRepoUrl: repoUrl
    })

    await useMissingModelDownload().prefetchModelMetadata(downloadUrl)

    expect(useMissingModelStore().gatedRepoUrls[downloadUrl]).toBe(repoUrl)
  })

  it('skips metadata already classified by the store', async () => {
    const store = useMissingModelStore()
    const sizedUrl = `${downloadUrl}?sized`
    const gatedUrl = `${downloadUrl}?gated`
    store.setFileSize(sizedUrl, 1024)
    store.setGatedRepoUrl(gatedUrl, repoUrl)

    const { prefetchModelMetadata } = useMissingModelDownload()
    await prefetchModelMetadata(sizedUrl)
    await prefetchModelMetadata(gatedUrl)

    expect(mocks.fetchModelMetadata).not.toHaveBeenCalled()
  })

  it('downloads with the current missing-model folder paths', () => {
    const store = useMissingModelStore()
    store.setFolderPaths({ checkpoints: ['/models/checkpoints'] })
    const model = {
      name: 'model.safetensors',
      url: downloadUrl,
      directory: 'checkpoints'
    }

    useMissingModelDownload().downloadMissingModel(model)

    expect(mocks.downloadModel).toHaveBeenCalledWith(model, {
      checkpoints: ['/models/checkpoints']
    })
  })

  it('opens a trusted access page through the Desktop bridge', async () => {
    let receiver: unknown
    let openedUrl: string | undefined
    const bridge = {
      isRemote: () => true,
      async openModelAccessPage(this: unknown, url: string) {
        receiver = this
        openedUrl = url
        return true
      }
    }
    window.__comfyDesktop2 = bridge

    await useMissingModelDownload().openModelAccessPage(repoUrl)

    expect(receiver).toBe(bridge)
    expect(openedUrl).toBe(repoUrl)
    expect(mocks.openGatedRepoPage).not.toHaveBeenCalled()
  })

  it('falls back when the Desktop bridge declines the access page', async () => {
    const openModelAccessPage = vi.fn().mockResolvedValue(false)
    window.__comfyDesktop2 = {
      isRemote: () => false,
      openModelAccessPage
    }

    await useMissingModelDownload().openModelAccessPage(repoUrl)

    expect(openModelAccessPage).toHaveBeenCalledWith(repoUrl)
    expect(mocks.openGatedRepoPage).toHaveBeenCalledWith(repoUrl)
  })

  it('falls back when the Desktop bridge rejects the access page', async () => {
    const error = new Error('Desktop bridge unavailable')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    window.__comfyDesktop2 = {
      isRemote: () => false,
      openModelAccessPage: vi.fn().mockRejectedValue(error)
    }

    await useMissingModelDownload().openModelAccessPage(repoUrl)

    expect(consoleError).toHaveBeenCalledWith(
      'Failed to open model access page in Desktop:',
      error
    )
    expect(mocks.openGatedRepoPage).toHaveBeenCalledWith(repoUrl)
  })

  it('rejects untrusted access page URLs before invoking a host', async () => {
    const openModelAccessPage = vi.fn().mockResolvedValue(true)
    window.__comfyDesktop2 = {
      isRemote: () => false,
      openModelAccessPage
    }
    await useMissingModelDownload().openModelAccessPage(
      'https://example.com/org/model'
    )

    expect(openModelAccessPage).not.toHaveBeenCalled()
    expect(mocks.openGatedRepoPage).not.toHaveBeenCalled()
  })
})
