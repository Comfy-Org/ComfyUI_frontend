import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'

const mockReportError = vi.hoisted(() => vi.fn())
vi.mock('./reportError', () => ({
  reportError: mockReportError
}))

import {
  reportPreloadError,
  reportResourceLoadError
} from './assetLoadErrorReporting'

describe('asset load error reporting', () => {
  let consoleError: MockInstance<typeof console.error>

  beforeEach(() => {
    mockReportError.mockClear()
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('on cloud, where a sink exists', () => {
    beforeEach(() => {
      vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    })

    it('reports a resource failure once and leaves the console to reportError', () => {
      reportResourceLoadError('https://cloud.comfy.org/assets/app.css', 'link')

      expect(mockReportError).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          message:
            'Resource load failed: https://cloud.comfy.org/assets/app.css'
        }),
        expect.objectContaining({
          errorType: 'resource_load_error',
          tags: { tag_name: 'link' }
        })
      )
      expect(consoleError).not.toHaveBeenCalled()
    })

    it('reports a preload failure once and leaves the console to reportError', () => {
      const error = new Error(
        'Failed to fetch dynamically imported module: https://cloud.comfy.org/assets/app-123.js'
      )

      reportPreloadError(error)

      expect(mockReportError).toHaveBeenCalledExactlyOnceWith(
        error,
        expect.objectContaining({ errorType: 'vite_preload_error' })
      )
      expect(consoleError).not.toHaveBeenCalled()
    })
  })

  describe('off cloud, where no sink exists', () => {
    beforeEach(() => {
      vi.stubGlobal('__DISTRIBUTION__', 'localhost')
    })

    it('logs a resource failure locally instead of reporting it', () => {
      reportResourceLoadError('http://localhost:5173/assets/app.css', 'link')

      expect(consoleError).toHaveBeenCalledExactlyOnceWith(
        '[resource:loadError]',
        { url: 'http://localhost:5173/assets/app.css', tagName: 'link' }
      )
      expect(mockReportError).not.toHaveBeenCalled()
    })

    it('logs a preload failure locally instead of reporting it', () => {
      reportPreloadError(
        new Error(
          'Failed to fetch dynamically imported module: http://localhost:5173/assets/app-123.js'
        )
      )

      expect(consoleError).toHaveBeenCalledExactlyOnceWith(
        '[vite:preloadError]',
        expect.objectContaining({
          url: 'http://localhost:5173/assets/app-123.js',
          fileType: 'js'
        })
      )
      expect(mockReportError).not.toHaveBeenCalled()
    })
  })
})
