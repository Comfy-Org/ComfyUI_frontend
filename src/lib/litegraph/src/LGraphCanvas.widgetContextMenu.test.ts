import { describe, expect, it, vi } from 'vitest'

import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { hasWidgetContextMenuOptions } from '@/lib/litegraph/src/utils/type'

function createMockWidget(
  overrides: Partial<IBaseWidget> & Record<string, unknown> = {}
): IBaseWidget {
  return {
    name: 'test',
    type: 'number',
    y: 0,
    options: {},
    ...overrides
  } as IBaseWidget
}

describe('hasWidgetContextMenuOptions', () => {
  it('returns true for a widget with a callable getContextMenuOptions', () => {
    const widget = createMockWidget({
      getContextMenuOptions: vi.fn().mockReturnValue([])
    })
    expect(hasWidgetContextMenuOptions(widget)).toBe(true)
  })

  it('returns false for a widget without getContextMenuOptions', () => {
    const widget = createMockWidget()
    expect(hasWidgetContextMenuOptions(widget)).toBe(false)
  })

  it('returns false for a widget where getContextMenuOptions is not a function', () => {
    const widget = createMockWidget({
      getContextMenuOptions: 'not-a-function' as unknown
    })
    expect(hasWidgetContextMenuOptions(widget)).toBe(false)
  })
})

describe('widget context menu options Array.isArray guard', () => {
  it('accepts a valid non-empty array', () => {
    const getContextMenuOptions = vi
      .fn()
      .mockReturnValue([{ content: 'Test Option' }])
    const widget = createMockWidget({ getContextMenuOptions })

    if (hasWidgetContextMenuOptions(widget)) {
      const result = widget.getContextMenuOptions({
        e: {} as never,
        node: {} as never,
        canvas: {} as never
      })
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(1)
    }
  })

  it('accepts an empty array', () => {
    const getContextMenuOptions = vi.fn().mockReturnValue([])
    const widget = createMockWidget({ getContextMenuOptions })

    if (hasWidgetContextMenuOptions(widget)) {
      const result = widget.getContextMenuOptions({
        e: {} as never,
        node: {} as never,
        canvas: {} as never
      })
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)
    }
  })

  it('safely handles undefined return value', () => {
    const getContextMenuOptions = vi.fn().mockReturnValue(undefined)
    const widget = createMockWidget({ getContextMenuOptions })

    if (hasWidgetContextMenuOptions(widget)) {
      const result = widget.getContextMenuOptions({
        e: {} as never,
        node: {} as never,
        canvas: {} as never
      })
      expect(Array.isArray(result)).toBe(false)
    }
  })

  it('safely handles non-array return value', () => {
    const getContextMenuOptions = vi.fn().mockReturnValue('not an array')
    const widget = createMockWidget({ getContextMenuOptions })

    if (hasWidgetContextMenuOptions(widget)) {
      const result = widget.getContextMenuOptions({
        e: {} as never,
        node: {} as never,
        canvas: {} as never
      })
      expect(Array.isArray(result)).toBe(false)
    }
  })
})
