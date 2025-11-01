import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { IMappedComboWidget } from '@/lib/litegraph/src/types/widgets'
import { MappedComboWidget } from '@/lib/litegraph/src/widgets/MappedComboWidget'

const HASH_FILENAME =
  '72e786ff2a44d682c4294db0b7098e569832bc394efc6dad644e6ec85a78efb7.png'
const HASH_FILENAME_2 =
  'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456.jpg'

interface MockWidgetConfig extends Omit<IMappedComboWidget, 'options'> {
  options: IMappedComboWidget['options']
}

function createMockWidgetConfig(
  overrides: Partial<MockWidgetConfig> = {}
): MockWidgetConfig {
  return {
    type: 'mapped_combo',
    name: 'test',
    value: '',
    options: { values: [] },
    y: 0,
    ...overrides
  }
}

describe('MappedComboWidget', () => {
  let node: LGraphNode
  let widget: MappedComboWidget

  beforeEach(() => {
    vi.clearAllMocks()
    node = new LGraphNode('TestNode')
  })

  describe('_displayValue', () => {
    it('should return human-readable name for hash filename when mapValue provided', () => {
      const mockMapValue = vi.fn().mockReturnValue('Beautiful Sunset.png')

      widget = new MappedComboWidget(
        createMockWidgetConfig({
          name: 'image',
          value: HASH_FILENAME,
          options: {
            values: [HASH_FILENAME],
            mapValue: mockMapValue
          }
        }),
        node
      )

      expect(widget._displayValue).toBe('Beautiful Sunset.png')
      expect(mockMapValue).toHaveBeenCalledWith(HASH_FILENAME)
    })

    it('should return hash filename as fallback when mapping returns same value', () => {
      const mockMapValue = vi.fn().mockReturnValue(HASH_FILENAME)

      widget = new MappedComboWidget(
        createMockWidgetConfig({
          name: 'image',
          value: HASH_FILENAME,
          options: {
            values: [HASH_FILENAME],
            mapValue: mockMapValue
          }
        }),
        node
      )

      expect(widget._displayValue).toBe(HASH_FILENAME)
      expect(mockMapValue).toHaveBeenCalledWith(HASH_FILENAME)
    })

    it('should return hash filename without mapping when mapValue not provided', () => {
      widget = new MappedComboWidget(
        createMockWidgetConfig({
          name: 'image',
          value: HASH_FILENAME,
          options: { values: [HASH_FILENAME] }
        }),
        node
      )

      expect(widget._displayValue).toBe(HASH_FILENAME)
    })

    it('should return empty string when disabled', () => {
      const mockMapValue = vi.fn()

      widget = new MappedComboWidget(
        createMockWidgetConfig({
          name: 'image',
          value: HASH_FILENAME,
          options: {
            values: [HASH_FILENAME],
            mapValue: mockMapValue
          },
          computedDisabled: true
        }),
        node
      )

      expect(widget._displayValue).toBe('')
      expect(mockMapValue).not.toHaveBeenCalled()
    })

    it('should handle non-hash values without mapping', () => {
      const regularFilename = 'image1.png'
      const mockMapValue = vi.fn()

      widget = new MappedComboWidget(
        createMockWidgetConfig({
          name: 'image',
          value: regularFilename,
          options: {
            values: [regularFilename],
            mapValue: mockMapValue
          }
        }),
        node
      )

      expect(widget._displayValue).toBe('image1.png')
      expect(mockMapValue).not.toHaveBeenCalled()
    })

    it('should convert number values to string before display', () => {
      widget = new MappedComboWidget(
        createMockWidgetConfig({
          name: 'index',
          value: 42,
          options: { values: ['0', '1', '42'] }
        }),
        node
      )

      expect(widget._displayValue).toBe('42')
    })

    it('should handle mapValue error gracefully', () => {
      const mockMapValue = vi.fn().mockImplementation(() => {
        throw new Error('Mapping failed')
      })
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      widget = new MappedComboWidget(
        createMockWidgetConfig({
          name: 'image',
          value: HASH_FILENAME,
          options: {
            values: [HASH_FILENAME],
            mapValue: mockMapValue
          }
        }),
        node
      )

      expect(widget._displayValue).toBe(HASH_FILENAME)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to map hash filename to human-readable name:',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe('onClick', () => {
    it('should show dropdown with mapped names for hash filenames', () => {
      const mockMapValue = vi
        .fn()
        .mockReturnValueOnce('Beautiful Sunset.png')
        .mockReturnValueOnce('Mountain Vista.jpg')

      widget = new MappedComboWidget(
        createMockWidgetConfig({
          name: 'image',
          value: HASH_FILENAME,
          options: {
            values: [HASH_FILENAME, HASH_FILENAME_2],
            mapValue: mockMapValue
          }
        }),
        node
      )

      const mockCanvas = { ds: { scale: 1 } } as any
      const mockEvent = { canvasX: 100 } as any
      node.pos = [50, 50]

      const mockContextMenu = vi.fn()
      LiteGraph.ContextMenu = mockContextMenu as any

      widget.onClick({ e: mockEvent, node, canvas: mockCanvas })

      expect(mockContextMenu).toHaveBeenCalledWith(
        ['Beautiful Sunset.png', 'Mountain Vista.jpg'],
        expect.objectContaining({
          scale: 1,
          event: mockEvent,
          className: 'dark'
        })
      )
    })

    it('should set hash filename value when selecting mapped name from dropdown', () => {
      const mockMapValue = vi
        .fn()
        .mockReturnValueOnce('Beautiful Sunset.png')
        .mockReturnValueOnce('Mountain Vista.jpg')

      widget = new MappedComboWidget(
        createMockWidgetConfig({
          name: 'image',
          value: HASH_FILENAME,
          options: {
            values: [HASH_FILENAME, HASH_FILENAME_2],
            mapValue: mockMapValue
          }
        }),
        node
      )

      const mockCanvas = { ds: { scale: 1 } } as any
      const mockEvent = { canvasX: 100 } as any
      node.pos = [50, 50]

      let capturedCallback: ((value: string) => void) | undefined
      const mockContextMenu = vi.fn((_values, options) => {
        capturedCallback = options.callback
        return {} as any
      })
      LiteGraph.ContextMenu = mockContextMenu as any

      const setValueSpy = vi.spyOn(widget, 'setValue')

      widget.onClick({ e: mockEvent, node, canvas: mockCanvas })

      // Simulate selecting "Mountain Vista.jpg" from dropdown
      capturedCallback?.('Mountain Vista.jpg')

      expect(setValueSpy).toHaveBeenCalledWith(HASH_FILENAME_2, {
        e: mockEvent,
        node,
        canvas: mockCanvas
      })
    })

    it('should delegate to decrementValue when clicking left arrow', () => {
      widget = new MappedComboWidget(
        createMockWidgetConfig({
          name: 'image',
          value: HASH_FILENAME,
          options: { values: [HASH_FILENAME, HASH_FILENAME_2] }
        }),
        node
      )

      const mockCanvas = {} as any
      const mockEvent = { canvasX: 60 } as any
      node.pos = [50, 50]

      const decrementSpy = vi.spyOn(widget, 'decrementValue')

      widget.onClick({ e: mockEvent, node, canvas: mockCanvas })

      expect(decrementSpy).toHaveBeenCalledWith({
        e: mockEvent,
        node,
        canvas: mockCanvas
      })
    })

    it('should delegate to incrementValue when clicking right arrow', () => {
      widget = new MappedComboWidget(
        createMockWidgetConfig({
          name: 'image',
          value: HASH_FILENAME,
          options: { values: [HASH_FILENAME, HASH_FILENAME_2] }
        }),
        node
      )

      const mockCanvas = {} as any
      const mockEvent = { canvasX: 250 } as any
      node.pos = [50, 50]
      node.size = [200, 30]

      const incrementSpy = vi.spyOn(widget, 'incrementValue')

      widget.onClick({ e: mockEvent, node, canvas: mockCanvas })

      expect(incrementSpy).toHaveBeenCalledWith({
        e: mockEvent,
        node,
        canvas: mockCanvas
      })
    })

    it('should show hash filenames in dropdown when mapValue not provided', () => {
      widget = new MappedComboWidget(
        createMockWidgetConfig({
          name: 'image',
          value: HASH_FILENAME,
          options: { values: [HASH_FILENAME, HASH_FILENAME_2] }
        }),
        node
      )

      const mockCanvas = { ds: { scale: 1 } } as any
      const mockEvent = { canvasX: 100 } as any
      node.pos = [50, 50]

      const mockContextMenu = vi.fn()
      LiteGraph.ContextMenu = mockContextMenu as any

      widget.onClick({ e: mockEvent, node, canvas: mockCanvas })

      expect(mockContextMenu).toHaveBeenCalledWith(
        [HASH_FILENAME, HASH_FILENAME_2],
        expect.any(Object)
      )
    })

    it('should handle mapValue error in dropdown gracefully', () => {
      const mockMapValue = vi.fn().mockImplementation(() => {
        throw new Error('Mapping failed')
      })
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      widget = new MappedComboWidget(
        createMockWidgetConfig({
          name: 'image',
          value: HASH_FILENAME,
          options: {
            values: [HASH_FILENAME],
            mapValue: mockMapValue
          }
        }),
        node
      )

      const mockCanvas = { ds: { scale: 1 } } as any
      const mockEvent = { canvasX: 100 } as any
      node.pos = [50, 50]

      const mockContextMenu = vi.fn()
      LiteGraph.ContextMenu = mockContextMenu as any

      widget.onClick({ e: mockEvent, node, canvas: mockCanvas })

      // Should fall back to hash filename
      expect(mockContextMenu).toHaveBeenCalledWith(
        [HASH_FILENAME],
        expect.any(Object)
      )
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to map value for dropdown:',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe('type', () => {
    it('should have type mapped_combo', () => {
      widget = new MappedComboWidget(
        createMockWidgetConfig({
          name: 'image',
          value: 'test',
          options: { values: ['test'] }
        }),
        node
      )

      expect(widget.type).toBe('mapped_combo')
    })
  })
})
