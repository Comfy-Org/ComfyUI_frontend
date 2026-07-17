import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  downloadModel,
  fetchModelMetadata,
  isModelDownloadable,
  openGatedRepoPage,
  toBrowsableUrl
} from './missingModelDownload'

const { fetchMock, mockIsDesktop, mockSidebarTabStore, mockStartDownload } =
  vi.hoisted(() => ({
    fetchMock: vi.fn(),
    mockIsDesktop: { value: false },
    mockSidebarTabStore: { activeSidebarTabId: null as string | null },
    mockStartDownload: vi.fn()
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

let testId = 0

beforeEach(() => {
  vi.restoreAllMocks()
  vi.resetAllMocks()
  delete window.__comfyDesktop2
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

  it.for([401, 403, 451])(
    'returns gatedRepoUrl for gated HuggingFace HEAD requests (%s)',
    async (status) => {
      fetchMock.mockResolvedValueOnce({ ok: false, status })

      const metadata = await fetchModelMetadata(
        `https://huggingface.co/bfl/FLUX.1/resolve/main/gated-${status}-${testId}.safetensors`
      )
      expect(metadata.gatedRepoUrl).toBe('https://huggingface.co/bfl/FLUX.1')
      expect(metadata.fileSize).toBeNull()
    }
  )

  it('does not treat HuggingFace 404/500 as gated', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 })

    const metadata = await fetchModelMetadata(
      `https://huggingface.co/org/model/resolve/main/notfound-${testId}.safetensors`
    )
    expect(metadata.gatedRepoUrl).toBeNull()
    expect(metadata.fileSize).toBeNull()
  })

  it('does not treat non-HuggingFace hosts as gated', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403 })

    const metadata = await fetchModelMetadata(
      `https://huggingface.co.evil.com/org/model/resolve/main/gated-${testId}.safetensors`
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

  it('does not rewrite URLs just because the path contains huggingface.co', () => {
    const url = 'https://example.com/huggingface.co/org/model/resolve/main/file'
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

describe('openGatedRepoPage', () => {
  it('opens gated repo pages without a download attribute', () => {
    const clickedAnchors: HTMLAnchorElement[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      function (this: HTMLAnchorElement) {
        clickedAnchors.push(this)
      }
    )

    openGatedRepoPage('https://huggingface.co/bfl/FLUX.1')

    expect(clickedAnchors).toHaveLength(1)
    expect(clickedAnchors[0]?.href).toBe('https://huggingface.co/bfl/FLUX.1')
    expect(clickedAnchors[0]?.target).toBe('_blank')
    expect(clickedAnchors[0]?.rel).toBe('noopener noreferrer')
    expect(clickedAnchors[0]?.getAttribute('download')).toBeNull()
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
