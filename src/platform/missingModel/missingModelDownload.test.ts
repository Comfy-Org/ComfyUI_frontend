import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DownloadApiError } from '@/platform/modelManager/types'

import {
  downloadModel,
  fetchModelMetadata,
  isModelDownloadable,
  toBrowsableUrl
} from './missingModelDownload'

const {
  fetchMock,
  mockIsDesktop,
  mockSidebarTabStore,
  mockStartDownload,
  mockEnqueue,
  mockToastAdd,
  mockFlags
} = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  mockIsDesktop: { value: false },
  mockSidebarTabStore: { activeSidebarTabId: null as string | null },
  mockStartDownload: vi.fn(),
  mockEnqueue: vi.fn(),
  mockToastAdd: vi.fn(),
  mockFlags: { serverSideModelDownloads: false }
}))

vi.stubGlobal('fetch', fetchMock)

vi.mock('@/platform/distribution/types', () => ({
  get isDesktop() {
    return mockIsDesktop.value
  }
}))

vi.mock('@/stores/electronDownloadStore', () => ({
  useElectronDownloadStore: () => ({
    start: mockStartDownload
  })
}))

vi.mock('@/stores/workspace/sidebarTabStore', () => ({
  useSidebarTabStore: () => mockSidebarTabStore
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ flags: mockFlags })
}))

vi.mock('@/platform/modelManager/stores/modelDownloadStore', () => ({
  useModelDownloadStore: () => ({ enqueue: mockEnqueue })
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: mockToastAdd })
}))

const mockRefreshModelFolder = vi.fn()
const mockRefreshMissingModels = vi.fn()

vi.mock('@/stores/modelStore', () => ({
  useModelStore: () => ({ refreshModelFolder: mockRefreshModelFolder })
}))

vi.mock('@/platform/missingModel/missingModelStore', () => ({
  useMissingModelStore: () => ({
    refreshMissingModels: mockRefreshMissingModels
  })
}))

let testId = 0

beforeEach(() => {
  vi.restoreAllMocks()
  vi.resetAllMocks()
  delete window.__comfyDesktop2
  mockFlags.serverSideModelDownloads = false
})

describe('fetchModelMetadata', () => {
  beforeEach(() => {
    mockIsDesktop.value = false
    mockSidebarTabStore.activeSidebarTabId = null
    testId++
  })

  it('fetches file size via HEAD for non-Civitai URLs', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-length': '1048576' })
    })

    const url = `https://huggingface.co/org/model/resolve/main/head-${testId}.safetensors`
    const metadata = await fetchModelMetadata(url)
    expect(metadata.fileSize).toBe(1048576)
    expect(metadata.gatedRepoUrl).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(url, { method: 'HEAD' })
  })

  it('uses Civitai API for Civitai model URLs', async () => {
    const url = `https://civitai.com/api/download/models/${testId}`
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: [{ sizeKB: 1024, downloadUrl: url }]
      })
    })

    const metadata = await fetchModelMetadata(url)
    expect(metadata.fileSize).toBe(1024 * 1024)
    expect(metadata.gatedRepoUrl).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(
      `https://civitai.com/api/v1/model-versions/${testId}`
    )
  })

  it('returns null fileSize when Civitai API fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false })

    const metadata = await fetchModelMetadata(
      `https://civitai.com/api/download/models/${testId}`
    )
    expect(metadata.fileSize).toBeNull()
    expect(metadata.gatedRepoUrl).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns gatedRepoUrl for gated HuggingFace HEAD requests (403)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403 })

    const metadata = await fetchModelMetadata(
      `https://huggingface.co/bfl/FLUX.1/resolve/main/gated-${testId}.safetensors`
    )
    expect(metadata.gatedRepoUrl).toBe('https://huggingface.co/bfl/FLUX.1')
    expect(metadata.fileSize).toBeNull()
  })

  it('does not treat HuggingFace 404/500 as gated', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 })

    const metadata = await fetchModelMetadata(
      `https://huggingface.co/org/model/resolve/main/notfound-${testId}.safetensors`
    )
    expect(metadata.gatedRepoUrl).toBeNull()
    expect(metadata.fileSize).toBeNull()
  })

  it('returns null for unrecognized Civitai URL patterns', async () => {
    const url = `https://civitai.com/api/v1/models/${testId}`
    const metadata = await fetchModelMetadata(url)
    expect(metadata.fileSize).toBeNull()
    expect(metadata.gatedRepoUrl).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null metadata when the Civitai request throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))

    const metadata = await fetchModelMetadata(
      `https://civitai.com/api/download/models/${testId}`
    )

    expect(metadata).toEqual({ fileSize: null, gatedRepoUrl: null })
  })

  it('returns null metadata when the HEAD request throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))

    const metadata = await fetchModelMetadata(
      `https://huggingface.co/org/model/resolve/main/throws-${testId}.safetensors`
    )

    expect(metadata).toEqual({ fileSize: null, gatedRepoUrl: null })
  })

  it('returns cached metadata on second call', async () => {
    const url = `https://huggingface.co/org/model/resolve/main/cached-${testId}.safetensors`

    fetchMock.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-length': '500' })
    })

    const first = await fetchModelMetadata(url)
    const second = await fetchModelMetadata(url)

    expect(first.fileSize).toBe(500)
    expect(second.fileSize).toBe(500)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not cache incomplete results so retries are possible', async () => {
    const url = `https://example.com/retry-${testId}.safetensors`

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({})
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-length': '1024' })
      })

    const first = await fetchModelMetadata(url)
    const second = await fetchModelMetadata(url)

    expect(first.fileSize).toBeNull()
    expect(second.fileSize).toBe(1024)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('deduplicates concurrent requests for the same URL', async () => {
    const url = `https://huggingface.co/org/model/resolve/main/dedup-${testId}.safetensors`

    fetchMock.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-length': '2048' })
    })

    const [first, second] = await Promise.all([
      fetchModelMetadata(url),
      fetchModelMetadata(url)
    ])

    expect(first.fileSize).toBe(2048)
    expect(second.fileSize).toBe(2048)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('toBrowsableUrl', () => {
  it('replaces /resolve/ with /blob/ in HuggingFace URLs', () => {
    expect(
      toBrowsableUrl(
        'https://huggingface.co/org/model/resolve/main/file.safetensors'
      )
    ).toBe('https://huggingface.co/org/model/blob/main/file.safetensors')
  })

  it('returns non-HuggingFace URLs unchanged', () => {
    const url =
      'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth'
    expect(toBrowsableUrl(url)).toBe(url)
  })

  it('preserves query params in HuggingFace URLs', () => {
    expect(
      toBrowsableUrl(
        'https://huggingface.co/bfl/FLUX.1/resolve/main/model.safetensors?download=true'
      )
    ).toBe(
      'https://huggingface.co/bfl/FLUX.1/blob/main/model.safetensors?download=true'
    )
  })

  it('converts Civitai api/download URL to model page', () => {
    expect(
      toBrowsableUrl('https://civitai.com/api/download/models/12345')
    ).toBe('https://civitai.com/models/12345')
  })

  it('converts Civitai api/v1 URL to model page', () => {
    expect(toBrowsableUrl('https://civitai.com/api/v1/models/12345')).toBe(
      'https://civitai.com/models/12345'
    )
  })

  it('converts civitai.red URLs to model pages', () => {
    expect(
      toBrowsableUrl('https://civitai.red/api/download/models/12345')
    ).toBe('https://civitai.red/models/12345')
    expect(toBrowsableUrl('https://civitai.red/api/v1/models/12345')).toBe(
      'https://civitai.red/models/12345'
    )
  })
})

describe('isModelDownloadable', () => {
  it('allows civitai.red URLs', () => {
    expect(
      isModelDownloadable({
        name: 'model.safetensors',
        url: 'https://civitai.red/api/download/models/12345',
        directory: 'checkpoints'
      })
    ).toBe(true)
  })

  it('rejects non-allowlisted URLs', () => {
    expect(
      isModelDownloadable({
        name: 'model.safetensors',
        url: 'https://example.com/model.safetensors',
        directory: 'checkpoints'
      })
    ).toBe(false)
  })

  it('allows explicitly whitelisted URLs from an otherwise disallowed host', () => {
    expect(
      isModelDownloadable({
        name: 'RealESRGAN_x4plus.pth',
        url: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth',
        directory: 'upscale_models'
      })
    ).toBe(true)
  })
})

describe('downloadModel', () => {
  beforeEach(() => {
    mockIsDesktop.value = false
    mockSidebarTabStore.activeSidebarTabId = null
  })

  it('uses the Desktop2 bridge directly instead of the browser fallback', () => {
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    const desktopDownloadModel = vi
      .fn<
        (url: string, filename: string, directory: string) => Promise<boolean>
      >()
      .mockResolvedValue(true)
    window.__comfyDesktop2 = {
      isRemote: () => false,
      downloadModel: desktopDownloadModel
    }

    downloadModel(
      {
        name: 'model.safetensors',
        url: 'https://huggingface.co/org/model/resolve/main/model.safetensors',
        directory: 'checkpoints'
      },
      { checkpoints: ['/models/checkpoints'] }
    )

    expect(desktopDownloadModel).toHaveBeenCalledWith(
      'https://huggingface.co/org/model/resolve/main/model.safetensors',
      'model.safetensors',
      'checkpoints'
    )
    expect(anchorClick).not.toHaveBeenCalled()
    expect(mockStartDownload).not.toHaveBeenCalled()
  })

  it('logs Desktop2 bridge failures without falling back to browser download', async () => {
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const bridgeError = new Error('bridge failed')
    const desktopDownloadModel = vi
      .fn<
        (url: string, filename: string, directory: string) => Promise<boolean>
      >()
      .mockRejectedValue(bridgeError)
    window.__comfyDesktop2 = {
      isRemote: () => false,
      downloadModel: desktopDownloadModel
    }

    downloadModel(
      {
        name: 'model.safetensors',
        url: 'https://huggingface.co/org/model/resolve/main/model.safetensors',
        directory: 'checkpoints'
      },
      { checkpoints: ['/models/checkpoints'] }
    )

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to start Desktop2 model download:',
        bridgeError
      )
    })
    expect(anchorClick).not.toHaveBeenCalled()
    expect(mockStartDownload).not.toHaveBeenCalled()
  })

  it('logs synchronous Desktop2 bridge failures without crashing', async () => {
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const bridgeError = new Error('bridge failed before returning a promise')
    const desktopDownloadModel = vi
      .fn<
        (url: string, filename: string, directory: string) => Promise<boolean>
      >()
      .mockImplementation(() => {
        throw bridgeError
      })
    window.__comfyDesktop2 = {
      isRemote: () => false,
      downloadModel: desktopDownloadModel
    }

    downloadModel(
      {
        name: 'model.safetensors',
        url: 'https://huggingface.co/org/model/resolve/main/model.safetensors',
        directory: 'checkpoints'
      },
      { checkpoints: ['/models/checkpoints'] }
    )

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to start Desktop2 model download:',
        bridgeError
      )
    })
    expect(anchorClick).not.toHaveBeenCalled()
    expect(mockStartDownload).not.toHaveBeenCalled()
  })

  it('keeps remote Desktop2 sessions on the browser fallback', () => {
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    const desktopDownloadModel = vi
      .fn<
        (url: string, filename: string, directory: string) => Promise<boolean>
      >()
      .mockResolvedValue(true)
    window.__comfyDesktop2 = {
      isRemote: () => true,
      downloadModel: desktopDownloadModel
    }

    downloadModel(
      {
        name: 'model.safetensors',
        url: 'https://huggingface.co/org/model/resolve/main/model.safetensors',
        directory: 'checkpoints'
      },
      { checkpoints: ['/models/checkpoints'] }
    )

    expect(desktopDownloadModel).not.toHaveBeenCalled()
    expect(anchorClick).toHaveBeenCalledTimes(1)
  })

  it('uses the browser fallback on web when server-side downloads are disabled', () => {
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    downloadModel(
      {
        name: 'model.safetensors',
        url: 'https://huggingface.co/org/model/resolve/main/model.safetensors',
        directory: 'checkpoints'
      },
      { checkpoints: ['/models/checkpoints'] }
    )

    expect(anchorClick).toHaveBeenCalledTimes(1)
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('enqueues a server-side download and reveals the manager when enabled', async () => {
    mockFlags.serverSideModelDownloads = true
    mockEnqueue.mockResolvedValue({ download_id: 'd1', accepted: true })
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    downloadModel(
      {
        name: 'model.safetensors',
        url: 'https://huggingface.co/org/model/resolve/main/model.safetensors',
        directory: 'checkpoints'
      },
      { checkpoints: ['/models/checkpoints'] }
    )

    await vi.waitFor(() => {
      expect(mockSidebarTabStore.activeSidebarTabId).toBe('model-manager')
    })
    expect(mockEnqueue).toHaveBeenCalledWith({
      url: 'https://huggingface.co/org/model/resolve/main/model.safetensors',
      model_id: 'checkpoints/model.safetensors'
    })
    expect(anchorClick).not.toHaveBeenCalled()
  })

  it('shows a toast when a server-side enqueue fails', async () => {
    mockFlags.serverSideModelDownloads = true
    mockEnqueue.mockRejectedValue(new Error('boom'))

    downloadModel(
      {
        name: 'model.safetensors',
        url: 'https://huggingface.co/org/model/resolve/main/model.safetensors',
        directory: 'checkpoints'
      },
      { checkpoints: ['/models/checkpoints'] }
    )

    await vi.waitFor(() => {
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', detail: 'boom' })
      )
    })
    expect(mockSidebarTabStore.activeSidebarTabId).toBeNull()
  })

  it('reveals the download manager and shows an info toast for an in-progress download', async () => {
    mockFlags.serverSideModelDownloads = true
    mockEnqueue.mockRejectedValue(
      new DownloadApiError('exists', 'ALREADY_DOWNLOADING', 409)
    )

    downloadModel(
      {
        name: 'model.safetensors',
        url: 'https://huggingface.co/org/model/resolve/main/model.safetensors',
        directory: 'checkpoints'
      },
      { checkpoints: ['/models/checkpoints'] }
    )

    await vi.waitFor(() => {
      expect(mockSidebarTabStore.activeSidebarTabId).toBe('model-manager')
    })
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'info',
        detail: 'model.safetensors'
      })
    )
  })

  it('refreshes the model folder and re-scans missing models when already available', async () => {
    mockFlags.serverSideModelDownloads = true
    mockEnqueue.mockRejectedValue(
      new DownloadApiError('already there', 'ALREADY_AVAILABLE', 409)
    )
    mockRefreshModelFolder.mockResolvedValue(undefined)

    downloadModel(
      {
        name: 'model.safetensors',
        url: 'https://huggingface.co/org/model/resolve/main/model.safetensors',
        directory: 'checkpoints'
      },
      { checkpoints: ['/models/checkpoints'] }
    )

    await vi.waitFor(() => {
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'info',
          detail: 'model.safetensors'
        })
      )
    })
    await vi.waitFor(() => {
      expect(mockRefreshModelFolder).toHaveBeenCalledWith('checkpoints')
    })
    expect(mockRefreshMissingModels).toHaveBeenCalled()
    expect(mockSidebarTabStore.activeSidebarTabId).toBeNull()
  })

  it('still re-scans missing models when the post-available folder refresh fails', async () => {
    mockFlags.serverSideModelDownloads = true
    mockEnqueue.mockRejectedValue(
      new DownloadApiError('already there', 'ALREADY_AVAILABLE', 409)
    )
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockRefreshModelFolder.mockRejectedValue(new Error('boom'))

    downloadModel(
      {
        name: 'model.safetensors',
        url: 'https://huggingface.co/org/model/resolve/main/model.safetensors',
        directory: 'checkpoints'
      },
      { checkpoints: ['/models/checkpoints'] }
    )

    await vi.waitFor(() => {
      expect(mockRefreshMissingModels).toHaveBeenCalled()
    })
    expect(consoleWarn).toHaveBeenCalled()
    consoleWarn.mockRestore()
  })

  it('opens the model library sidebar before starting a desktop download', () => {
    mockIsDesktop.value = true

    downloadModel(
      {
        name: 'model.safetensors',
        url: 'https://huggingface.co/org/model/resolve/main/model.safetensors',
        directory: 'checkpoints'
      },
      { checkpoints: ['/models/checkpoints'] }
    )

    expect(mockSidebarTabStore.activeSidebarTabId).toBe('model-library')
    expect(mockStartDownload).toHaveBeenCalledWith({
      url: 'https://huggingface.co/org/model/resolve/main/model.safetensors',
      savePath: '/models/checkpoints',
      filename: 'model.safetensors'
    })
  })
})
