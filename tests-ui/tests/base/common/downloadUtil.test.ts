import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadFile } from '@/base/common/downloadUtil'

let mockIsCloud = false

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud
  }
}))

// Global stubs
const createObjectURLSpy = vi
  .spyOn(URL, 'createObjectURL')
  .mockReturnValue('blob:mock-url')
const revokeObjectURLSpy = vi
  .spyOn(URL, 'revokeObjectURL')
  .mockImplementation(() => {})

describe('downloadUtil', () => {
  let mockLink: HTMLAnchorElement
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockIsCloud = false
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    createObjectURLSpy.mockClear().mockReturnValue('blob:mock-url')
    revokeObjectURLSpy.mockClear().mockImplementation(() => {})
    // Create a mock anchor element
    mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
      style: { display: '' }
    } as unknown as HTMLAnchorElement

    // Spy on DOM methods
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink)
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink)
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('downloadFile', () => {
    it('should create and trigger download with basic URL', () => {
      const testUrl = 'https://example.com/image.png'

      downloadFile(testUrl)

      expect(document.createElement).toHaveBeenCalledWith('a')
      expect(mockLink.href).toBe(testUrl)
      expect(mockLink.download).toBe('download.png') // Default filename
      expect(document.body.appendChild).toHaveBeenCalledWith(mockLink)
      expect(mockLink.click).toHaveBeenCalled()
      expect(document.body.removeChild).toHaveBeenCalledWith(mockLink)
      expect(fetchMock).not.toHaveBeenCalled()
      expect(createObjectURLSpy).not.toHaveBeenCalled()
    })

    it('should use custom filename when provided', () => {
      const testUrl = 'https://example.com/image.png'
      const customFilename = 'my-custom-image.png'

      downloadFile(testUrl, customFilename)

      expect(mockLink.href).toBe(testUrl)
      expect(mockLink.download).toBe(customFilename)
      expect(fetchMock).not.toHaveBeenCalled()
      expect(createObjectURLSpy).not.toHaveBeenCalled()
    })

    it('should extract filename from URL query parameters', () => {
      const testUrl =
        'https://example.com/api/file?filename=extracted-image.jpg&other=param'

      downloadFile(testUrl)

      expect(mockLink.href).toBe(testUrl)
      expect(mockLink.download).toBe('extracted-image.jpg')
      expect(createObjectURLSpy).not.toHaveBeenCalled()
    })

    it('should use default filename when URL has no filename parameter', () => {
      const testUrl = 'https://example.com/api/file?other=param'

      downloadFile(testUrl)

      expect(mockLink.href).toBe(testUrl)
      expect(mockLink.download).toBe('download.png')
      expect(createObjectURLSpy).not.toHaveBeenCalled()
    })

    it('should handle invalid URLs gracefully', () => {
      const invalidUrl = 'not-a-valid-url'

      downloadFile(invalidUrl)

      expect(mockLink.href).toBe(invalidUrl)
      expect(mockLink.download).toBe('download.png')
      expect(mockLink.click).toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
      expect(createObjectURLSpy).not.toHaveBeenCalled()
    })

    it('should prefer custom filename over extracted filename', () => {
      const testUrl =
        'https://example.com/api/file?filename=extracted-image.jpg'
      const customFilename = 'custom-override.png'

      downloadFile(testUrl, customFilename)

      expect(mockLink.download).toBe(customFilename)
      expect(createObjectURLSpy).not.toHaveBeenCalled()
    })

    it('should handle URLs with empty filename parameter', () => {
      const testUrl = 'https://example.com/api/file?filename='

      downloadFile(testUrl)

      expect(mockLink.download).toBe('download.png')
      expect(createObjectURLSpy).not.toHaveBeenCalled()
    })

    it('should handle relative URLs by using window.location.origin', () => {
      const relativeUrl = '/api/file?filename=relative-image.png'

      downloadFile(relativeUrl)

      expect(mockLink.href).toBe(relativeUrl)
      expect(mockLink.download).toBe('relative-image.png')
      expect(fetchMock).not.toHaveBeenCalled()
      expect(createObjectURLSpy).not.toHaveBeenCalled()
    })

    it('should clean up DOM elements after download', () => {
      const testUrl = 'https://example.com/image.png'

      downloadFile(testUrl)

      // Verify the element was added and then removed
      expect(document.body.appendChild).toHaveBeenCalledWith(mockLink)
      expect(document.body.removeChild).toHaveBeenCalledWith(mockLink)
      expect(fetchMock).not.toHaveBeenCalled()
      expect(createObjectURLSpy).not.toHaveBeenCalled()
    })

    it('streams downloads via blob when running in cloud', async () => {
      mockIsCloud = true
      const testUrl = 'https://storage.googleapis.com/bucket/file.bin'
      const blob = new Blob(['test'])
      const blobFn = vi.fn().mockResolvedValue(blob)
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        blob: blobFn
      } as unknown as Response)

      downloadFile(testUrl)

      expect(fetchMock).toHaveBeenCalledWith(testUrl)
      const fetchPromise = fetchMock.mock.results[0].value as Promise<Response>
      await fetchPromise
      const blobPromise = blobFn.mock.results[0].value as Promise<Blob>
      await blobPromise
      await Promise.resolve()
      expect(blobFn).toHaveBeenCalled()
      expect(createObjectURLSpy).toHaveBeenCalledWith(blob)
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')
      expect(mockLink.click).toHaveBeenCalled()
    })

    it('logs an error when cloud fetch fails', async () => {
      mockIsCloud = true
      const testUrl = 'https://storage.googleapis.com/bucket/missing.bin'
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        blob: vi.fn()
      } as unknown as Response)

      downloadFile(testUrl)

      expect(fetchMock).toHaveBeenCalledWith(testUrl)
      const fetchPromise = fetchMock.mock.results[0].value as Promise<Response>
      await fetchPromise
      await Promise.resolve()
      expect(consoleSpy).toHaveBeenCalled()
      expect(createObjectURLSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})
