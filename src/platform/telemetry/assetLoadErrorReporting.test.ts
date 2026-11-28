import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockReportError = vi.hoisted(() => vi.fn())
vi.mock(import('@comfyorg/telemetry/reportError'), () => ({
  reportError: mockReportError
}))

import {
  reportPreloadError,
  reportPreloadErrorUnlessExtensionImport,
  reportResourceLoadError
} from './assetLoadErrorReporting'
import { claimExtensionImportError } from './customNodeLoadTelemetry'

describe('asset load error reporting', () => {
  beforeEach(() => {})

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
          surface: 'platform',
          errorType: 'resource_load_error',
          tags: { tag_name: 'link' }
        })
      )
      expect(console.error).not.toHaveBeenCalled()
    })

    it.for([
      ['https://www.googletagmanager.com/gtm.js?id=GTM-NP9JM6K7', 'script'],
      ['https://connect.facebook.net/en_US/fbevents.js', 'script'],
      ['https://t.comfy.org/static/posthog-recorder.js', 'script']
    ])('drops the third-party resource %s', ([url, tagName]) => {
      reportResourceLoadError(url, tagName)

      expect(mockReportError).not.toHaveBeenCalled()
      expect(console.error).not.toHaveBeenCalled()
    })

    it('reports a same-origin failure given as a relative URL', () => {
      reportResourceLoadError('/assets/app.css', 'link')

      expect(mockReportError).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          message: 'Resource load failed: /assets/app.css'
        }),
        expect.objectContaining({
          surface: 'platform',
          errorType: 'resource_load_error'
        })
      )
    })

    it('reports a URL it cannot parse rather than dropping it', () => {
      reportResourceLoadError('http://[', 'script')

      expect(mockReportError).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ message: 'Resource load failed: http://[' }),
        expect.objectContaining({
          surface: 'platform',
          errorType: 'resource_load_error'
        })
      )
    })

    it('reports a preload failure once and leaves the console to reportError', () => {
      const error = new Error(
        'Failed to fetch dynamically imported module: https://cloud.comfy.org/assets/app-123.js'
      )

      reportPreloadError(error)

      expect(mockReportError).toHaveBeenCalledExactlyOnceWith(
        error,
        expect.objectContaining({
          surface: 'platform',
          errorType: 'vite_preload_error'
        })
      )
      expect(console.error).not.toHaveBeenCalled()
    })
  })

  describe('a preload failure left to reject at its importer', () => {
    beforeEach(() => {
      vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    })

    it('is reported once its importer has had the chance to claim it', () => {
      const error = new Error('Importing a module script failed.')

      reportPreloadErrorUnlessExtensionImport(error)
      expect(mockReportError).not.toHaveBeenCalled()
      vi.runAllTimers()

      expect(mockReportError).toHaveBeenCalledExactlyOnceWith(
        error,
        expect.objectContaining({ errorType: 'vite_preload_error' })
      )
    })

    it('is left to the extension loader when it claimed the failure', () => {
      const error = new SyntaxError("Unexpected token '}'")

      reportPreloadErrorUnlessExtensionImport(error)
      claimExtensionImportError(error)
      vi.runAllTimers()

      expect(mockReportError).not.toHaveBeenCalled()
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

      expect(console.error).not.toHaveBeenCalled()
      expect(mockReportError).not.toHaveBeenCalled()
    })

    it('logs a resource failure locally instead of reporting it', () => {
      reportResourceLoadError('http://localhost:5173/assets/app.css', 'link')

      expect(console.error).toHaveBeenCalledExactlyOnceWith(
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

      expect(console.error).toHaveBeenCalledExactlyOnceWith(
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
