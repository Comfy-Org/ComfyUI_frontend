import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import {
  useFileHandlerStore,
  type FileHandlerDefinition
} from '../../../src/stores/fileHandlerStore'
import {
  handlePngFile,
  handleWebpFile,
  handleJsonFile
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

describe('File Handler Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Registration', () => {
    it('should register file handlers correctly', () => {
      const store = useFileHandlerStore()
      
      const definition: FileHandlerDefinition = {
        id: 'test.handler',
        displayName: 'Test Handler',
        mimeTypes: ['image/png'],
        extensions: ['.png'],
        handler: handlePngFile
      }

      store.registerFileHandler(definition)

      expect(store.handlers).toHaveLength(1)
      expect(store.handlers[0].id).toBe('test.handler')
      expect(store.supportedMimeTypes).toContain('image/png')
      expect(store.supportedExtensions).toContain('.png')
    })

    it('should not register duplicate handlers', () => {
      const store = useFileHandlerStore()
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const definition: FileHandlerDefinition = {
        id: 'test.handler',
        displayName: 'Test Handler',
        mimeTypes: ['image/png'],
        extensions: ['.png'],
        handler: handlePngFile
      }

      store.registerFileHandler(definition)
      store.registerFileHandler(definition) // Try to register again

      expect(store.handlers).toHaveLength(1)
      expect(consoleSpy).toHaveBeenCalledWith('File handler test.handler already registered')

      consoleSpy.mockRestore()
    })

    it('should handle priority correctly', () => {
      const store = useFileHandlerStore()

      // Register low priority handler first
      store.registerFileHandler({
        id: 'low.priority',
        displayName: 'Low Priority',
        mimeTypes: ['image/png'],
        extensions: ['.png'],
        handler: handlePngFile,
        priority: 1
      })

      // Register high priority handler
      store.registerFileHandler({
        id: 'high.priority',
        displayName: 'High Priority',
        mimeTypes: ['image/png'],
        extensions: ['.png'],
        handler: handleWebpFile,
        priority: 10
      })

      const handler = store.getHandlerForFile(
        new File([''], 'test.png', { type: 'image/png' })
      )

      expect(handler).toBe(handleWebpFile) // Should return high priority handler
    })
  })

  describe('File Handler Lookup', () => {
    beforeEach(() => {
      const store = useFileHandlerStore()
      
      // Register some test handlers
      store.registerFileHandler({
        id: 'png.handler',
        displayName: 'PNG Handler',
        mimeTypes: ['image/png'],
        extensions: ['.png'],
        handler: handlePngFile
      })

      store.registerFileHandler({
        id: 'webp.handler',
        displayName: 'WebP Handler',
        mimeTypes: ['image/webp'],
        extensions: ['.webp'],
        handler: handleWebpFile
      })

      store.registerFileHandler({
        id: 'json.handler',
        displayName: 'JSON Handler',
        mimeTypes: ['application/json'],
        extensions: ['.json'],
        handler: handleJsonFile
      })
    })

    it('should find handler by MIME type', () => {
      const store = useFileHandlerStore()
      const file = new File([''], 'test.png', { type: 'image/png' })
      
      const handler = store.getHandlerForFile(file)
      expect(handler).toBe(handlePngFile)
    })

    it('should find handler by extension when MIME type is missing', () => {
      const store = useFileHandlerStore()
      const file = new File([''], 'test.png', { type: '' })
      
      const handler = store.getHandlerForFile(file)
      expect(handler).toBe(handlePngFile)
    })

    it('should return null for unsupported files', () => {
      const store = useFileHandlerStore()
      const file = new File([''], 'test.txt', { type: 'text/plain' })
      
      const handler = store.getHandlerForFile(file)
      expect(handler).toBeNull()
    })

    it('should handle files with mixed case extensions', () => {
      const store = useFileHandlerStore()
      const file = new File([''], 'test.PNG', { type: '' })
      
      const handler = store.getHandlerForFile(file)
      expect(handler).toBe(handlePngFile)
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
      const result = await handlePngFile(file)

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
      const result = await handlePngFile(file)

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
      const result = await handlePngFile(file)

      // Both should throw when called
      expect(() => result.workflow!()).toThrow()
      expect(() => result.prompt!()).toThrow()
    })

    it('should handle missing metadata gracefully', async () => {
      const { getPngMetadata } = await import('../../../src/scripts/pnginfo')
      vi.mocked(getPngMetadata).mockResolvedValueOnce({})

      const file = new File([''], 'test.png', { type: 'image/png' })
      const result = await handlePngFile(file)

      expect(result.workflow!()).toBeUndefined()
      expect(result.prompt!()).toBeUndefined()
    })
  })

  describe('JSON handler edge cases', () => {
    it('should handle empty JSON file', async () => {
      const file = new File(['{}'], 'empty.json', { type: 'application/json' })
      const result = await handleJsonFile(file)

      expect(result.jsonTemplateData!()).toEqual({})
    })

    it('should handle malformed JSON', async () => {
      const file = new File(['{invalid json}'], 'bad.json', {
        type: 'application/json'
      })
      
      const result = await handleJsonFile(file)
      
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
      const result = await handlePngFile(file)

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
})