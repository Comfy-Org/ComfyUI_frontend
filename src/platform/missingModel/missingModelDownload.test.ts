import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearMetadataCache,
  downloadModel,
  fetchModelMetadata,
  isModelDownloadable,
  isTrustedHuggingFaceUrl,
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

type ModelMetadata = {
  fileSize: number | null
  gatedRepoUrl: string | null
}

type ModelMetadataFetchOutcome = {
  metadata: ModelMetadata
  resolution: 'resolved' | 'failed'
}

type FetchModelMetadataWithStatus = (
  url: string
) => Promise<ModelMetadataFetchOutcome>

function isMetadataOutcomeModule(value: unknown): value is {
  fetchModelMetadataWithStatus: FetchModelMetadataWithStatus
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'fetchModelMetadataWithStatus' in value &&
    typeof value.fetchModelMetadataWithStatus === 'function'
  )
}

const modulePath = './missingModelDownload'
const missingModelDownloadModule: unknown = await import(modulePath)

function getFetchModelMetadataWithStatus(): FetchModelMetadataWithStatus {
  if (!isMetadataOutcomeModule(missingModelDownloadModule)) {
    throw new Error('Expected fetchModelMetadataWithStatus to be exported')
  }

  return missingModelDownloadModule.fetchModelMetadataWithStatus
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  clearMetadataCache()
  delete window.__comfyDesktop2
})

describe('fetchModelMetadata', () => {
  beforeEach(() => {
    mockIsDesktop.value = false
    mockSidebarTabStore.activeSidebarTabId = null
  })

  it('fetches file size via HEAD for non-Civitai URLs', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-length': '1048576' })
    })

    const url = 'https://huggingface.co/org/model/resolve/main/head.safetensors'
    const metadata = await fetchModelMetadata(url)
    expect(metadata.fileSize).toBe(1048576)
    expect(metadata.gatedRepoUrl).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(url, { method: 'HEAD' })
  })

  it('uses Civitai API for Civitai model URLs', async () => {
    const url = 'https://civitai.com/api/download/models/123'
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
      'https://civitai.com/api/v1/model-versions/123'
    )
  })

  it('returns null fileSize when Civitai API fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false })

    const metadata = await fetchModelMetadata(
      'https://civitai.com/api/download/models/123'
    )
    expect(metadata.fileSize).toBeNull()
    expect(metadata.gatedRepoUrl).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('caches successful Civitai responses without a matching file', async () => {
    const url = 'https://civitai.com/api/download/models/123'
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ files: [] })
    })

    const first = await fetchModelMetadata(url)
    const second = await fetchModelMetadata(url)

    expect(first.fileSize).toBeNull()
    expect(second.fileSize).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries failed Civitai metadata responses', async () => {
    const url = 'https://civitai.com/api/download/models/123'
    fetchMock.mockResolvedValue({ ok: false })

    expect((await fetchModelMetadata(url)).fileSize).toBeNull()
    expect((await fetchModelMetadata(url)).fileSize).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.for([401, 403, 451])(
    'returns gatedRepoUrl for gated HuggingFace HEAD requests (%s)',
    async (status) => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status,
        headers: new Headers({ 'x-error-code': 'GatedRepo' })
      })

      const metadata = await fetchModelMetadata(
        `https://huggingface.co/bfl/FLUX.1/resolve/main/gated-${status}.safetensors`
      )
      expect(metadata.gatedRepoUrl).toBe('https://huggingface.co/bfl/FLUX.1')
      expect(metadata.fileSize).toBeNull()
    }
  )

  it('caches gated HuggingFace metadata', async () => {
    const url =
      'https://huggingface.co/bfl/FLUX.1/resolve/main/gated-cache.safetensors'
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Headers({ 'x-error-code': 'GatedRepo' })
    })

    await fetchModelMetadata(url)
    await fetchModelMetadata(url)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.for([401, 403, 451])(
    'does not treat HuggingFace %s as gated without the GatedRepo error code',
    async (status) => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status,
        headers: new Headers()
      })

      const metadata = await fetchModelMetadata(
        `https://huggingface.co/org/model/resolve/main/not-gated-${status}.safetensors`
      )
      expect(metadata.gatedRepoUrl).toBeNull()
      expect(metadata.fileSize).toBeNull()
    }
  )

  it('does not cache a non-gated HuggingFace failure', async () => {
    const url =
      'https://huggingface.co/org/model/resolve/main/not-gated-404.safetensors'
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ 'x-error-code': 'GatedRepo' })
    })

    expect((await fetchModelMetadata(url)).gatedRepoUrl).toBeNull()
    expect((await fetchModelMetadata(url)).gatedRepoUrl).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not treat non-HuggingFace hosts as gated', async () => {
    const metadata = await fetchModelMetadata(
      'https://huggingface.co.evil.com/org/model/resolve/main/gated.safetensors'
    )
    expect(metadata.gatedRepoUrl).toBeNull()
    expect(metadata.fileSize).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null for unrecognized Civitai URL patterns', async () => {
    const url = 'https://civitai.com/api/v1/models/123'
    const metadata = await fetchModelMetadata(url)
    expect(metadata.fileSize).toBeNull()
    expect(metadata.gatedRepoUrl).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns cached metadata on second call', async () => {
    const url =
      'https://huggingface.co/org/model/resolve/main/cached.safetensors'

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

  it('caches successful responses without content-length', async () => {
    const url =
      'https://huggingface.co/org/model/resolve/main/no-size.safetensors'
    fetchMock.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({})
    })

    const first = await fetchModelMetadata(url)
    const second = await fetchModelMetadata(url)

    expect(first.fileSize).toBeNull()
    expect(second.fileSize).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns null fileSize for an invalid content-length', async () => {
    const url =
      'https://huggingface.co/org/model/resolve/main/invalid-size.safetensors'
    fetchMock.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-length': 'abc' })
    })

    const metadata = await fetchModelMetadata(url)

    expect(metadata.fileSize).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(url, { method: 'HEAD' })
  })

  it('retries after a metadata request fails', async () => {
    const url =
      'https://huggingface.co/org/model/resolve/main/network-retry.safetensors'
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
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

  it('retries after a non-ok HEAD response', async () => {
    const url =
      'https://huggingface.co/org/model/resolve/main/retry.safetensors'
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers()
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-length': '1024' })
      })

    expect((await fetchModelMetadata(url)).fileSize).toBeNull()
    expect((await fetchModelMetadata(url)).fileSize).toBe(1024)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('deduplicates concurrent requests for the same URL', async () => {
    const url =
      'https://huggingface.co/org/model/resolve/main/dedup.safetensors'

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

describe('fetchModelMetadataWithStatus', () => {
  it('reports a non-OK allowed metadata response as failed', async () => {
    const fetchModelMetadataWithStatus = getFetchModelMetadataWithStatus()
    const url =
      'https://huggingface.co/org/model/resolve/main/not-found.safetensors'
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers()
    })

    await expect(fetchModelMetadataWithStatus(url)).resolves.toEqual({
      metadata: { fileSize: null, gatedRepoUrl: null },
      resolution: 'failed'
    })
  })

  it('reports an allowed metadata network error as failed', async () => {
    const fetchModelMetadataWithStatus = getFetchModelMetadataWithStatus()
    const url =
      'https://huggingface.co/org/model/resolve/main/network.safetensors'
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(fetchModelMetadataWithStatus(url)).resolves.toEqual({
      metadata: { fileSize: null, gatedRepoUrl: null },
      resolution: 'failed'
    })
  })

  it('reports gated HuggingFace proof as resolved manual metadata', async () => {
    const fetchModelMetadataWithStatus = getFetchModelMetadataWithStatus()
    const url =
      'https://huggingface.co/bfl/FLUX.1/resolve/main/gated.safetensors'
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Headers({ 'x-error-code': 'GatedRepo' })
    })

    await expect(fetchModelMetadataWithStatus(url)).resolves.toEqual({
      metadata: {
        fileSize: null,
        gatedRepoUrl: 'https://huggingface.co/bfl/FLUX.1'
      },
      resolution: 'resolved'
    })
  })

  it('reports a successful response without size as resolved', async () => {
    const fetchModelMetadataWithStatus = getFetchModelMetadataWithStatus()
    const url =
      'https://huggingface.co/org/model/resolve/main/no-size-outcome.safetensors'
    fetchMock.mockResolvedValueOnce({
      ok: true,
      headers: new Headers()
    })

    await expect(fetchModelMetadataWithStatus(url)).resolves.toEqual({
      metadata: { fileSize: null, gatedRepoUrl: null },
      resolution: 'resolved'
    })
  })

  it('reports non-allowlisted URLs as resolved unsupported metadata', async () => {
    const fetchModelMetadataWithStatus = getFetchModelMetadataWithStatus()

    await expect(
      fetchModelMetadataWithStatus('https://example.com/model.safetensors')
    ).resolves.toEqual({
      metadata: { fileSize: null, gatedRepoUrl: null },
      resolution: 'resolved'
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports an unrecognized allowed Civitai URL as failed', async () => {
    const fetchModelMetadataWithStatus = getFetchModelMetadataWithStatus()

    await expect(
      fetchModelMetadataWithStatus('https://civitai.com/api/v1/models/123')
    ).resolves.toEqual({
      metadata: { fileSize: null, gatedRepoUrl: null },
      resolution: 'failed'
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shares one inflight request and cache with the legacy metadata API', async () => {
    const fetchModelMetadataWithStatus = getFetchModelMetadataWithStatus()
    const url =
      'https://huggingface.co/org/model/resolve/main/shared-outcome.safetensors'
    fetchMock.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-length': '2048' })
    })

    const [outcome, legacyMetadata] = await Promise.all([
      fetchModelMetadataWithStatus(url),
      fetchModelMetadata(url)
    ])

    expect(outcome).toEqual({
      metadata: { fileSize: 2048, gatedRepoUrl: null },
      resolution: 'resolved'
    })
    expect(legacyMetadata).toEqual({
      fileSize: 2048,
      gatedRepoUrl: null
    })
    await expect(fetchModelMetadataWithStatus(url)).resolves.toEqual(outcome)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('isTrustedHuggingFaceUrl', () => {
  it.for([
    { url: 'https://huggingface.co/org/model', expected: true },
    { url: 'http://huggingface.co/org/model', expected: false },
    { url: 'https://huggingface.co:8443/org/model', expected: false },
    { url: 'https://huggingface.co.evil.com/org/model', expected: false },
    { url: 'javascript:alert(1)', expected: false }
  ] as const)('returns $expected for $url', ({ url, expected }) => {
    expect(isTrustedHuggingFaceUrl(url)).toBe(expected)
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

  it('keeps trust validation separate from URL formatting', () => {
    expect(
      toBrowsableUrl(
        'http://huggingface.co/org/model/resolve/main/file.safetensors'
      )
    ).toBe('http://huggingface.co/org/model/blob/main/file.safetensors')
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

  it('does not open untrusted URLs', () => {
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    openGatedRepoPage('javascript:alert(1)')
    openGatedRepoPage('https://example.com/org/model')

    expect(anchorClick).not.toHaveBeenCalled()
  })
})

describe('model URL allowlist', () => {
  it.for([
    {
      name: 'fake_model.safetensors',
      url: 'http://localhost:8188/api/devtools/fake_model.safetensors'
    },
    {
      name: 'RealESRGAN_x4plus.pth',
      url: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth'
    }
  ])('allows exact URL $url', async ({ name, url }) => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-length': '1' })
    })

    expect(
      isModelDownloadable({
        name,
        url,
        directory: 'checkpoints'
      })
    ).toBe(true)

    const metadata = await fetchModelMetadata(url)

    expect(metadata.fileSize).toBe(1)
    expect(fetchMock).toHaveBeenCalledWith(url, { method: 'HEAD' })
  })

  it.for([
    'http://localhost:6379/api/devtools/fake_model.safetensors',
    'http://localhost:8188/api/devtools/other_model.safetensors',
    'http://localhost:8188/api/devtools/fake_model.safetensors?download=true',
    'http://localhost:8188/api/devtools/fake_model.safetensors#metadata',
    'http://LOCALHOST:8188/api/devtools/fake_model.safetensors',
    'http://127.0.0.1:8188/api/devtools/fake_model.safetensors',
    'http://[::1]:8188/api/devtools/fake_model.safetensors',
    'http://localhost.evil:8188/api/devtools/fake_model.safetensors',
    'https://example.com/model.safetensors'
  ])('blocks URL $url before metadata fetch', async (url) => {
    expect(
      isModelDownloadable({
        name: 'fake_model.safetensors',
        url,
        directory: 'checkpoints'
      })
    ).toBe(false)

    const metadata = await fetchModelMetadata(url)

    expect(metadata).toEqual({ fileSize: null, gatedRepoUrl: null })
    expect(fetchMock).not.toHaveBeenCalled()
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
})

describe('downloadModel', () => {
  beforeEach(() => {
    mockIsDesktop.value = false
    mockSidebarTabStore.activeSidebarTabId = null
  })

  it.for([
    {
      name: 'model.safetensors',
      url: 'https://huggingface.co/org/model/resolve/main/model.safetensors'
    },
    {
      name: 'fake_model.safetensors',
      url: 'http://localhost:8188/api/devtools/fake_model.safetensors'
    }
  ])('opens browser downloads for allowlisted URL $url', ({ name, url }) => {
    const clickedAnchors: HTMLAnchorElement[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      function (this: HTMLAnchorElement) {
        clickedAnchors.push(this)
      }
    )

    downloadModel(
      {
        name,
        url,
        directory: 'checkpoints'
      },
      {}
    )

    expect(clickedAnchors).toHaveLength(1)
    expect(clickedAnchors[0]?.href).toBe(url)
    expect(clickedAnchors[0]?.download).toBe(name)
    expect(clickedAnchors[0]?.target).toBe('_blank')
    expect(clickedAnchors[0]?.rel).toBe('noopener noreferrer')
  })

  it.for([
    'javascript:alert(1)',
    'not a url',
    'http://localhost:6379/model.safetensors'
  ])('does not open browser downloads for blocked URLs (%s)', (url) => {
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    downloadModel(
      {
        name: 'model.safetensors',
        url,
        directory: 'checkpoints'
      },
      {}
    )

    expect(anchorClick).not.toHaveBeenCalled()
  })

  it('does not dispatch blocked localhost URLs through Desktop2', () => {
    const desktopDownloadModel =
      vi.fn<
        (url: string, filename: string, directory: string) => Promise<boolean>
      >()
    window.__comfyDesktop2 = {
      isRemote: () => false,
      downloadModel: desktopDownloadModel
    }

    downloadModel(
      {
        name: 'model.safetensors',
        url: 'http://localhost:6379/model.safetensors',
        directory: 'checkpoints'
      },
      { checkpoints: ['/models/checkpoints'] }
    )

    expect(desktopDownloadModel).not.toHaveBeenCalled()
  })

  it('does not dispatch blocked localhost URLs through Electron', () => {
    mockIsDesktop.value = true
    mockSidebarTabStore.activeSidebarTabId = 'node-library'

    downloadModel(
      {
        name: 'model.safetensors',
        url: 'http://localhost:6379/model.safetensors',
        directory: 'checkpoints'
      },
      { checkpoints: ['/models/checkpoints'] }
    )

    expect(mockStartDownload).not.toHaveBeenCalled()
    expect(mockSidebarTabStore.activeSidebarTabId).toBe('node-library')
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
