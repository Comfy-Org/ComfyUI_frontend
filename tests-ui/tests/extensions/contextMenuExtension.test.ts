import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { IContextMenuValue } from '@/lib/litegraph/src/interfaces'
import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import type { ComfyExtension } from '@/types/comfy'

describe('Context Menu Extension API', () => {
  let mockCanvas: LGraphCanvas
  let mockNode: LGraphNode

  beforeEach(() => {
    // Create mock canvas
    mockCanvas = {
      graph_mouse: [100, 100],
      selectedItems: new Set()
    } as unknown as LGraphCanvas

    // Create mock node
    mockNode = {
      id: 1,
      type: 'TestNode',
      pos: [0, 0]
    } as unknown as LGraphNode

    // Clear console
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('collectCanvasMenuItems', () => {
    it('should collect items from extensions with getCanvasMenuItems', () => {
      const mockExtension1: ComfyExtension = {
        name: 'Test Extension 1',
        getCanvasMenuItems: (_canvas: LGraphCanvas) => {
          return [
            { content: 'Extension 1 Item', callback: () => {} }
          ] as IContextMenuValue[]
        }
      }

      const mockExtension2: ComfyExtension = {
        name: 'Test Extension 2',
        getCanvasMenuItems: (_canvas: LGraphCanvas) => {
          return [
            { content: 'Extension 2 Item', callback: () => {} }
          ] as IContextMenuValue[]
        }
      }

      // Mock extensions array
      vi.spyOn(app, 'extensions', 'get').mockReturnValue([
        mockExtension1,
        mockExtension2
      ])

      const items = app.collectCanvasMenuItems(mockCanvas)

      expect(items).toHaveLength(2)
      expect(items[0]).toMatchObject({ content: 'Extension 1 Item' })
      expect(items[1]).toMatchObject({ content: 'Extension 2 Item' })
    })

    it('should skip extensions without getCanvasMenuItems', () => {
      const mockExtension1: ComfyExtension = {
        name: 'Test Extension 1',
        getCanvasMenuItems: () => {
          return [{ content: 'Item 1', callback: () => {} }]
        }
      }

      const mockExtension2: ComfyExtension = {
        name: 'Test Extension 2'
        // No getCanvasMenuItems
      }

      vi.spyOn(app, 'extensions', 'get').mockReturnValue([
        mockExtension1,
        mockExtension2
      ])

      const items = app.collectCanvasMenuItems(mockCanvas)

      expect(items).toHaveLength(1)
      expect(items[0]).toMatchObject({ content: 'Item 1' })
    })

    it('should handle errors in extension gracefully', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const mockExtension1: ComfyExtension = {
        name: 'Failing Extension',
        getCanvasMenuItems: () => {
          throw new Error('Extension error')
        }
      }

      const mockExtension2: ComfyExtension = {
        name: 'Working Extension',
        getCanvasMenuItems: () => {
          return [{ content: 'Working Item', callback: () => {} }]
        }
      }

      vi.spyOn(app, 'extensions', 'get').mockReturnValue([
        mockExtension1,
        mockExtension2
      ])

      const items = app.collectCanvasMenuItems(mockCanvas)

      // Should have logged error with extension name
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Context Menu]'),
        expect.any(Error)
      )
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('"Failing Extension"'),
        expect.any(Error)
      )

      // Should still return items from working extension
      expect(items).toHaveLength(1)
      expect(items[0]).toMatchObject({ content: 'Working Item' })
    })

    it('should pass canvas to extension method', () => {
      const canvasCapture = vi.fn()

      const mockExtension: ComfyExtension = {
        name: 'Test Extension',
        getCanvasMenuItems: (canvas: LGraphCanvas) => {
          canvasCapture(canvas)
          return []
        }
      }

      vi.spyOn(app, 'extensions', 'get').mockReturnValue([mockExtension])

      app.collectCanvasMenuItems(mockCanvas)

      expect(canvasCapture).toHaveBeenCalledWith(mockCanvas)
    })

    it('should return empty array when no extensions', () => {
      vi.spyOn(app, 'extensions', 'get').mockReturnValue([])

      const items = app.collectCanvasMenuItems(mockCanvas)

      expect(items).toHaveLength(0)
    })
  })

  describe('collectNodeMenuItems', () => {
    it('should collect items from extensions with getNodeMenuItems', () => {
      const mockExtension1: ComfyExtension = {
        name: 'Test Extension 1',
        getNodeMenuItems: (_node: LGraphNode) => {
          return [
            { content: 'Node Item 1', callback: () => {} }
          ] as IContextMenuValue[]
        }
      }

      const mockExtension2: ComfyExtension = {
        name: 'Test Extension 2',
        getNodeMenuItems: (_node: LGraphNode) => {
          return [
            { content: 'Node Item 2', callback: () => {} }
          ] as IContextMenuValue[]
        }
      }

      vi.spyOn(app, 'extensions', 'get').mockReturnValue([
        mockExtension1,
        mockExtension2
      ])

      const items = app.collectNodeMenuItems(mockNode)

      expect(items).toHaveLength(2)
      expect(items[0]).toMatchObject({ content: 'Node Item 1' })
      expect(items[1]).toMatchObject({ content: 'Node Item 2' })
    })

    it('should skip extensions without getNodeMenuItems', () => {
      const mockExtension1: ComfyExtension = {
        name: 'Test Extension 1',
        getNodeMenuItems: () => {
          return [{ content: 'Node Item', callback: () => {} }]
        }
      }

      const mockExtension2: ComfyExtension = {
        name: 'Test Extension 2'
        // No getNodeMenuItems
      }

      vi.spyOn(app, 'extensions', 'get').mockReturnValue([
        mockExtension1,
        mockExtension2
      ])

      const items = app.collectNodeMenuItems(mockNode)

      expect(items).toHaveLength(1)
      expect(items[0]).toMatchObject({ content: 'Node Item' })
    })

    it('should handle errors in extension gracefully', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const mockExtension1: ComfyExtension = {
        name: 'Failing Extension',
        getNodeMenuItems: () => {
          throw new Error('Extension error')
        }
      }

      const mockExtension2: ComfyExtension = {
        name: 'Working Extension',
        getNodeMenuItems: () => {
          return [{ content: 'Working Node Item', callback: () => {} }]
        }
      }

      vi.spyOn(app, 'extensions', 'get').mockReturnValue([
        mockExtension1,
        mockExtension2
      ])

      const items = app.collectNodeMenuItems(mockNode)

      // Should have logged error with extension name
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Context Menu]'),
        expect.any(Error)
      )
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('"Failing Extension"'),
        expect.any(Error)
      )

      // Should still return items from working extension
      expect(items).toHaveLength(1)
      expect(items[0]).toMatchObject({ content: 'Working Node Item' })
    })

    it('should pass node to extension method', () => {
      const nodeCapture = vi.fn()

      const mockExtension: ComfyExtension = {
        name: 'Test Extension',
        getNodeMenuItems: (node: LGraphNode) => {
          nodeCapture(node)
          return []
        }
      }

      vi.spyOn(app, 'extensions', 'get').mockReturnValue([mockExtension])

      app.collectNodeMenuItems(mockNode)

      expect(nodeCapture).toHaveBeenCalledWith(mockNode)
    })

    it('should return empty array when no extensions', () => {
      vi.spyOn(app, 'extensions', 'get').mockReturnValue([])

      const items = app.collectNodeMenuItems(mockNode)

      expect(items).toHaveLength(0)
    })
  })

  describe('integration with both methods', () => {
    it('should work when extension provides both methods', () => {
      const mockExtension: ComfyExtension = {
        name: 'Full Extension',
        getCanvasMenuItems: () => {
          return [{ content: 'Canvas Item', callback: () => {} }]
        },
        getNodeMenuItems: () => {
          return [{ content: 'Node Item', callback: () => {} }]
        }
      }

      vi.spyOn(app, 'extensions', 'get').mockReturnValue([mockExtension])

      const canvasItems = app.collectCanvasMenuItems(mockCanvas)
      const nodeItems = app.collectNodeMenuItems(mockNode)

      expect(canvasItems).toHaveLength(1)
      expect(canvasItems[0]).toMatchObject({ content: 'Canvas Item' })

      expect(nodeItems).toHaveLength(1)
      expect(nodeItems[0]).toMatchObject({ content: 'Node Item' })
    })
  })
})
