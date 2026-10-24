import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import PaintBucketSettingsPanel from '@/renderer/extensions/maskEditor/components/PaintBucketSettingsPanel.vue'
import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'

let mockStore: ReturnType<typeof useMaskEditorStore>

vi.mock<unknown>(import('@/components/ui/slider/Slider.vue'), () => ({
  default: {
    name: 'SliderStub',
    props: ['modelValue', 'ariaLabelledby'],
    emits: ['update:modelValue'],
    template: `<button :aria-labelledby="ariaLabelledby" @click="$emit('update:modelValue', [50])">{{ modelValue?.[0] }}</button>`
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      maskEditor: {
        paintBucketSettings: 'Paint Bucket Settings',
        tolerance: 'Tolerance',
        fillOpacity: 'Fill Opacity'
      }
    }
  }
})

const renderPanel = () =>
  render(PaintBucketSettingsPanel, { global: { plugins: [i18n] } })

const spinbutton = (name: string): HTMLInputElement =>
  screen.getByRole('spinbutton', { name })

describe('PaintBucketSettingsPanel', () => {
  beforeEach(() => {
    mockStore = useMaskEditorStore()
    mockStore.$patch({ paintBucketTolerance: 5, fillOpacity: 100 })
  })

  it('should show the stored tolerance as a percent', () => {
    mockStore.paintBucketTolerance = 255
    renderPanel()

    expect(spinbutton('Tolerance').value).toBe('100')
  })

  it('should bind the fill opacity field to the store value', () => {
    mockStore.fillOpacity = 33
    renderPanel()

    expect(spinbutton('Fill Opacity').value).toBe('33')
  })

  it('should convert a tolerance percent back to the 0-255 channel value', () => {
    renderPanel()
    const input = spinbutton('Tolerance')

    input.value = '50'
    input.dispatchEvent(new Event('input', { bubbles: true }))

    expect(mockStore.setPaintBucketTolerance).toHaveBeenCalledWith(128)
  })

  it('should call setFillOpacity when the fill opacity changes', () => {
    renderPanel()
    const input = spinbutton('Fill Opacity')

    input.value = '42'
    input.dispatchEvent(new Event('input', { bubbles: true }))

    expect(mockStore.setFillOpacity).toHaveBeenCalledWith(42)
  })

  it('should ignore a cleared fill opacity field', () => {
    renderPanel()
    const input = spinbutton('Fill Opacity')

    input.value = ''
    input.dispatchEvent(new Event('input', { bubbles: true }))

    expect(mockStore.setFillOpacity).not.toHaveBeenCalled()
  })
})
