import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockStartDownload = vi.fn()
const mockUseElectronDownloadStore = vi.fn(() => ({
  start: mockStartDownload
}))
let mockIsDesktop = false

vi.mock('@/platform/distribution/types', () => ({
  get isDesktop() {
    return mockIsDesktop
  }
}))
vi.mock('@/stores/electronDownloadStore', () => ({
  useElectronDownloadStore: () => mockUseElectronDownloadStore()
}))

import {
  downloadModel,
  fetchModelMetadata,
  toBrowsableUrl
} from './missingModelDownload'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

let testId = 0

describe('missingModelDownload', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    mockStartDownload.mockReset()
    mockUseElectronDownloadStore.mockClear()
    mockIsDesktop = false
    testId++
  })

  describe('downloadModel', () => {
    it('returns true immediately for browser downloads', async () => {
      const click = vi.fn()
      const createElement = vi
        .spyOn(document, 'createElement')
        .mockReturnValue({
          click,
          href: '',
          download: '',
          target: '',
          rel: ''
        } as unknown as HTMLAnchorElement)

      await expect(
        downloadModel(
          {
            name: 'model.safetensors',
            url: 'https://huggingface.co/org/model/resolve/main/model.safetensors',
            directory: 'checkpoints'
          },
          { checkpoints: ['/models/checkpoints'] }
        )
      ).resolves.toBe(true)

      expect(click).toHaveBeenCalled()
      createElement.mockRestore()
    })

    it('starts Electron downloads with the resolved save path', async () => {
      mockIsDesktop = true
      mockStartDownload.mockResolvedValue(true)

      await expect(
        downloadModel(
          {
            name: 'model.safetensors',
            url: 'https://huggingface.co/org/model/resolve/main/model.safetensors',
            directory: 'checkpoints'
          },
          { checkpoints: ['/models/checkpoints'] }
        )
      ).resolves.toBe(true)

      expect(mockStartDownload).toHaveBeenCalledWith({
        url: 'https://huggingface.co/org/model/resolve/main/model.safetensors',
        savePath: '/models/checkpoints',
        filename: 'model.safetensors'
      })
    })

    it('returns false when the destination directory is unavailable', async () => {
      mockIsDesktop = true

      await expect(
        downloadModel(
          {
            name: 'model.safetensors',
            url: 'https://huggingface.co/org/model/resolve/main/model.safetensors',
            directory: 'checkpoints'
          },
          {}
        )
      ).resolves.toBe(false)

      expect(mockStartDownload).not.toHaveBeenCalled()
    })
  })

  describe('fetchModelMetadata', () => {
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
})
