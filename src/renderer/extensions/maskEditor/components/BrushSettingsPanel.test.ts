import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import BrushSettingsPanel from '@/renderer/extensions/maskEditor/components/BrushSettingsPanel.vue'
import { BrushShape } from '@comfyorg/mask-editor/types'
import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'

let mockStore: ReturnType<typeof useMaskEditorStore>

vi.mock<unknown>(import('@/components/ui/slider/Slider.vue'), () => ({
  default: {
    name: 'SliderStub',
    props: ['modelValue', 'min', 'max', 'step', 'disabled', 'ariaLabelledby'],
    emits: ['update:modelValue'],
    template: `<button data-slider="true" :aria-labelledby="ariaLabelledby" @click="$emit('update:modelValue', [0.5])">{{ modelValue?.[0] }}</button>`
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
        brushShapeCircle: 'Circle brush',
        brushShapeSquare: 'Square brush',
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

const numberInput = (name: string): HTMLInputElement =>
  screen.getByRole('spinbutton', { name })

const setNumberInput = (input: HTMLInputElement, value: string): void => {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('BrushSettingsPanel', () => {
  beforeEach(() => {
    mockStore = useMaskEditorStore()
    mockStore.$patch({
      brushSettings: {
        type: BrushShape.Arc,
        size: 10,
        opacity: 0.7,
        hardness: 1,
        stepSize: 5
      }
    })
  })

  describe('brush shape buttons', () => {
    it('should set brushSettings.type to Arc when the circle is chosen', async () => {
      mockStore.brushSettings.type = BrushShape.Rect
      renderPanel()
      const user = userEvent.setup()

      await user.click(screen.getByRole('radio', { name: 'Circle brush' }))

      expect(mockStore.brushSettings.type).toBe(BrushShape.Arc)
      expect(
        screen.getByRole('radio', { name: 'Circle brush' })
      ).toHaveAttribute('aria-checked', 'true')
    })

    it('should set brushSettings.type to Rect when the square is chosen', async () => {
      renderPanel()
      const user = userEvent.setup()

      await user.click(screen.getByRole('radio', { name: 'Square brush' }))

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
    it('should call setBrushSize when the thickness input changes', () => {
      renderPanel()

      setNumberInput(numberInput('Thickness'), '50')

      expect(mockStore.setBrushSize).toHaveBeenCalledWith(50)
    })

    it('should show a rounded thickness when the stored size is fractional', () => {
      mockStore.brushSettings.size = 10.6
      renderPanel()

      expect(numberInput('Thickness').value).toBe('11')
    })

    it('should ignore a cleared thickness field', () => {
      renderPanel()

      setNumberInput(numberInput('Thickness'), '')

      expect(mockStore.setBrushSize).not.toHaveBeenCalled()
    })

    it('should convert an opacity percent into the 0-1 store value', () => {
      renderPanel()

      setNumberInput(numberInput('Opacity'), '40')

      expect(mockStore.setBrushOpacity).toHaveBeenCalledWith(0.4)
    })

    it('should display opacity as a percent of the stored 0-1 value', () => {
      mockStore.brushSettings.opacity = 0.7
      renderPanel()

      expect(numberInput('Opacity').value).toBe('70')
    })

    it('should call setBrushHardness with a 0-1 value', () => {
      renderPanel()

      setNumberInput(numberInput('Hardness'), '60')

      expect(mockStore.setBrushHardness).toHaveBeenCalledWith(0.6)
    })

    it('should call setBrushStepSize when the step input changes', () => {
      renderPanel()

      setNumberInput(numberInput('Step Size'), '20')

      expect(mockStore.setBrushStepSize).toHaveBeenCalledWith(20)
    })
  })

  describe('thickness slider (logarithmic)', () => {
    it('should call setBrushSize with Math.round(Math.pow(250, value))', async () => {
      const user = userEvent.setup()
      renderPanel()

      await user.click(screen.getAllByRole('button', { name: 'Thickness' })[0])

      // value = 0.5 → Math.round(Math.pow(250, 0.5)) = 16
      expect(mockStore.setBrushSize).toHaveBeenCalledWith(16)
    })

    it('should map size 250 to slider value 1', () => {
      mockStore.brushSettings.size = 250
      renderPanel()

      expect(
        screen.getAllByRole('button', { name: 'Thickness' })[0].textContent
      ).toContain('1')
    })

    it('should return the cached raw slider value when the size still matches', async () => {
      vi.mocked(mockStore.setBrushSize).mockImplementation((size: number) => {
        mockStore.brushSettings.size = size
      })
      const user = userEvent.setup()
      renderPanel()
      const slider = screen.getAllByRole('button', { name: 'Thickness' })[0]

      await user.click(slider)

      expect(slider.textContent).toContain('0.5')
    })
  })
})
