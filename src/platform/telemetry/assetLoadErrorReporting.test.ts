import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'

const mockReportError = vi.hoisted(() => vi.fn())
vi.mock(import('./reportError'), () => ({
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
      // First-party is decided against the page origin, so the tests have to
      // name one. Cloud serves the app from here.
      vi.stubGlobal('location', {
        href: 'https://cloud.comfy.org/',
        origin: 'https://cloud.comfy.org'
      })
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

    it.for([
      ['https://www.googletagmanager.com/gtm.js?id=GTM-NP9JM6K7', 'script'],
      ['https://connect.facebook.net/en_US/fbevents.js', 'script'],
      ['https://t.comfy.org/static/posthog-recorder.js', 'script']
    ])('drops the third-party resource %s', ([url, tagName]) => {
      reportResourceLoadError(url, tagName)

      expect(mockReportError).not.toHaveBeenCalled()
      expect(consoleError).not.toHaveBeenCalled()
    })

    it('reports a same-origin failure given as a relative URL', () => {
      reportResourceLoadError('/assets/app.css', 'link')

      expect(mockReportError).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          message: 'Resource load failed: /assets/app.css'
        }),
        expect.objectContaining({ errorType: 'resource_load_error' })
      )
    })

    it('reports a URL it cannot parse rather than dropping it', () => {
      reportResourceLoadError('http://[', 'script')

      expect(mockReportError).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ message: 'Resource load failed: http://[' }),
        expect.objectContaining({ errorType: 'resource_load_error' })
      )
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
      vi.stubGlobal('location', {
        href: 'http://localhost:5173/',
        origin: 'http://localhost:5173'
      })
    })

    it('drops a third-party resource instead of logging it', () => {
      reportResourceLoadError(
        'https://www.googletagmanager.com/gtm.js?id=GTM-NP9JM6K7',
        'script'
      )

      expect(consoleError).not.toHaveBeenCalled()
      expect(mockReportError).not.toHaveBeenCalled()
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
