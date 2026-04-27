/* eslint-disable testing-library/no-container, testing-library/no-node-access -- shape buttons are unlabeled divs and number inputs have no aria labels */
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createI18n } from 'vue-i18n'

import BrushSettingsPanel from '@/components/maskeditor/BrushSettingsPanel.vue'
import { BrushShape } from '@/extensions/core/maskeditor/types'

const initialMock = () => ({
  brushSettings: reactive({
    type: BrushShape.Arc,
    size: 10,
    opacity: 0.7,
    hardness: 1,
    stepSize: 5
  }),
  rgbColor: '#FF0000',
  colorInput: null as HTMLInputElement | null,
  setBrushSize: vi.fn(),
  setBrushOpacity: vi.fn(),
  setBrushHardness: vi.fn(),
  setBrushStepSize: vi.fn(),
  resetBrushToDefault: vi.fn()
})

let mockStore: ReturnType<typeof initialMock>

vi.mock('@/stores/maskEditorStore', () => ({
  useMaskEditorStore: () => mockStore
}))

vi.mock('@/components/maskeditor/controls/SliderControl.vue', () => ({
  default: {
    name: 'SliderControlStub',
    props: ['label', 'min', 'max', 'step', 'modelValue'],
    emits: ['update:modelValue'],
    template: `<button data-slider="true" @click="$emit('update:modelValue', 0.5)">{{ modelValue }}</button>`
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      maskEditor: {
        brushSettings: 'Brush Settings',
        brushShape: 'Brush Shape',
        colorSelector: 'Color Selector',
        thickness: 'Thickness',
        opacity: 'Opacity',
        hardness: 'Hardness',
        stepSize: 'Step Size',
        resetToDefault: 'Reset to Default'
      }
    }
  }
})

const renderPanel = () =>
  render(BrushSettingsPanel, { global: { plugins: [i18n] } })

const setNumberInput = (input: HTMLInputElement, value: string): void => {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('BrushSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore = initialMock()
  })

  describe('brush shape buttons', () => {
    it('should set brushSettings.type to Arc when arc button clicked', async () => {
      mockStore.brushSettings.type = BrushShape.Rect
      const { container } = renderPanel()
      const user = userEvent.setup()

      const arcEl = container.querySelector(
        '.maskEditor_sidePanelBrushShapeCircle'
      )
      await user.click(arcEl as Element)

      expect(mockStore.brushSettings.type).toBe(BrushShape.Arc)
    })

    it('should set brushSettings.type to Rect when rect button clicked', async () => {
      const { container } = renderPanel()
      const user = userEvent.setup()

      const rectEl = container.querySelector(
        '.maskEditor_sidePanelBrushShapeSquare'
      )
      await user.click(rectEl as Element)

      expect(mockStore.brushSettings.type).toBe(BrushShape.Rect)
    })
  })

  describe('reset button', () => {
    it('should call resetBrushToDefault when clicked', async () => {
      const user = userEvent.setup()
      renderPanel()

      await user.click(screen.getByRole('button', { name: 'Reset to Default' }))

      expect(mockStore.resetBrushToDefault).toHaveBeenCalledTimes(1)
    })
  })

  describe('numeric inputs', () => {
    it('should call setBrushSize when size number input changes', () => {
      const { container } = renderPanel()
      const sizeInput = container.querySelectorAll(
        'input[type="number"]'
      )[0] as HTMLInputElement

      setNumberInput(sizeInput, '50')

      expect(mockStore.setBrushSize).toHaveBeenCalledWith(50)
    })

    it('should call setBrushOpacity when opacity number input changes', () => {
      const { container } = renderPanel()
      const opacityInput = container.querySelectorAll(
        'input[type="number"]'
      )[1] as HTMLInputElement

      setNumberInput(opacityInput, '0.4')

      expect(mockStore.setBrushOpacity).toHaveBeenCalledWith(0.4)
    })

    it('should call setBrushHardness when hardness number input changes', () => {
      const { container } = renderPanel()
      const hardnessInput = container.querySelectorAll(
        'input[type="number"]'
      )[2] as HTMLInputElement

      setNumberInput(hardnessInput, '0.6')

      expect(mockStore.setBrushHardness).toHaveBeenCalledWith(0.6)
    })

    it('should call setBrushStepSize when step number input changes', () => {
      const { container } = renderPanel()
      const stepInput = container.querySelectorAll(
        'input[type="number"]'
      )[3] as HTMLInputElement

      setNumberInput(stepInput, '20')

      expect(mockStore.setBrushStepSize).toHaveBeenCalledWith(20)
    })
  })

  describe('size slider (logarithmic)', () => {
    it('should call setBrushSize with Math.round(Math.pow(250, value))', () => {
      const { container } = renderPanel()
      const sizeSlider = container.querySelectorAll(
        '[data-slider="true"]'
      )[0] as HTMLElement

      sizeSlider.click()
      // value = 0.5 → Math.round(Math.pow(250, 0.5)) = 16
      expect(mockStore.setBrushSize).toHaveBeenCalledWith(16)
    })

    it('should map size 250 to slider value 1', () => {
      mockStore.brushSettings.size = 250
      const { container } = renderPanel()
      const sizeSlider = container.querySelectorAll(
        '[data-slider="true"]'
      )[0] as HTMLElement

      // Math.log(250) / Math.log(250) = 1
      expect(sizeSlider.textContent).toContain('1')
    })

    it('should return cached raw slider value when size matches the mapping', async () => {
      mockStore.setBrushSize.mockImplementation((size: number) => {
        mockStore.brushSettings.size = size
      })
      const { container } = renderPanel()
      const sizeSlider = container.querySelectorAll(
        '[data-slider="true"]'
      )[0] as HTMLElement

      // Click sets rawSliderValue=0.5 → setBrushSize(16) → size=16
      // → next getter run sees cached match → returns 0.5
      sizeSlider.click()
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(sizeSlider.textContent).toContain('0.5')
    })
  })

  describe('color input', () => {
    it('should v-model rgbColor on the color input', () => {
      const { container } = renderPanel()
      const colorInput = container.querySelector(
        'input[type="color"]'
      ) as HTMLInputElement

      colorInput.value = '#00ff00'
      colorInput.dispatchEvent(new Event('input', { bubbles: true }))

      expect(mockStore.rgbColor).toBe('#00ff00')
    })

    it('should expose color input ref to the store on mount', () => {
      const { container } = renderPanel()
      const colorInput = container.querySelector('input[type="color"]')

      expect(mockStore.colorInput).toBe(colorInput)
    })

    it('should clear store.colorInput on unmount', () => {
      const { unmount } = renderPanel()
      expect(mockStore.colorInput).not.toBeNull()

      unmount()

      expect(mockStore.colorInput).toBeNull()
    })
  })
})
