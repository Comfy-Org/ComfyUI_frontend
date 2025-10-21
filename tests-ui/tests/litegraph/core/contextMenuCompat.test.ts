import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { legacyMenuCompat } from '@/lib/litegraph/src/contextMenuCompat'
import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

describe('contextMenuCompat', () => {
  let originalGetCanvasMenuOptions: typeof LGraphCanvas.prototype.getCanvasMenuOptions
  let mockCanvas: LGraphCanvas

  beforeEach(() => {
    // Save original method
    originalGetCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions

    // Create mock canvas
    mockCanvas = {
      constructor: {
        prototype: LGraphCanvas.prototype
      }
    } as unknown as LGraphCanvas

    // Clear console warnings
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore original method
    LGraphCanvas.prototype.getCanvasMenuOptions = originalGetCanvasMenuOptions
    vi.restoreAllMocks()
  })

  describe('install', () => {
    it('should install compatibility layer on prototype', () => {
      const methodName = 'getCanvasMenuOptions'

      // Install compatibility layer
      legacyMenuCompat.install(LGraphCanvas.prototype, methodName)

      // The method should still be callable
      expect(typeof LGraphCanvas.prototype.getCanvasMenuOptions).toBe(
        'function'
      )
    })

    it('should detect monkey patches and warn', () => {
      const methodName = 'getCanvasMenuOptions'
      const warnSpy = vi.spyOn(console, 'warn')

      // Install compatibility layer
      legacyMenuCompat.install(LGraphCanvas.prototype, methodName)

      // Set current extension before monkey-patching
      legacyMenuCompat.setCurrentExtension('Test Extension')

      // Simulate extension monkey-patching
      const original = LGraphCanvas.prototype.getCanvasMenuOptions
      LGraphCanvas.prototype.getCanvasMenuOptions = function (...args: any[]) {
        const items = (original as any).apply(this, args)
        items.push({ content: 'Custom Item', callback: () => {} })
        return items
      }

      // Should have logged a warning with extension name
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEPRECATED]'),
        expect.any(String),
        expect.any(String)
      )
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('"Test Extension"'),
        expect.any(String),
        expect.any(String)
      )

      // Clear extension
      legacyMenuCompat.setCurrentExtension(null)
    })

    it('should only warn once per unique function', () => {
      const methodName = 'getCanvasMenuOptions'
      const warnSpy = vi.spyOn(console, 'warn')

      legacyMenuCompat.install(LGraphCanvas.prototype, methodName)
      legacyMenuCompat.setCurrentExtension('test.extension')

      const patchFunction = function (this: LGraphCanvas, ...args: any[]) {
        const items = (originalGetCanvasMenuOptions as any).apply(this, args)
        items.push({ content: 'Custom', callback: () => {} })
        return items
      }

      // Patch twice with same function
      LGraphCanvas.prototype.getCanvasMenuOptions = patchFunction
      LGraphCanvas.prototype.getCanvasMenuOptions = patchFunction

      // Should only warn once
      expect(warnSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('extractLegacyItems', () => {
    beforeEach(() => {
      // Setup a mock original method
      LGraphCanvas.prototype.getCanvasMenuOptions = function () {
        return [
          { content: 'Item 1', callback: () => {} },
          { content: 'Item 2', callback: () => {} }
        ]
      }

      // Install compatibility layer
      legacyMenuCompat.install(LGraphCanvas.prototype, 'getCanvasMenuOptions')
    })

    it('should extract items added by monkey patches', () => {
      // Monkey-patch to add items
      const original = LGraphCanvas.prototype.getCanvasMenuOptions
      LGraphCanvas.prototype.getCanvasMenuOptions = function (...args: any[]) {
        const items = (original as any).apply(this, args)
        items.push({ content: 'Custom Item 1', callback: () => {} })
        items.push({ content: 'Custom Item 2', callback: () => {} })
        return items
      }

      // Extract legacy items
      const legacyItems = legacyMenuCompat.extractLegacyItems(
        'getCanvasMenuOptions',
        mockCanvas
      )

      expect(legacyItems).toHaveLength(2)
      expect(legacyItems[0]).toMatchObject({ content: 'Custom Item 1' })
      expect(legacyItems[1]).toMatchObject({ content: 'Custom Item 2' })
    })

    it('should return empty array when no items added', () => {
      // No monkey-patching, so no extra items
      const legacyItems = legacyMenuCompat.extractLegacyItems(
        'getCanvasMenuOptions',
        mockCanvas
      )

      expect(legacyItems).toHaveLength(0)
    })

    it('should return empty array when patched method returns same count', () => {
      // Monkey-patch that replaces items but keeps same count
      LGraphCanvas.prototype.getCanvasMenuOptions = function () {
        return [
          { content: 'Replaced 1', callback: () => {} },
          { content: 'Replaced 2', callback: () => {} }
        ]
      }

      const legacyItems = legacyMenuCompat.extractLegacyItems(
        'getCanvasMenuOptions',
        mockCanvas
      )

      expect(legacyItems).toHaveLength(0)
    })

    it('should handle errors gracefully', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Monkey-patch that throws error
      LGraphCanvas.prototype.getCanvasMenuOptions = function () {
        throw new Error('Test error')
      }

      const legacyItems = legacyMenuCompat.extractLegacyItems(
        'getCanvasMenuOptions',
        mockCanvas
      )

      expect(legacyItems).toHaveLength(0)
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to extract legacy items'),
        expect.any(Error)
      )
    })
  })

  describe('integration', () => {
    it('should work with multiple extensions patching', () => {
      // Setup base method
      LGraphCanvas.prototype.getCanvasMenuOptions = function () {
        return [{ content: 'Base Item', callback: () => {} }]
      }

      legacyMenuCompat.install(LGraphCanvas.prototype, 'getCanvasMenuOptions')

      // First extension patches
      const original1 = LGraphCanvas.prototype.getCanvasMenuOptions
      LGraphCanvas.prototype.getCanvasMenuOptions = function (...args: any[]) {
        const items = (original1 as any).apply(this, args)
        items.push({ content: 'Extension 1 Item', callback: () => {} })
        return items
      }

      // Second extension patches
      const original2 = LGraphCanvas.prototype.getCanvasMenuOptions
      LGraphCanvas.prototype.getCanvasMenuOptions = function (...args: any[]) {
        const items = (original2 as any).apply(this, args)
        items.push({ content: 'Extension 2 Item', callback: () => {} })
        return items
      }

      // Extract legacy items
      const legacyItems = legacyMenuCompat.extractLegacyItems(
        'getCanvasMenuOptions',
        mockCanvas
      )

      // Should extract both items added by extensions
      expect(legacyItems).toHaveLength(2)
      expect(legacyItems[0]).toMatchObject({ content: 'Extension 1 Item' })
      expect(legacyItems[1]).toMatchObject({ content: 'Extension 2 Item' })
    })

    it('should extract legacy items only once even when called multiple times', () => {
      // Setup base method
      LGraphCanvas.prototype.getCanvasMenuOptions = function () {
        return [
          { content: 'Base Item 1', callback: () => {} },
          { content: 'Base Item 2', callback: () => {} }
        ]
      }

      legacyMenuCompat.install(LGraphCanvas.prototype, 'getCanvasMenuOptions')

      // Simulate legacy extension monkey-patching the prototype
      const original = LGraphCanvas.prototype.getCanvasMenuOptions
      LGraphCanvas.prototype.getCanvasMenuOptions = function (...args: any[]) {
        const items = (original as any).apply(this, args)
        items.push({ content: 'Legacy Item 1', callback: () => {} })
        items.push({ content: 'Legacy Item 2', callback: () => {} })
        return items
      }

      // Extract legacy items multiple times (simulating repeated menu opens)
      const legacyItems1 = legacyMenuCompat.extractLegacyItems(
        'getCanvasMenuOptions',
        mockCanvas
      )
      const legacyItems2 = legacyMenuCompat.extractLegacyItems(
        'getCanvasMenuOptions',
        mockCanvas
      )
      const legacyItems3 = legacyMenuCompat.extractLegacyItems(
        'getCanvasMenuOptions',
        mockCanvas
      )

      // Each extraction should return the same items (no accumulation)
      expect(legacyItems1).toHaveLength(2)
      expect(legacyItems2).toHaveLength(2)
      expect(legacyItems3).toHaveLength(2)

      // Verify items are the expected ones
      expect(legacyItems1[0]).toMatchObject({ content: 'Legacy Item 1' })
      expect(legacyItems1[1]).toMatchObject({ content: 'Legacy Item 2' })

      expect(legacyItems2[0]).toMatchObject({ content: 'Legacy Item 1' })
      expect(legacyItems2[1]).toMatchObject({ content: 'Legacy Item 2' })

      expect(legacyItems3[0]).toMatchObject({ content: 'Legacy Item 1' })
      expect(legacyItems3[1]).toMatchObject({ content: 'Legacy Item 2' })
    })

    it('should not extract items from registered wrapper methods', () => {
      // Setup base method
      LGraphCanvas.prototype.getCanvasMenuOptions = function () {
        return [{ content: 'Base Item', callback: () => {} }]
      }

      legacyMenuCompat.install(LGraphCanvas.prototype, 'getCanvasMenuOptions')

      // Create a wrapper that adds new API items (simulating useContextMenuTranslation)
      const originalMethod = LGraphCanvas.prototype.getCanvasMenuOptions
      const wrapperMethod = function (this: LGraphCanvas) {
        const items = (originalMethod as any).apply(this, [])
        // Add new API items
        items.push({ content: 'New API Item 1', callback: () => {} })
        items.push({ content: 'New API Item 2', callback: () => {} })
        return items
      }

      // Set the wrapper as the current method
      LGraphCanvas.prototype.getCanvasMenuOptions = wrapperMethod

      // Register the wrapper so it's not treated as a legacy patch
      legacyMenuCompat.registerWrapper(
        'getCanvasMenuOptions',
        wrapperMethod,
        originalMethod,
        LGraphCanvas.prototype // Wrapper is installed
      )

      // Extract legacy items - should return empty because current method is a registered wrapper
      const legacyItems = legacyMenuCompat.extractLegacyItems(
        'getCanvasMenuOptions',
        mockCanvas
      )

      expect(legacyItems).toHaveLength(0)
    })

    it('should extract legacy items even when a wrapper is registered but not active', () => {
      // Setup base method
      LGraphCanvas.prototype.getCanvasMenuOptions = function () {
        return [{ content: 'Base Item', callback: () => {} }]
      }

      legacyMenuCompat.install(LGraphCanvas.prototype, 'getCanvasMenuOptions')

      // Register a wrapper (but don't set it as the current method)
      const originalMethod = LGraphCanvas.prototype.getCanvasMenuOptions
      const wrapperMethod = function () {
        return [{ content: 'Wrapper Item', callback: () => {} }]
      }
      legacyMenuCompat.registerWrapper(
        'getCanvasMenuOptions',
        wrapperMethod,
        originalMethod
        // NOT passing prototype, so it won't be marked as installed
      )

      // Monkey-patch with a different function (legacy extension)
      const original = LGraphCanvas.prototype.getCanvasMenuOptions
      LGraphCanvas.prototype.getCanvasMenuOptions = function (...args: any[]) {
        const items = (original as any).apply(this, args)
        items.push({ content: 'Legacy Item', callback: () => {} })
        return items
      }

      // Extract legacy items - should return the legacy item because current method is NOT the wrapper
      const legacyItems = legacyMenuCompat.extractLegacyItems(
        'getCanvasMenuOptions',
        mockCanvas
      )

      expect(legacyItems).toHaveLength(1)
      expect(legacyItems[0]).toMatchObject({ content: 'Legacy Item' })
    })
  })
})
