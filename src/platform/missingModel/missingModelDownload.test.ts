import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearMetadataCache,
  downloadModel,
  fetchModelMetadata,
  fetchModelMetadataWithStatus,
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

type ModelDownloadRequest = Parameters<typeof downloadModel>[0]
type ModelFolderPaths = Parameters<typeof downloadModel>[1]
type ModelDownloadDispatchOutcome =
  | {
      status: 'not-dispatched'
      reason: 'not-downloadable' | 'missing-directory-path'
    }
  | { status: 'browser-requested' }
  | {
      status: 'host-requested'
      host: 'desktop2' | 'electron'
      hostResult: Promise<boolean>
    }
  | {
      status: 'dispatch-failed'
      host: 'desktop2' | 'electron'
      error: unknown
    }
type DispatchModelDownload = (
  model: ModelDownloadRequest,
  paths: ModelFolderPaths,
  options?: { revealLegacyDownload?: boolean }
) => ModelDownloadDispatchOutcome

function isDispatchModule(value: unknown): value is {
  dispatchModelDownload: DispatchModelDownload
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'dispatchModelDownload' in value &&
    typeof value.dispatchModelDownload === 'function'
  )
}

const modulePath = './missingModelDownload'
const missingModelDownloadModule: unknown = await import(modulePath)

function getDispatchModelDownload(): DispatchModelDownload {
  if (!isDispatchModule(missingModelDownloadModule)) {
    throw new Error('Expected dispatchModelDownload to be exported')
  }

  return missingModelDownloadModule.dispatchModelDownload
}

function downloadableModel(): ModelDownloadRequest {
  return {
    name: 'model.safetensors',
    url: 'https://huggingface.co/org/model/resolve/main/model.safetensors',
    directory: 'checkpoints'
  }
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
  const emptyMetadata = { fileSize: null, gatedRepoUrl: null }

  it.for([
    {
      name: 'a non-OK response',
      slug: 'not-found',
      prepare: () =>
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    },
    {
      name: 'a network error',
      slug: 'network',
      prepare: () =>
        fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    }
  ])('reports $name for an allowed URL as failed', async (testCase) => {
    testCase.prepare()

    await expect(
      fetchModelMetadataWithStatus(
        `https://huggingface.co/org/model/resolve/main/${testCase.slug}.safetensors`
      )
    ).resolves.toEqual({ metadata: emptyMetadata, resolution: 'failed' })
  })

  it.for([
    {
      name: 'gated proof',
      url: 'https://huggingface.co/bfl/FLUX.1/resolve/main/gated.safetensors',
      response: () =>
        new Response(null, {
          status: 403,
          headers: { 'x-error-code': 'GatedRepo' }
        }),
      metadata: {
        fileSize: null,
        gatedRepoUrl: 'https://huggingface.co/bfl/FLUX.1'
      }
    },
    {
      name: 'a successful response without size',
      url: 'https://huggingface.co/org/model/resolve/main/no-size.safetensors',
      response: () => new Response(),
      metadata: emptyMetadata
    }
  ])('reports $name as resolved', async (testCase) => {
    fetchMock.mockResolvedValueOnce(testCase.response())

    await expect(fetchModelMetadataWithStatus(testCase.url)).resolves.toEqual({
      metadata: testCase.metadata,
      resolution: 'resolved'
    })
  })

  it.for([
    {
      url: 'https://example.com/model.safetensors',
      resolution: 'resolved'
    },
    {
      url: 'https://civitai.com/api/v1/models/123',
      resolution: 'failed'
    }
  ] as const)(
    'reports $url as $resolution without a request',
    async ({ url, resolution }) => {
      await expect(fetchModelMetadataWithStatus(url)).resolves.toEqual({
        metadata: emptyMetadata,
        resolution
      })
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  it('shares one inflight request and cache with the legacy metadata API', async () => {
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

describe('dispatchModelDownload', () => {
  beforeEach(() => {
    mockIsDesktop.value = false
    mockSidebarTabStore.activeSidebarTabId = null
  })

  it('classifies a missing legacy Electron directory path without dispatching', () => {
    mockIsDesktop.value = true

    const outcome = getDispatchModelDownload()(downloadableModel(), {})

    expect(outcome).toEqual({
      status: 'not-dispatched',
      reason: 'missing-directory-path'
    })
    expect(mockSidebarTabStore.activeSidebarTabId).toBeNull()
    expect(mockStartDownload).not.toHaveBeenCalled()
  })

  it('keeps a legacy row download in the current modal when reveal is disabled', () => {
    mockIsDesktop.value = true

    const outcome = getDispatchModelDownload()(
      downloadableModel(),
      { checkpoints: ['/models/checkpoints'] },
      { revealLegacyDownload: false }
    )

    expect(outcome).toMatchObject({
      status: 'host-requested',
      host: 'electron'
    })
    expect(mockSidebarTabStore.activeSidebarTabId).toBeNull()
    expect(mockStartDownload).toHaveBeenCalledOnce()
  })

  it('preserves a false Desktop2 host result without interpreting it', async () => {
    const desktopDownloadModel = vi.fn().mockResolvedValue(false)
    window.__comfyDesktop2 = {
      isRemote: () => false,
      downloadModel: desktopDownloadModel
    }

    const outcome = getDispatchModelDownload()(downloadableModel(), {})

    expect(outcome).toMatchObject({
      status: 'host-requested',
      host: 'desktop2'
    })
    if (outcome.status !== 'host-requested') {
      throw new Error('Expected a Desktop2 host request')
    }
    await expect(outcome.hostResult).resolves.toBe(false)
    expect(mockStartDownload).not.toHaveBeenCalled()
  })

  it('exposes a Desktop2 rejection through the host result', async () => {
    const bridgeError = new Error('Desktop2 bridge rejected')
    window.__comfyDesktop2 = {
      isRemote: () => false,
      downloadModel: vi.fn().mockRejectedValue(bridgeError)
    }

    const outcome = getDispatchModelDownload()(downloadableModel(), {})

    expect(outcome).toMatchObject({
      status: 'host-requested',
      host: 'desktop2'
    })
    if (outcome.status !== 'host-requested') {
      throw new Error('Expected a Desktop2 host request')
    }
    await expect(outcome.hostResult).rejects.toBe(bridgeError)
  })

  it('exposes an Electron rejection through the host result', async () => {
    const electronError = new Error('Electron download rejected')
    mockIsDesktop.value = true
    mockStartDownload.mockRejectedValueOnce(electronError)

    const outcome = getDispatchModelDownload()(downloadableModel(), {
      checkpoints: ['/models/checkpoints']
    })

    expect(outcome).toMatchObject({
      status: 'host-requested',
      host: 'electron'
    })
    if (outcome.status !== 'host-requested') {
      throw new Error('Expected an Electron host request')
    }
    await expect(outcome.hostResult).rejects.toBe(electronError)
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

  it('registers a rejection handler for legacy Electron downloads while returning undefined', () => {
    mockIsDesktop.value = true
    const hostResult = Promise.resolve(false)
    const catchHandler = vi.spyOn(hostResult, 'catch')
    mockStartDownload.mockReturnValueOnce(hostResult)

    const result = downloadModel(downloadableModel(), {
      checkpoints: ['/models/checkpoints']
    })

    expect(result).toBeUndefined()
    expect(catchHandler).toHaveBeenCalledOnce()
  })
})
