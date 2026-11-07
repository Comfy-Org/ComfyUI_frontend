import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ColorSelectSettingsPanel from '@/renderer/extensions/maskEditor/components/ColorSelectSettingsPanel.vue'
import { ColorComparisonMethod } from '@comfyorg/mask-editor/types'
import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'

let mockStore: ReturnType<typeof useMaskEditorStore>

vi.mock<unknown>(import('@comfyorg/design-system/slider/Slider'), () => ({
  default: {
    name: 'SliderStub',
    props: ['modelValue', 'ariaLabelledby'],
    emits: ['update:modelValue'],
    template: `<button data-slider="true" :aria-labelledby="ariaLabelledby" @click="$emit('update:modelValue', [40])">{{ modelValue?.[0] }}</button>`
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      maskEditor: {
        colorSelectSettings: 'Color Select Settings',
        tolerance: 'Tolerance',
        selectionOpacity: 'Selection Opacity',
        livePreview: 'Live Preview',
        applyToWholeImage: 'Apply to Whole Image',
        method: 'Method',
        methodSimple: 'Simple',
        methodHsl: 'HSL',
        methodLab: 'LAB',
        stopAtMask: 'Stop at mask',
        maskTolerance: 'Mask Tolerance'
      }
    }
  }
})

const renderPanel = () =>
  render(ColorSelectSettingsPanel, { global: { plugins: [i18n] } })

const setNumberInput = (name: string, value: string): void => {
  const input = screen.getByRole<HTMLInputElement>('spinbutton', { name })
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('ColorSelectSettingsPanel', () => {
  beforeEach(() => {
    mockStore = useMaskEditorStore()
    mockStore.$patch({
      colorSelectTolerance: 20,
      selectionOpacity: 100,
      colorSelectLivePreview: false,
      applyWholeImage: false,
      colorComparisonMethod: ColorComparisonMethod.Simple,
      maskBoundary: false,
      maskTolerance: 0
    })
  })

  it('should convert a tolerance percent back to the 0-255 channel value', () => {
    renderPanel()

    setNumberInput('Tolerance', '40')

    expect(mockStore.setColorSelectTolerance).toHaveBeenCalledWith(102)
  })

  it('should show the stored tolerance as a percent', () => {
    mockStore.colorSelectTolerance = 255
    renderPanel()

    expect(
      screen.getByRole<HTMLInputElement>('spinbutton', { name: 'Tolerance' })
        .value
    ).toBe('100')
  })

  it('should call setSelectionOpacity when the selection opacity changes', () => {
    renderPanel()

    setNumberInput('Selection Opacity', '40')

    expect(mockStore.setSelectionOpacity).toHaveBeenCalledWith(40)
  })

  it('should toggle colorSelectLivePreview', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('switch', { name: 'Live Preview' }))

    expect(mockStore.colorSelectLivePreview).toBe(true)
  })

  it('should toggle applyWholeImage', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(
      screen.getByRole('switch', { name: 'Apply to Whole Image' })
    )

    expect(mockStore.applyWholeImage).toBe(true)
  })

  it('should show the translated method and update the check when it changes', async () => {
    const user = userEvent.setup()
    renderPanel()

    expect(screen.getByRole('button', { name: 'Method Simple' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Method Simple' }))
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'LAB' }))

    expect(mockStore.colorComparisonMethod).toBe(ColorComparisonMethod.LAB)
  })

  it('should toggle maskBoundary', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('switch', { name: 'Stop at mask' }))

    expect(mockStore.maskBoundary).toBe(true)
  })

  it('should convert a mask tolerance percent back to 0-255', () => {
    renderPanel()

    setNumberInput('Mask Tolerance', '40')

    expect(mockStore.setMaskTolerance).toHaveBeenCalledWith(102)
  })

  it('should ignore a cleared tolerance field', () => {
    renderPanel()

    setNumberInput('Tolerance', '')

    expect(mockStore.setColorSelectTolerance).not.toHaveBeenCalled()
  })
})
