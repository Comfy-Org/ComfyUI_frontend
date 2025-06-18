import { describe, expect, it, vi } from 'vitest'

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
  isApiJson,
  mimeTypeHandlers
} from '../../../src/utils/fileHandlers'

// Mock the metadata functions
vi.mock('../../../src/scripts/pnginfo', () => ({
  getPngMetadata: vi.fn().mockResolvedValue({
    workflow: '{"test": "workflow"}',
    prompt: '{"test": "prompt"}'
  }),
  getWebpMetadata: vi
    .fn()
    .mockResolvedValue({ workflow: '{"test": "workflow"}' }),
  getFlacMetadata: vi
    .fn()
    .mockResolvedValue({ workflow: '{"test": "workflow"}' }),
  getLatentMetadata: vi
    .fn()
    .mockResolvedValue({ workflow: '{"test": "workflow"}' })
}))

vi.mock('../../../src/scripts/metadata/svg', () => ({
  getSvgMetadata: vi.fn().mockResolvedValue({ workflow: { test: 'workflow' } })
}))

vi.mock('../../../src/scripts/metadata/mp3', () => ({
  getMp3Metadata: vi.fn().mockResolvedValue({ workflow: { test: 'workflow' } })
}))

vi.mock('../../../src/scripts/metadata/ogg', () => ({
  getOggMetadata: vi.fn().mockResolvedValue({ workflow: { test: 'workflow' } })
}))

vi.mock('../../../src/scripts/metadata/ebml', () => ({
  getFromWebmFile: vi.fn().mockResolvedValue({ workflow: { test: 'workflow' } })
}))

vi.mock('../../../src/scripts/metadata/isobmff', () => ({
  getFromIsobmffFile: vi
    .fn()
    .mockResolvedValue({ workflow: { test: 'workflow' } })
}))

vi.mock('../../../src/scripts/metadata/gltf', () => ({
  getGltfBinaryMetadata: vi
    .fn()
    .mockResolvedValue({ workflow: { test: 'workflow' } })
}))

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

    it('should register handlers for all model MIME types', () => {
      MODEL_WORKFLOW_FORMATS.mimeTypes.forEach((mimeType) => {
        expect(mimeTypeHandlers.has(mimeType)).toBe(true)
        expect(mimeTypeHandlers.get(mimeType)).toBeTypeOf('function')
      })
    })

    it('should register handlers for all model extensions', () => {
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
    it('should return handler based on MIME type', () => {
      const file = new File([''], 'test.png', { type: 'image/png' })
      const handler = getFileHandler(file)
      expect(handler).toBeTruthy()
      expect(handler).toBeTypeOf('function')
    })

    it('should return handler based on file extension when MIME type is not available', () => {
      const file = new File([''], 'test.png', { type: '' })
      const handler = getFileHandler(file)
      expect(handler).toBeTruthy()
      expect(handler).toBeTypeOf('function')
    })

    it('should return null for unsupported file types', () => {
      const file = new File([''], 'test.xyz', { type: 'application/unknown' })
      const handler = getFileHandler(file)
      expect(handler).toBeNull()
    })

    it('should prioritize MIME type over file extension', () => {
      const file = new File([''], 'test.txt', { type: 'image/png' })
      const handler = getFileHandler(file)
      expect(handler).toBe(mimeTypeHandlers.get('image/png'))
    })
  })

  describe('isApiJson', () => {
    it('should return true for valid API JSON', () => {
      const apiJson = {
        '1': { class_type: 'Node1', inputs: {} },
        '2': { class_type: 'Node2', inputs: {} }
      }
      expect(isApiJson(apiJson)).toBe(true)
    })

    it('should return false for non-API JSON', () => {
      expect(isApiJson({})).toBe(false)
      expect(isApiJson({ nodes: [] })).toBe(false)
      expect(isApiJson(null)).toBe(false)
      expect(isApiJson('string')).toBe(false)
    })
  })

  describe('PNG handler with NaN values', () => {
    it('should return lazy functions that parse on demand', async () => {
      const { getPngMetadata } = await import('../../../src/scripts/pnginfo')
      vi.mocked(getPngMetadata).mockResolvedValueOnce({
        workflow: '{"valid": "json"}',
        prompt: '{"invalid": NaN}'
      })

      const file = new File([''], 'test.png', { type: 'image/png' })
      const handler = getFileHandler(file)
      const result = await handler!(file)

      expect(result.workflow).toBeTypeOf('function')
      expect(result.prompt).toBeTypeOf('function')

      // workflow should parse successfully
      expect(result.workflow!()).toEqual({ valid: 'json' })

      // prompt should throw on parse due to NaN
      expect(() => result.prompt!()).toThrow()
    })

    it('should handle valid workflow with invalid prompt JSON', async () => {
      const { getPngMetadata } = await import('../../../src/scripts/pnginfo')
      vi.mocked(getPngMetadata).mockResolvedValueOnce({
        workflow: '{"nodes": [{"id": 1, "type": "TestNode"}]}',
        prompt:
          '{"1": {"inputs": {"seed": 123}, "class_type": "TestNode"}, "error": NaN}'
      })

      const file = new File([''], 'test.png', { type: 'image/png' })
      const handler = getFileHandler(file)
      const result = await handler!(file)

      // workflow should parse successfully
      const workflowData = result.workflow!()
      expect(workflowData).toEqual({
        nodes: [{ id: 1, type: 'TestNode' }]
      })

      // prompt should throw due to invalid JSON
      expect(() => result.prompt!()).toThrow('Unexpected token')
    })

    it('should handle both fields containing NaN', async () => {
      const { getPngMetadata } = await import('../../../src/scripts/pnginfo')
      vi.mocked(getPngMetadata).mockResolvedValueOnce({
        workflow: '{"value": NaN}',
        prompt: '{"error": NaN}'
      })

      const file = new File([''], 'test.png', { type: 'image/png' })
      const handler = getFileHandler(file)
      const result = await handler!(file)

      // Both should throw when called
      expect(() => result.workflow!()).toThrow()
      expect(() => result.prompt!()).toThrow()
    })

    it('should handle missing metadata gracefully', async () => {
      const { getPngMetadata } = await import('../../../src/scripts/pnginfo')
      vi.mocked(getPngMetadata).mockResolvedValueOnce({})

      const file = new File([''], 'test.png', { type: 'image/png' })
      const handler = getFileHandler(file)
      const result = await handler!(file)

      expect(result.workflow!()).toBeUndefined()
      expect(result.prompt!()).toBeUndefined()
    })

    it('should handle undefined metadata fields', async () => {
      const { getPngMetadata } = await import('../../../src/scripts/pnginfo')
      vi.mocked(getPngMetadata).mockResolvedValueOnce({
        workflow: undefined as any,
        prompt: undefined as any,
        parameters: 'some parameters'
      })

      const file = new File([''], 'test.png', { type: 'image/png' })
      const handler = getFileHandler(file)
      const result = await handler!(file)

      expect(result.workflow!()).toBeUndefined()
      expect(result.prompt!()).toBeUndefined()
      expect(result.parameters).toBe('some parameters')
    })
  })

  describe('WebP handler variations', () => {
    it('should handle case-sensitive workflow field names', async () => {
      const { getWebpMetadata } = await import('../../../src/scripts/pnginfo')
      vi.mocked(getWebpMetadata).mockResolvedValueOnce({
        Workflow: '{"uppercase": true}',
        Prompt: '{"uppercase": true}'
      })

      const file = new File([''], 'test.webp', { type: 'image/webp' })
      const handler = getFileHandler(file)
      const result = await handler!(file)

      expect(result.workflow!()).toEqual({ uppercase: true })
      expect(result.prompt!()).toEqual({ uppercase: true })
    })
  })

  describe('JSON handler edge cases', () => {
    it('should handle empty JSON file', async () => {
      const file = new File(['{}'], 'empty.json', { type: 'application/json' })
      const handler = getFileHandler(file)
      const result = await handler!(file)

      expect(result.jsonTemplateData!()).toEqual({})
    })

    it('should handle malformed JSON', async () => {
      const file = new File(['{invalid json}'], 'bad.json', {
        type: 'application/json'
      })
      const handler = getFileHandler(file)
      const result = await handler!(file)

      // Should throw when calling the lazy functions
      expect(() => result.jsonTemplateData!()).toThrow()
      expect(() => result.workflow!()).toThrow()
      expect(() => result.prompt!()).toThrow()
    })
  })

  describe('Lazy evaluation behavior', () => {
    it('should not parse until functions are called', async () => {
      const { getPngMetadata } = await import('../../../src/scripts/pnginfo')
      const originalParse = JSON.parse
      let parseCallCount = 0
      JSON.parse = vi.fn((text: string) => {
        parseCallCount++
        return originalParse(text)
      })

      vi.mocked(getPngMetadata).mockResolvedValueOnce({
        workflow: '{"test": "data"}',
        prompt: '{"test": "prompt"}'
      })

      const file = new File([''], 'test.png', { type: 'image/png' })
      const handler = getFileHandler(file)
      const result = await handler!(file)

      // JSON.parse should not have been called yet
      expect(parseCallCount).toBe(0)

      // Call workflow function
      result.workflow!()
      expect(parseCallCount).toBe(1)

      // Call prompt function
      result.prompt!()
      expect(parseCallCount).toBe(2)

      // Restore original JSON.parse
      JSON.parse = originalParse
    })
  })

  describe('File extension fallback', () => {
    it('should use file extension when MIME type is empty', () => {
      const file = new File([''], 'test.png', { type: '' })
      const handler = getFileHandler(file)
      expect(handler).toBe(extensionHandlers.get('.png'))
    })

    it('should use file extension when MIME type is application/octet-stream', () => {
      const file = new File([''], 'test.mp3', {
        type: 'application/octet-stream'
      })
      const handler = getFileHandler(file)
      expect(handler).toBe(extensionHandlers.get('.mp3'))
    })
  })
})
