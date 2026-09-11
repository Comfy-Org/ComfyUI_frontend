import { describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'

import { uploadMedia, uploadMediaBatch } from './uploadService'

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn()
  }
}))

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: vi.fn()
}))

function createMockResponse(
  status: number,
  data?: { name: string; subfolder?: string }
) {
  return {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: vi.fn().mockResolvedValue(data ?? {})
  } as unknown as Response
}

describe('uploadService', () => {
  describe('uploadMedia', () => {
    it('uploads File successfully', async () => {
      const mockFile = new File(['content'], 'test.png', { type: 'image/png' })
      vi.mocked(api.fetchApi).mockResolvedValue(
        createMockResponse(200, { name: 'test.png', subfolder: 'uploads' })
      )

      const result = await uploadMedia({ source: mockFile })

      expect(result.success).toBe(true)
      expect(result.path).toBe('uploads/test.png')
      expect(result.name).toBe('test.png')
      expect(result.subfolder).toBe('uploads')
    })

    it('uploads Blob successfully', async () => {
      const mockBlob = new Blob(['content'], { type: 'image/png' })
      vi.mocked(api.fetchApi).mockResolvedValue(
        createMockResponse(200, { name: 'upload-123.png', subfolder: '' })
      )

      const result = await uploadMedia({ source: mockBlob })

      expect(result.success).toBe(true)
      expect(result.path).toBe('upload-123.png')
    })

    it('uploads dataURL successfully', async () => {
      const dataURL = 'data:image/png;base64,iVBORw0KGgo='
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        blob: () => Promise.resolve(new Blob(['content']))
      } as Response)

      vi.mocked(api.fetchApi).mockResolvedValue(
        createMockResponse(200, { name: 'upload-456.png', subfolder: '' })
      )

      try {
        const result = await uploadMedia({ source: dataURL })
        expect(result.success).toBe(true)
      } finally {
        fetchSpy.mockRestore()
      }
    })

    it('preserves the mime type of a non-PNG dataURL', async () => {
      const dataURL = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        blob: () =>
          Promise.resolve(new Blob(['content'], { type: 'image/jpeg' }))
      } as Response)

      vi.mocked(api.fetchApi).mockResolvedValue(
        createMockResponse(200, { name: 'upload-789.jpg', subfolder: '' })
      )

      try {
        await uploadMedia({ source: dataURL, filename: 'photo.jpg' })
      } finally {
        fetchSpy.mockRestore()
      }

      const formData = vi.mocked(api.fetchApi).mock.calls[0][1]
        ?.body as FormData
      expect((formData.get('image') as File).type).toBe('image/jpeg')
    })

    it('rejects invalid dataURL', async () => {
      const invalidURL = 'not-a-data-url'

      const result = await uploadMedia({ source: invalidURL })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid data URL')
    })

    it('includes subfolder in FormData', async () => {
      const mockFile = new File(['content'], 'test.png')
      vi.mocked(api.fetchApi).mockResolvedValue(
        createMockResponse(200, { name: 'test.png' })
      )

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

    it('uploads a file whose size equals maxSizeMB', async () => {
      const boundaryFile = new File(['content'], 'boundary.png')
      Object.defineProperty(boundaryFile, 'size', {
        value: 100 * 1024 * 1024,
        writable: false
      })
      vi.mocked(api.fetchApi).mockResolvedValue(
        createMockResponse(200, { name: 'boundary.png', subfolder: '' })
      )

      const result = await uploadMedia(
        { source: boundaryFile },
        { maxSizeMB: 100 }
      )

      expect(result.success).toBe(true)
    })

    it('returns a normalized failure when fetching a valid dataURL rejects', async () => {
      const dataURL = 'data:image/png;base64,iVBORw0KGgo='
      const fetchSpy = vi
        .spyOn(global, 'fetch')
        .mockRejectedValue(new Error('Network down'))

      try {
        const result = await uploadMedia({ source: dataURL })

        expect(result).toEqual({
          success: false,
          path: '',
          name: '',
          subfolder: '',
          error: 'Failed to convert data URL to file: Network down',
          response: null
        })
      } finally {
        fetchSpy.mockRestore()
      }
    })

    it('handles upload errors', async () => {
      const mockFile = new File(['content'], 'test.png')
      vi.mocked(api.fetchApi).mockResolvedValue({
        status: 500,
        statusText: 'Internal Server Error'
      } as unknown as Response)

      const result = await uploadMedia({ source: mockFile })

      expect(result.success).toBe(false)
      expect(result.error).toBe('500 - Internal Server Error')
    })

    it('rejects invalid upload responses', async () => {
      const mockFile = new File(['content'], 'test.png')
      vi.mocked(api.fetchApi).mockResolvedValue(createMockResponse(200))

      const result = await uploadMedia({ source: mockFile })

      expect(result).toEqual({
        success: false,
        path: '',
        name: '',
        subfolder: '',
        error: 'Invalid upload response',
        response: null
      })
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
      vi.mocked(api.fetchApi).mockResolvedValue(
        createMockResponse(200, { name: 'mask.png' })
      )

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

    it('forwards the configured endpoint to api.fetchApi', async () => {
      const mockFile = new File(['content'], 'mask.png')
      vi.mocked(api.fetchApi).mockResolvedValue(
        createMockResponse(200, { name: 'mask.png' })
      )

      await uploadMedia({ source: mockFile }, { endpoint: '/upload/mask' })

      expect(api.fetchApi).toHaveBeenCalledWith(
        '/upload/mask',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('defaults to /upload/image endpoint when not specified', async () => {
      const mockFile = new File(['content'], 'test.png')
      vi.mocked(api.fetchApi).mockResolvedValue(
        createMockResponse(200, { name: 'test.png' })
      )

      await uploadMedia({ source: mockFile })

      expect(api.fetchApi).toHaveBeenCalledWith(
        '/upload/image',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('converts Blob source to a File preserving mime type and fallback name', async () => {
      const mockBlob = new Blob(['content'], { type: 'image/png' })
      vi.mocked(api.fetchApi).mockResolvedValue(
        createMockResponse(200, { name: 'upload-123.png', subfolder: '' })
      )

      await uploadMedia({ source: mockBlob })

      const formData = vi.mocked(api.fetchApi).mock.calls[0][1]
        ?.body as FormData
      const uploadedFile = formData.get('image')
      expect(uploadedFile).toBeInstanceOf(File)
      expect((uploadedFile as File).type).toBe('image/png')
      expect((uploadedFile as File).name).toMatch(/^upload-\d+\.png$/)
    })

    it('uses provided filename when converting a Blob', async () => {
      const mockBlob = new Blob(['content'], { type: 'image/png' })
      vi.mocked(api.fetchApi).mockResolvedValue(
        createMockResponse(200, { name: 'custom.png', subfolder: '' })
      )

      await uploadMedia({ source: mockBlob, filename: 'custom.png' })

      const formData = vi.mocked(api.fetchApi).mock.calls[0][1]
        ?.body as FormData
      const uploadedFile = formData.get('image') as File
      expect(uploadedFile.name).toBe('custom.png')
    })
  })

  describe('telemetry', () => {
    it('reports a non-200 upload once', async () => {
      vi.mocked(api.fetchApi).mockResolvedValue({
        status: 500,
        statusText: 'Internal Server Error'
      } as unknown as Response)

      await uploadMedia({ source: new File(['content'], 'test.png') })

      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          message: 'Upload rejected: 500 - Internal Server Error'
        }),
        expect.objectContaining({ errorType: 'failure_uploading_media' })
      )
    })

    it('reports a malformed upload response once', async () => {
      vi.mocked(api.fetchApi).mockResolvedValue(createMockResponse(200))

      await uploadMedia({ source: new File(['content'], 'test.png') })

      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        expect.anything(),
        expect.objectContaining({
          errorType: 'failure_parsing_upload_response'
        })
      )
    })

    it('reports a thrown upload exception once', async () => {
      vi.mocked(api.fetchApi).mockRejectedValue(new Error('Network error'))

      await uploadMedia({ source: new File(['content'], 'test.png') })

      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ message: 'Network error' }),
        expect.objectContaining({ errorType: 'failure_uploading_media' })
      )
    })

    it('does not report a file rejected by the size limit', async () => {
      const largeFile = new File(['content'], 'large.png')
      Object.defineProperty(largeFile, 'size', {
        value: 200 * 1024 * 1024,
        writable: false
      })

      await uploadMedia({ source: largeFile }, { maxSizeMB: 100 })

      expect(reportError).not.toHaveBeenCalled()
    })
  })

  describe('uploadMediaBatch', () => {
    it('returns empty array for empty input', async () => {
      const results = await uploadMediaBatch([])

      expect(results).toHaveLength(0)
      expect(api.fetchApi).not.toHaveBeenCalled()
    })

    it('uploads multiple files', async () => {
      const mockFiles = [
        new File(['1'], 'file1.png'),
        new File(['2'], 'file2.png')
      ]

      vi.mocked(api.fetchApi)
        .mockResolvedValueOnce(
          createMockResponse(200, { name: 'file1.png', subfolder: '' })
        )
        .mockResolvedValueOnce(
          createMockResponse(200, { name: 'file2.png', subfolder: '' })
        )

      const results = await uploadMediaBatch(
        mockFiles.map((source) => ({ source }))
      )

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(true)
    })
  })
})
