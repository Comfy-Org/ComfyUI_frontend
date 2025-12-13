import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NumberControlRegistry } from '@/renderer/extensions/vueNodes/widgets/services/NumberControlRegistry'

// Mock the settings store
const mockGetSetting = vi.fn()
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: mockGetSetting
  })
}))

describe('NumberControlRegistry', () => {
  let registry: NumberControlRegistry

  beforeEach(() => {
    registry = new NumberControlRegistry()
    vi.clearAllMocks()
  })

  describe('register and unregister', () => {
    it('should register a control callback', () => {
      const controlId = Symbol('test-control')
      const mockCallback = vi.fn()

      registry.register(controlId, mockCallback)

      expect(registry.getControlCount()).toBe(1)
    })

    it('should unregister a control callback', () => {
      const controlId = Symbol('test-control')
      const mockCallback = vi.fn()

      registry.register(controlId, mockCallback)
      expect(registry.getControlCount()).toBe(1)

      registry.unregister(controlId)
      expect(registry.getControlCount()).toBe(0)
    })

    it('should handle multiple registrations', () => {
      const control1 = Symbol('control1')
      const control2 = Symbol('control2')
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      registry.register(control1, callback1)
      registry.register(control2, callback2)

      expect(registry.getControlCount()).toBe(2)

      registry.unregister(control1)
      expect(registry.getControlCount()).toBe(1)
    })

    it('should handle unregistering non-existent controls gracefully', () => {
      const nonExistentId = Symbol('non-existent')

      expect(() => registry.unregister(nonExistentId)).not.toThrow()
      expect(registry.getControlCount()).toBe(0)
    })
  })

  describe('executeControls', () => {
    it('should execute controls when mode matches phase', () => {
      const controlId = Symbol('test-control')
      const mockCallback = vi.fn()

      // Mock setting store to return 'before'
      mockGetSetting.mockReturnValue('before')

      registry.register(controlId, mockCallback)
      registry.executeControls('before')

      expect(mockCallback).toHaveBeenCalledTimes(1)
      expect(mockGetSetting).toHaveBeenCalledWith('Comfy.WidgetControlMode')
    })

    it('should not execute controls when mode does not match phase', () => {
      const controlId = Symbol('test-control')
      const mockCallback = vi.fn()

      // Mock setting store to return 'after'
      mockGetSetting.mockReturnValue('after')

      registry.register(controlId, mockCallback)
      registry.executeControls('before')

      expect(mockCallback).not.toHaveBeenCalled()
    })

    it('should execute all registered controls when mode matches', () => {
      const control1 = Symbol('control1')
      const control2 = Symbol('control2')
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      mockGetSetting.mockReturnValue('before')

      registry.register(control1, callback1)
      registry.register(control2, callback2)
      registry.executeControls('before')

      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
    })

    it('should handle empty registry gracefully', () => {
      mockGetSetting.mockReturnValue('before')

      expect(() => registry.executeControls('before')).not.toThrow()
      expect(mockGetSetting).toHaveBeenCalledWith('Comfy.WidgetControlMode')
    })

    it('should work with both before and after phases', () => {
      const controlId = Symbol('test-control')
      const mockCallback = vi.fn()

      registry.register(controlId, mockCallback)

      // Test 'before' phase
      mockGetSetting.mockReturnValue('before')
      registry.executeControls('before')
      expect(mockCallback).toHaveBeenCalledTimes(1)

      // Test 'after' phase
      mockGetSetting.mockReturnValue('after')
      registry.executeControls('after')
      expect(mockCallback).toHaveBeenCalledTimes(2)
    })
  })

  describe('utility methods', () => {
    it('should return correct control count', () => {
      expect(registry.getControlCount()).toBe(0)

      const control1 = Symbol('control1')
      const control2 = Symbol('control2')

      registry.register(control1, vi.fn())
      expect(registry.getControlCount()).toBe(1)

      registry.register(control2, vi.fn())
      expect(registry.getControlCount()).toBe(2)

      registry.unregister(control1)
      expect(registry.getControlCount()).toBe(1)
    })

    it('should clear all controls', () => {
      const control1 = Symbol('control1')
      const control2 = Symbol('control2')

      registry.register(control1, vi.fn())
      registry.register(control2, vi.fn())
      expect(registry.getControlCount()).toBe(2)

      registry.clear()
      expect(registry.getControlCount()).toBe(0)
    })
  })
})
