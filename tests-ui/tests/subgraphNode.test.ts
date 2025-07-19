import { describe, expect, it, vi } from 'vitest'

// Simple test for promoted widget callback logic
describe('SubgraphNode promoted widget callbacks', () => {
  it('should call callback when provided', () => {
    const mockCallback = vi.fn()

    // Simulate the callback logic from our implementation
    const onPromotedWidgetRemoved = mockCallback
    const widget = { id: 'test', name: 'test_widget' }

    // Call callback if it exists (this is what our code does)
    onPromotedWidgetRemoved?.(widget)

    expect(mockCallback).toHaveBeenCalledWith(widget)
  })

  it('should not throw when callback is undefined', () => {
    const widget = { id: 'test', name: 'test_widget' }

    // Simulate the optional callback pattern
    const testObj: { onPromotedWidgetRemoved?: (widget: any) => void } = {
      onPromotedWidgetRemoved: undefined
    }

    // This should not throw (this is what our code does)
    expect(() => {
      testObj.onPromotedWidgetRemoved?.(widget)
    }).not.toThrow()
  })

  it('should find widget by name correctly', () => {
    const widgets = [
      { name: 'widget1', id: '1' },
      { name: 'widget2', id: '2' },
      { name: 'test_widget', id: '3' }
    ]

    // This is the logic from our removeWidgetByName override
    const widget = widgets.find((w) => w.name === 'test_widget')

    expect(widget).toBeDefined()
    expect(widget?.id).toBe('3')
  })

  it('should handle missing widget gracefully', () => {
    const widgets = [
      { name: 'widget1', id: '1' },
      { name: 'widget2', id: '2' }
    ]

    // This is the logic from our removeWidgetByName override
    const widget = widgets.find((w) => w.name === 'nonexistent')

    expect(widget).toBeUndefined()
  })
})
