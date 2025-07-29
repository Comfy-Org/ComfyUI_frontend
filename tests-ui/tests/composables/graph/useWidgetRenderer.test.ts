import { describe, expect, it } from 'vitest'

import { WidgetType } from '@/components/graph/vueWidgets/widgetRegistry'
import { useWidgetRenderer } from '@/composables/graph/useWidgetRenderer'

describe('useWidgetRenderer', () => {
  const { getWidgetComponent, shouldRenderAsVue } = useWidgetRenderer()

  describe('getWidgetComponent', () => {
    // Test number type mappings
    describe('number types', () => {
      it('should map number type to NUMBER widget', () => {
        expect(getWidgetComponent('number')).toBe(WidgetType.NUMBER)
      })

      it('should map slider type to SLIDER widget', () => {
        expect(getWidgetComponent('slider')).toBe(WidgetType.SLIDER)
      })

      it('should map INT type to INT widget', () => {
        expect(getWidgetComponent('INT')).toBe(WidgetType.INT)
      })

      it('should map FLOAT type to FLOAT widget', () => {
        expect(getWidgetComponent('FLOAT')).toBe(WidgetType.FLOAT)
      })
    })

    // Test text type mappings
    describe('text types', () => {
      it('should map text variations to STRING widget', () => {
        expect(getWidgetComponent('text')).toBe(WidgetType.STRING)
        expect(getWidgetComponent('string')).toBe(WidgetType.STRING)
        expect(getWidgetComponent('STRING')).toBe(WidgetType.STRING)
      })

      it('should map multiline text types to TEXTAREA widget', () => {
        expect(getWidgetComponent('multiline')).toBe(WidgetType.TEXTAREA)
        expect(getWidgetComponent('textarea')).toBe(WidgetType.TEXTAREA)
        expect(getWidgetComponent('MARKDOWN')).toBe(WidgetType.MARKDOWN)
        expect(getWidgetComponent('customtext')).toBe(WidgetType.TEXTAREA)
      })
    })

    // Test selection type mappings
    describe('selection types', () => {
      it('should map combo types to COMBO widget', () => {
        expect(getWidgetComponent('combo')).toBe(WidgetType.COMBO)
        expect(getWidgetComponent('COMBO')).toBe(WidgetType.COMBO)
      })
    })

    // Test boolean type mappings
    describe('boolean types', () => {
      it('should map boolean types to appropriate widgets', () => {
        expect(getWidgetComponent('toggle')).toBe(WidgetType.TOGGLESWITCH)
        expect(getWidgetComponent('boolean')).toBe(WidgetType.BOOLEAN)
        expect(getWidgetComponent('BOOLEAN')).toBe(WidgetType.BOOLEAN)
      })
    })

    // Test advanced widget mappings
    describe('advanced widgets', () => {
      it('should map color types to COLOR widget', () => {
        expect(getWidgetComponent('color')).toBe(WidgetType.COLOR)
        expect(getWidgetComponent('COLOR')).toBe(WidgetType.COLOR)
      })

      it('should map image types to IMAGE widget', () => {
        expect(getWidgetComponent('image')).toBe(WidgetType.IMAGE)
        expect(getWidgetComponent('IMAGE')).toBe(WidgetType.IMAGE)
      })

      it('should map file types to FILEUPLOAD widget', () => {
        expect(getWidgetComponent('file')).toBe(WidgetType.FILEUPLOAD)
        expect(getWidgetComponent('FILEUPLOAD')).toBe(WidgetType.FILEUPLOAD)
      })

      it('should map button types to BUTTON widget', () => {
        expect(getWidgetComponent('button')).toBe(WidgetType.BUTTON)
        expect(getWidgetComponent('BUTTON')).toBe(WidgetType.BUTTON)
      })
    })

    // Test fallback behavior
    describe('fallback behavior', () => {
      it('should return STRING widget for unknown types', () => {
        expect(getWidgetComponent('unknown')).toBe(WidgetType.STRING)
        expect(getWidgetComponent('custom_widget')).toBe(WidgetType.STRING)
        expect(getWidgetComponent('')).toBe(WidgetType.STRING)
      })

      it('should return STRING widget for unmapped but valid types', () => {
        expect(getWidgetComponent('datetime')).toBe(WidgetType.STRING)
        expect(getWidgetComponent('json')).toBe(WidgetType.STRING)
      })
    })
  })

  describe('shouldRenderAsVue', () => {
    it('should return false for widgets marked as canvas-only', () => {
      const widget = { type: 'text', options: { canvasOnly: true } }
      expect(shouldRenderAsVue(widget)).toBe(false)
    })

    it('should return false for widgets without a type', () => {
      const widget = { options: {} }
      expect(shouldRenderAsVue(widget)).toBe(false)
    })

    it('should return true for widgets with mapped types', () => {
      expect(shouldRenderAsVue({ type: 'text' })).toBe(true)
      expect(shouldRenderAsVue({ type: 'number' })).toBe(true)
      expect(shouldRenderAsVue({ type: 'combo' })).toBe(true)
    })

    it('should return true even for unknown types (fallback to STRING)', () => {
      expect(shouldRenderAsVue({ type: 'unknown_type' })).toBe(true)
    })

    it('should respect options while checking type', () => {
      const widget = { type: 'text', options: { someOption: 'value' } }
      expect(shouldRenderAsVue(widget)).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle widgets with empty options', () => {
      const widget = { type: 'text', options: {} }
      expect(shouldRenderAsVue(widget)).toBe(true)
    })

    it('should handle case sensitivity correctly', () => {
      // Test that both lowercase and uppercase work
      expect(getWidgetComponent('string')).toBe(WidgetType.STRING)
      expect(getWidgetComponent('STRING')).toBe(WidgetType.STRING)
      expect(getWidgetComponent('combo')).toBe(WidgetType.COMBO)
      expect(getWidgetComponent('COMBO')).toBe(WidgetType.COMBO)
    })
  })
})
