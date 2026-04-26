import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useMaskEditorDataStore } from '@/stores/maskEditorDataStore'
import type { EditorOutputData } from '@/stores/maskEditorDataStore'

const createImage = (): HTMLImageElement => document.createElement('img')

const createCanvas = (): HTMLCanvasElement => document.createElement('canvas')

const createOutputData = (): EditorOutputData => {
  const blob = new Blob()
  const ref = { filename: 'out.png' }
  return {
    maskedImage: { canvas: createCanvas(), blob, ref },
    paintLayer: { canvas: createCanvas(), blob, ref },
    paintedImage: { canvas: createCanvas(), blob, ref },
    paintedMaskedImage: { canvas: createCanvas(), blob, ref }
  }
}

describe('maskEditorDataStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  describe('initial state', () => {
    it('should start with null input/output/sourceNode', () => {
      const store = useMaskEditorDataStore()

      expect(store.inputData).toBeNull()
      expect(store.outputData).toBeNull()
      expect(store.sourceNode).toBeNull()
    })

    it('should start not loading and without error', () => {
      const store = useMaskEditorDataStore()

      expect(store.isLoading).toBe(false)
      expect(store.loadError).toBeNull()
    })
  })

  describe('hasValidInput', () => {
    it('should be false when inputData is null', () => {
      const store = useMaskEditorDataStore()

      expect(store.hasValidInput).toBe(false)
    })

    it('should be true when inputData is set', () => {
      const store = useMaskEditorDataStore()

      store.inputData = {
        baseLayer: { image: createImage(), url: 'base' },
        maskLayer: { image: createImage(), url: 'mask' },
        sourceRef: { filename: 'src.png' },
        nodeId: 1
      }

      expect(store.hasValidInput).toBe(true)
    })
  })

  describe('hasValidOutput', () => {
    it('should be false when outputData is null', () => {
      const store = useMaskEditorDataStore()

      expect(store.hasValidOutput).toBe(false)
    })

    it('should be true when outputData is set', () => {
      const store = useMaskEditorDataStore()

      store.outputData = createOutputData()

      expect(store.hasValidOutput).toBe(true)
    })
  })

  describe('isReady', () => {
    it('should be false without input', () => {
      const store = useMaskEditorDataStore()

      expect(store.isReady).toBe(false)
    })

    it('should be true with input and not loading', () => {
      const store = useMaskEditorDataStore()

      store.inputData = {
        baseLayer: { image: createImage(), url: 'base' },
        maskLayer: { image: createImage(), url: 'mask' },
        sourceRef: { filename: 'src.png' },
        nodeId: 1
      }

      expect(store.isReady).toBe(true)
    })

    it('should be false when loading even if input is set', () => {
      const store = useMaskEditorDataStore()

      store.inputData = {
        baseLayer: { image: createImage(), url: 'base' },
        maskLayer: { image: createImage(), url: 'mask' },
        sourceRef: { filename: 'src.png' },
        nodeId: 1
      }
      store.isLoading = true

      expect(store.isReady).toBe(false)
    })
  })

  describe('setLoading', () => {
    it('should toggle isLoading without touching loadError when no error provided', () => {
      const store = useMaskEditorDataStore()
      store.loadError = 'previous'

      store.setLoading(true)

      expect(store.isLoading).toBe(true)
      expect(store.loadError).toBe('previous')
    })

    it('should set loadError when an error string is provided', () => {
      const store = useMaskEditorDataStore()

      store.setLoading(false, 'failed to load')

      expect(store.isLoading).toBe(false)
      expect(store.loadError).toBe('failed to load')
    })

    it('should not clear an existing loadError when called with empty string', () => {
      const store = useMaskEditorDataStore()
      store.loadError = 'previous'

      store.setLoading(false, '')

      expect(store.loadError).toBe('previous')
    })
  })

  describe('reset', () => {
    it('should clear all state back to defaults', () => {
      const store = useMaskEditorDataStore()

      store.inputData = {
        baseLayer: { image: createImage(), url: 'base' },
        maskLayer: { image: createImage(), url: 'mask' },
        paintLayer: { image: createImage(), url: 'paint' },
        sourceRef: { filename: 'src.png', subfolder: 'sub', type: 'input' },
        nodeId: 42
      }
      store.outputData = createOutputData()
      store.sourceNode = { id: 42 } as LGraphNode
      store.isLoading = true
      store.loadError = 'something broke'

      store.reset()

      expect(store.inputData).toBeNull()
      expect(store.outputData).toBeNull()
      expect(store.sourceNode).toBeNull()
      expect(store.isLoading).toBe(false)
      expect(store.loadError).toBeNull()
      expect(store.hasValidInput).toBe(false)
      expect(store.hasValidOutput).toBe(false)
      expect(store.isReady).toBe(false)
    })
  })
})
