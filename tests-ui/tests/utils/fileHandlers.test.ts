import { describe, expect, it } from 'vitest'

import {
  AUDIO_WORKFLOW_FORMATS,
  DATA_WORKFLOW_FORMATS,
  IMAGE_WORKFLOW_FORMATS,
  MODEL_WORKFLOW_FORMATS,
  VIDEO_WORKFLOW_FORMATS
} from '../../../src/constants/supportedWorkflowFormats'
import {
  extensionHandlers,
  getFileHandler,
  mimeTypeHandlers
} from '../../../src/utils/fileHandlers'

describe('fileHandlers', () => {
  describe('handler registrations', () => {
    it('should register handlers for all image MIME types', () => {
      IMAGE_WORKFLOW_FORMATS.mimeTypes.forEach((mimeType) => {
        expect(mimeTypeHandlers.has(mimeType)).toBe(true)
        expect(mimeTypeHandlers.get(mimeType)).toBeTypeOf('function')
      })
    })

    it('should register handlers for all image extensions', () => {
      IMAGE_WORKFLOW_FORMATS.extensions.forEach((ext) => {
        expect(extensionHandlers.has(ext)).toBe(true)
        expect(extensionHandlers.get(ext)).toBeTypeOf('function')
      })
    })

    it('should register handlers for all audio MIME types', () => {
      AUDIO_WORKFLOW_FORMATS.mimeTypes.forEach((mimeType) => {
        expect(mimeTypeHandlers.has(mimeType)).toBe(true)
        expect(mimeTypeHandlers.get(mimeType)).toBeTypeOf('function')
      })
    })

    it('should register handlers for all audio extensions', () => {
      AUDIO_WORKFLOW_FORMATS.extensions.forEach((ext) => {
        expect(extensionHandlers.has(ext)).toBe(true)
        expect(extensionHandlers.get(ext)).toBeTypeOf('function')
      })
    })

    it('should register handlers for all video MIME types', () => {
      VIDEO_WORKFLOW_FORMATS.mimeTypes.forEach((mimeType) => {
        expect(mimeTypeHandlers.has(mimeType)).toBe(true)
        expect(mimeTypeHandlers.get(mimeType)).toBeTypeOf('function')
      })
    })

    it('should register handlers for all video extensions', () => {
      VIDEO_WORKFLOW_FORMATS.extensions.forEach((ext) => {
        expect(extensionHandlers.has(ext)).toBe(true)
        expect(extensionHandlers.get(ext)).toBeTypeOf('function')
      })
    })

    it('should register handlers for all 3D model MIME types', () => {
      MODEL_WORKFLOW_FORMATS.mimeTypes.forEach((mimeType) => {
        expect(mimeTypeHandlers.has(mimeType)).toBe(true)
        expect(mimeTypeHandlers.get(mimeType)).toBeTypeOf('function')
      })
    })

    it('should register handlers for all 3D model extensions', () => {
      MODEL_WORKFLOW_FORMATS.extensions.forEach((ext) => {
        expect(extensionHandlers.has(ext)).toBe(true)
        expect(extensionHandlers.get(ext)).toBeTypeOf('function')
      })
    })

    it('should register handlers for all data MIME types', () => {
      DATA_WORKFLOW_FORMATS.mimeTypes.forEach((mimeType) => {
        expect(mimeTypeHandlers.has(mimeType)).toBe(true)
        expect(mimeTypeHandlers.get(mimeType)).toBeTypeOf('function')
      })
    })

    it('should register handlers for all data extensions', () => {
      DATA_WORKFLOW_FORMATS.extensions.forEach((ext) => {
        expect(extensionHandlers.has(ext)).toBe(true)
        expect(extensionHandlers.get(ext)).toBeTypeOf('function')
      })
    })
  })

  describe('getFileHandler', () => {
    it('should return a handler when a file with a recognized MIME type is provided', () => {
      const file = new File(['test content'], 'test.png', { type: 'image/png' })
      const handler = getFileHandler(file)
      expect(handler).not.toBeNull()
      expect(handler).toBeTypeOf('function')
    })

    it('should return a handler when a file with a recognized extension but no MIME type is provided', () => {
      // File with empty MIME type but recognizable extension
      const file = new File(['test content'], 'test.webp', { type: '' })
      const handler = getFileHandler(file)
      expect(handler).not.toBeNull()
      expect(handler).toBeTypeOf('function')
    })

    it('should return null when no handler is found for the file type', () => {
      const file = new File(['test content'], 'test.txt', {
        type: 'text/plain'
      })
      const handler = getFileHandler(file)
      expect(handler).toBeNull()
    })

    it('should prioritize MIME type over extension when both are present and different', () => {
      // A file with a JSON MIME type but SVG extension
      const file = new File(['{}'], 'test.svg', { type: 'application/json' })
      const handler = getFileHandler(file)

      // Make a shadow copy of the handlers for comparison
      const jsonHandler = mimeTypeHandlers.get('application/json')
      const svgHandler = extensionHandlers.get('.svg')

      // The handler should match the JSON handler, not the SVG handler
      expect(handler).toBe(jsonHandler)
      expect(handler).not.toBe(svgHandler)
    })
  })
})
