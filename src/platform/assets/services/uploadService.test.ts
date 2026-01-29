import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { uploadMedia, uploadMediaBatch } from './uploadService'

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn()
  }
}))

describe('uploadService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('uploadMedia', () => {
    it('uploads File successfully', async () => {
      const mockFile = new File(['content'], 'test.png', { type: 'image/png' })
      const mockResponse = {
        status: 200,
        json: vi.fn().mockResolvedValue({
          name: 'test.png',
          subfolder: 'uploads'
        })
      }

      vi.mocked(api.fetchApi).mockResolvedValue(mockResponse as any)

      const result = await uploadMedia({ source: mockFile })

      expect(result.success).toBe(true)
      expect(result.path).toBe('uploads/test.png')
      expect(result.name).toBe('test.png')
      expect(result.subfolder).toBe('uploads')
    })

    it('uploads Blob successfully', async () => {
      const mockBlob = new Blob(['content'], { type: 'image/png' })
      const mockResponse = {
        status: 200,
        json: vi.fn().mockResolvedValue({
          name: 'upload-123.png',
          subfolder: ''
        })
      }

      vi.mocked(api.fetchApi).mockResolvedValue(mockResponse as any)

      const result = await uploadMedia({ source: mockBlob })

      expect(result.success).toBe(true)
      expect(result.path).toBe('upload-123.png')
    })

    it('uploads dataURL successfully', async () => {
      const dataURL = 'data:image/png;base64,iVBORw0KGgo='
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        blob: () => Promise.resolve(new Blob(['content']))
      } as Response)

      const mockResponse = {
        status: 200,
        json: vi.fn().mockResolvedValue({
          name: 'upload-456.png',
          subfolder: ''
        })
      }

      vi.mocked(api.fetchApi).mockResolvedValue(mockResponse as any)

      try {
        const result = await uploadMedia({ source: dataURL })
        expect(result.success).toBe(true)
      } finally {
        fetchSpy.mockRestore()
      }
    })

    it('rejects invalid dataURL', async () => {
      const invalidURL = 'not-a-data-url'

      const result = await uploadMedia({ source: invalidURL })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid data URL')
    })

    it('includes subfolder in FormData', async () => {
      const mockFile = new File(['content'], 'test.png')
      const mockResponse = {
        status: 200,
        json: vi.fn().mockResolvedValue({ name: 'test.png' })
      }

      vi.mocked(api.fetchApi).mockResolvedValue(mockResponse as any)

      await uploadMedia(
        { source: mockFile },
        { subfolder: 'custom', type: 'input' }
      )

      const formData = vi.mocked(api.fetchApi).mock.calls[0][1]
        ?.body as FormData
      expect(formData.get('subfolder')).toBe('custom')
      expect(formData.get('type')).toBe('input')
    })

    it('validates file size', async () => {
      // Create a file that reports as 200MB without actually allocating that much memory
      const largeFile = new File(['content'], 'large.png')
      Object.defineProperty(largeFile, 'size', {
        value: 200 * 1024 * 1024,
        writable: false
      })

      const result = await uploadMedia(
        { source: largeFile },
        { maxSizeMB: 100 }
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('exceeds maximum')
    })

    it('handles upload errors', async () => {
      const mockFile = new File(['content'], 'test.png')
      const mockResponse = {
        status: 500,
        statusText: 'Internal Server Error'
      }

      vi.mocked(api.fetchApi).mockResolvedValue(mockResponse as any)

      const result = await uploadMedia({ source: mockFile })

      expect(result.success).toBe(false)
      expect(result.error).toBe('500 - Internal Server Error')
    })

    it('handles exceptions', async () => {
      const mockFile = new File(['content'], 'test.png')

      vi.mocked(api.fetchApi).mockRejectedValue(new Error('Network error'))

      const result = await uploadMedia({ source: mockFile })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })

    it('includes originalRef for mask uploads', async () => {
      const mockFile = new File(['content'], 'mask.png')
      const mockResponse = {
        status: 200,
        json: vi.fn().mockResolvedValue({ name: 'mask.png' })
      }

      vi.mocked(api.fetchApi).mockResolvedValue(mockResponse as any)

      const originalRef = {
        filename: 'original.png',
        subfolder: 'images',
        type: 'input'
      }

      await uploadMedia(
        { source: mockFile },
        { endpoint: '/upload/mask', originalRef }
      )

      const formData = vi.mocked(api.fetchApi).mock.calls[0][1]
        ?.body as FormData
      expect(formData.get('original_ref')).toBe(JSON.stringify(originalRef))
    })
  })

  describe('uploadMediaBatch', () => {
    it('uploads multiple files', async () => {
      const mockFiles = [
        new File(['1'], 'file1.png'),
        new File(['2'], 'file2.png')
      ]

      const mockResponse1 = {
        status: 200,
        json: vi.fn().mockResolvedValue({ name: 'file1.png', subfolder: '' })
      }

      const mockResponse2 = {
        status: 200,
        json: vi.fn().mockResolvedValue({ name: 'file2.png', subfolder: '' })
      }

      vi.mocked(api.fetchApi)
        .mockResolvedValueOnce(mockResponse1 as any)
        .mockResolvedValueOnce(mockResponse2 as any)

      const results = await uploadMediaBatch(
        mockFiles.map((source) => ({ source }))
      )

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(true)
    })
  })
})
