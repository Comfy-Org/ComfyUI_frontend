import { describe, expect, it, vi } from 'vitest'

import WidgetAudioUI from '@/renderer/extensions/vueNodes/widgets/components/WidgetAudioUI.vue'
import WidgetButton from '@/renderer/extensions/vueNodes/widgets/components/WidgetButton.vue'
import WidgetColorPicker from '@/renderer/extensions/vueNodes/widgets/components/WidgetColorPicker.vue'
import WidgetFileUpload from '@/renderer/extensions/vueNodes/widgets/components/WidgetFileUpload.vue'
import WidgetInputNumber from '@/renderer/extensions/vueNodes/widgets/components/WidgetInputNumber.vue'
import WidgetInputText from '@/renderer/extensions/vueNodes/widgets/components/WidgetInputText.vue'
import WidgetMarkdown from '@/renderer/extensions/vueNodes/widgets/components/WidgetMarkdown.vue'
import WidgetSelect from '@/renderer/extensions/vueNodes/widgets/components/WidgetSelect.vue'
import WidgetTextarea from '@/renderer/extensions/vueNodes/widgets/components/WidgetTextarea.vue'
import WidgetToggleSwitch from '@/renderer/extensions/vueNodes/widgets/components/WidgetToggleSwitch.vue'
import {
  getComponent,
  isEssential,
  shouldRenderAsVue
} from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'

vi.mock('@/stores/queueStore', () => ({
  useQueueStore: vi.fn(() => ({
    historyTasks: []
  }))
}))

describe('widgetRegistry', () => {
  describe('getComponent', () => {
    // Test number type mappings
    describe('number types', () => {
      it('should map int types to slider widget', () => {
        expect(getComponent('int', 'bar')).toBe(WidgetInputNumber)
        expect(getComponent('INT', 'bar')).toBe(WidgetInputNumber)
      })

      it('should map float types to slider widget', () => {
        expect(getComponent('float', 'cfg')).toBe(WidgetInputNumber)
        expect(getComponent('FLOAT', 'cfg')).toBe(WidgetInputNumber)
        expect(getComponent('number', 'cfg')).toBe(WidgetInputNumber)
        expect(getComponent('slider', 'cfg')).toBe(WidgetInputNumber)
      })
    })

    // Test text type mappings
    describe('text types', () => {
      it('should map text variations to input text widget', () => {
        expect(getComponent('text', 'text')).toBe(WidgetInputText)
        expect(getComponent('string', 'text')).toBe(WidgetInputText)
        expect(getComponent('STRING', 'text')).toBe(WidgetInputText)
      })

      it('should map multiline text types to textarea widget', () => {
        expect(getComponent('multiline', 'text')).toBe(WidgetTextarea)
        expect(getComponent('textarea', 'text')).toBe(WidgetTextarea)
        expect(getComponent('TEXTAREA', 'text')).toBe(WidgetTextarea)
        expect(getComponent('customtext', 'text')).toBe(WidgetTextarea)
      })

      it('should map markdown to markdown widget', () => {
        expect(getComponent('MARKDOWN', 'text')).toBe(WidgetMarkdown)
        expect(getComponent('markdown', 'text')).toBe(WidgetMarkdown)
      })
    })

    // Test selection type mappings
    describe('selection types', () => {
      it('should map combo types to select widget', () => {
        expect(getComponent('combo', 'image')).toBe(WidgetSelect)
        expect(getComponent('COMBO', 'video')).toBe(WidgetSelect)
      })
    })

    // Test boolean type mappings
    describe('boolean types', () => {
      it('should map boolean types to toggle switch widget', () => {
        expect(getComponent('toggle', 'image')).toBe(WidgetToggleSwitch)
        expect(getComponent('boolean', 'image')).toBe(WidgetToggleSwitch)
        expect(getComponent('BOOLEAN', 'image')).toBe(WidgetToggleSwitch)
      })
    })

    // Test advanced widget mappings
    describe('advanced widgets', () => {
      it('should map color types to color picker widget', () => {
        expect(getComponent('color', 'color')).toBe(WidgetColorPicker)
        expect(getComponent('COLOR', 'color')).toBe(WidgetColorPicker)
      })

      it('should map file types to file upload widget', () => {
        expect(getComponent('file', 'file')).toBe(WidgetFileUpload)
        expect(getComponent('fileupload', 'file')).toBe(WidgetFileUpload)
        expect(getComponent('FILEUPLOAD', 'file')).toBe(WidgetFileUpload)
      })

      it('should map button types to button widget', () => {
        expect(getComponent('button', '')).toBe(WidgetButton)
        expect(getComponent('BUTTON', '')).toBe(WidgetButton)
      })
    })

    // Test fallback behavior
    describe('fallback behavior', () => {
      it('should return null for unknown types', () => {
        expect(getComponent('unknown', 'unknown')).toBe(null)
        expect(getComponent('custom_widget', 'custom_widget')).toBe(null)
        expect(getComponent('', '')).toBe(null)
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
      expect(shouldRenderAsVue({ type: 'int' })).toBe(true)
      expect(shouldRenderAsVue({ type: 'combo' })).toBe(true)
    })

    it('should respect options while checking type', () => {
      const widget = { type: 'text', options: { someOption: 'value' } }
      expect(shouldRenderAsVue(widget)).toBe(true)
    })
  })

  describe('isEssential', () => {
    it('should identify essential widget types', () => {
      expect(isEssential('int')).toBe(true)
      expect(isEssential('INT')).toBe(true)
      expect(isEssential('float')).toBe(true)
      expect(isEssential('FLOAT')).toBe(true)
      expect(isEssential('boolean')).toBe(true)
      expect(isEssential('BOOLEAN')).toBe(true)
      expect(isEssential('combo')).toBe(true)
      expect(isEssential('COMBO')).toBe(true)
    })

    it('should identify non-essential widget types', () => {
      expect(isEssential('button')).toBe(false)
      expect(isEssential('color')).toBe(false)
      expect(isEssential('chart')).toBe(false)
      expect(isEssential('fileupload')).toBe(false)
    })

    it('should return false for unknown types', () => {
      expect(isEssential('unknown')).toBe(false)
      expect(isEssential('')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle widgets with empty options', () => {
      const widget = { type: 'text', options: {} }
      expect(shouldRenderAsVue(widget)).toBe(true)
    })

    it('should handle case sensitivity correctly through aliases', () => {
      // Test that both lowercase and uppercase work
      expect(getComponent('string', '')).toBe(WidgetInputText)
      expect(getComponent('STRING', '')).toBe(WidgetInputText)
      expect(getComponent('combo', '')).toBe(WidgetSelect)
      expect(getComponent('COMBO', '')).toBe(WidgetSelect)
    })

    it('should handle combo additional widgets', () => {
      // Test that both lowercase and uppercase work
      expect(getComponent('combo', 'audio')).toBe(WidgetAudioUI)
      expect(getComponent('combo', 'image')).toBe(WidgetSelect)
    })
  })
})
