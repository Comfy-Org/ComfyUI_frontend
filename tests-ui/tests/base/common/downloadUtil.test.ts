import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadFile } from '@/base/common/downloadUtil'

describe('downloadUtil', () => {
  let mockLink: HTMLAnchorElement

  beforeEach(() => {
    // Create a mock anchor element
    mockLink = {
      href: '',
      download: '',
      click: vi.fn()
    } as unknown as HTMLAnchorElement

    // Spy on DOM methods
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink)
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink)
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink)
  })

  afterEach(() => {
    vi.restoreAllMocks()
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
    })

    it('should use custom filename when provided', () => {
      const testUrl = 'https://example.com/image.png'
      const customFilename = 'my-custom-image.png'

      downloadFile(testUrl, customFilename)

      expect(mockLink.href).toBe(testUrl)
      expect(mockLink.download).toBe(customFilename)
    })

    it('should extract filename from URL query parameters', () => {
      const testUrl =
        'https://example.com/api/file?filename=extracted-image.jpg&other=param'

      downloadFile(testUrl)

      expect(mockLink.href).toBe(testUrl)
      expect(mockLink.download).toBe('extracted-image.jpg')
    })

    it('should use default filename when URL has no filename parameter', () => {
      const testUrl = 'https://example.com/api/file?other=param'

      downloadFile(testUrl)

      expect(mockLink.href).toBe(testUrl)
      expect(mockLink.download).toBe('download.png')
    })

    it('should handle invalid URLs gracefully', () => {
      const invalidUrl = 'not-a-valid-url'

      downloadFile(invalidUrl)

      expect(mockLink.href).toBe(invalidUrl)
      expect(mockLink.download).toBe('download.png')
      expect(mockLink.click).toHaveBeenCalled()
    })

    it('should prefer custom filename over extracted filename', () => {
      const testUrl =
        'https://example.com/api/file?filename=extracted-image.jpg'
      const customFilename = 'custom-override.png'

      downloadFile(testUrl, customFilename)

      expect(mockLink.download).toBe(customFilename)
    })

    it('should handle URLs with empty filename parameter', () => {
      const testUrl = 'https://example.com/api/file?filename='

      downloadFile(testUrl)

      expect(mockLink.download).toBe('download.png')
    })

    it('should handle relative URLs by using window.location.origin', () => {
      const relativeUrl = '/api/file?filename=relative-image.png'

      downloadFile(relativeUrl)

      expect(mockLink.href).toBe(relativeUrl)
      expect(mockLink.download).toBe('relative-image.png')
    })

    it('should clean up DOM elements after download', () => {
      const testUrl = 'https://example.com/image.png'

      downloadFile(testUrl)

      // Verify the element was added and then removed
      expect(document.body.appendChild).toHaveBeenCalledWith(mockLink)
      expect(document.body.removeChild).toHaveBeenCalledWith(mockLink)
    })
  })
})
