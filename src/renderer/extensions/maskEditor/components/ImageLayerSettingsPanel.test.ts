import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ImageLayerSettingsPanel from '@/renderer/extensions/maskEditor/components/ImageLayerSettingsPanel.vue'
import type { useToolManager } from '@comfyorg/mask-editor/useToolManager'
import { MaskBlendMode } from '@comfyorg/mask-editor/types'
import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'

type ToolManager = ReturnType<typeof useToolManager>

function rowButton(testId: string) {
  return within(screen.getByTestId(testId)).getByRole('button')
}

let mockStore: ReturnType<typeof useMaskEditorStore>
const mockUpdateMaskColor = vi.fn().mockResolvedValue(undefined)
const mockSetActiveLayer = vi.fn()

vi.mock<unknown>(import('@comfyorg/mask-editor/useCanvasManager'), () => ({
  useCanvasManager: () => ({ updateMaskColor: mockUpdateMaskColor })
}))

vi.mock<unknown>(import('@/components/ui/slider/Slider.vue'), () => ({
  default: {
    name: 'SliderStub',
    props: ['modelValue', 'disabled', 'ariaLabelledby'],
    emits: ['update:modelValue'],
    template: `<button data-slider="true" :disabled="disabled" :aria-labelledby="ariaLabelledby" @click="$emit('update:modelValue', [30])">{{ modelValue?.[0] }}</button>`
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      maskEditor: {
        layers: 'Layers',
        maskOpacity: 'Mask Opacity',
        maskBlending: 'Mask blending',
        black: 'Black',
        white: 'White',
        negative: 'Negative',
        maskLayer: 'Mask Layer',
        paintLayer: 'Paint Layer',
        baseImageLayer: 'Base Image Layer',
        baseLayerPreview: 'Base layer preview'
      }
    }
  }
})

const renderPanel = (props?: Record<string, unknown>) =>
  render(ImageLayerSettingsPanel, {
    global: { plugins: [i18n] },
    props
  })

const makeCanvas = (): HTMLCanvasElement => document.createElement('canvas')

describe('ImageLayerSettingsPanel', () => {
  beforeEach(() => {
    mockStore = useMaskEditorStore()
    mockStore.image = new Image()
    mockStore.image.src = 'https://example.com/base.png'
    mockStore.maskBlendMode = MaskBlendMode.Black
    mockStore.maskOpacity = 1
  })

  describe('mask opacity slider', () => {
    it('should convert a percent into mask opacity and the canvas style', () => {
      const canvas = makeCanvas()
      mockStore.maskCanvas = canvas
      renderPanel()
      const input = screen.getByRole<HTMLInputElement>('spinbutton', {
        name: 'Mask Opacity'
      })

      input.value = '30'
      input.dispatchEvent(new Event('input', { bubbles: true }))

      expect(mockStore.setMaskOpacity).toHaveBeenCalledWith(0.3)
      expect(canvas.style.opacity).toBe('0.3')
    })

    it('should leave the canvas alone when no maskCanvas is set', () => {
      renderPanel()
      const input = screen.getByRole<HTMLInputElement>('spinbutton', {
        name: 'Mask Opacity'
      })

      input.value = '30'
      input.dispatchEvent(new Event('input', { bubbles: true }))

      expect(mockStore.setMaskOpacity).toHaveBeenCalledWith(0.3)
    })

    it('should not override the forced opacity while Negative blend is active', () => {
      const canvas = makeCanvas()
      canvas.style.opacity = '1'
      mockStore.maskCanvas = canvas
      mockStore.maskBlendMode = MaskBlendMode.Negative
      renderPanel()
      const input = screen.getByRole<HTMLInputElement>('spinbutton', {
        name: 'Mask Opacity'
      })

      input.value = '30'
      input.dispatchEvent(new Event('input', { bubbles: true }))

      expect(mockStore.setMaskOpacity).toHaveBeenCalledWith(0.3)
      expect(canvas.style.opacity).toBe('1')
    })

    it('should disable the opacity slider in Negative blend mode', () => {
      mockStore.maskBlendMode = MaskBlendMode.Negative
      renderPanel()

      expect(
        screen.getByRole('button', { name: 'Mask Opacity' })
      ).toBeDisabled()
    })
  })

  describe('blend mode menu', () => {
    it.for([
      ['Black', MaskBlendMode.Black],
      ['White', MaskBlendMode.White],
      ['Negative', MaskBlendMode.Negative]
    ] as const)('should select %s', async ([label, expected]) => {
      const user = userEvent.setup()
      mockStore.maskBlendMode = MaskBlendMode.White
      renderPanel()

      await user.click(
        screen.getByRole('button', { name: 'Mask blending White' })
      )
      await user.click(screen.getByRole('menuitemcheckbox', { name: label }))

      expect(mockStore.maskBlendMode).toBe(expected)
      expect(mockUpdateMaskColor).toHaveBeenCalled()
    })
  })

  describe('layer visibility checkboxes', () => {
    it('should toggle mask canvas opacity without changing the active layer', async () => {
      const user = userEvent.setup()
      const canvas = makeCanvas()
      mockStore.maskCanvas = canvas
      mockStore.maskOpacity = 0.5
      mockStore.activeLayer = 'rgb'

      renderPanel({
        toolManager: {
          setActiveLayer: mockSetActiveLayer
        } as unknown as ToolManager
      })

      await user.click(screen.getByRole('checkbox', { name: 'Mask Layer' }))
      expect(canvas.style.opacity).toBe('0')

      await user.click(screen.getByRole('checkbox', { name: 'Mask Layer' }))
      expect(canvas.style.opacity).toBe('0.5')
      expect(mockSetActiveLayer).not.toHaveBeenCalled()
    })

    it('should toggle mask canvas visibility in Negative blend mode', async () => {
      const user = userEvent.setup()
      const canvas = makeCanvas()
      mockStore.maskCanvas = canvas
      mockStore.maskBlendMode = MaskBlendMode.Negative

      renderPanel({
        toolManager: {
          setActiveLayer: mockSetActiveLayer
        } as unknown as ToolManager
      })

      await user.click(screen.getByRole('checkbox', { name: 'Mask Layer' }))
      expect(canvas.style.opacity).toBe('0')

      await user.click(screen.getByRole('checkbox', { name: 'Mask Layer' }))
      expect(canvas.style.opacity).toBe('1')
    })

    it('should toggle paint canvas opacity between 0 and 1', async () => {
      const user = userEvent.setup()
      const canvas = makeCanvas()
      mockStore.rgbCanvas = canvas
      renderPanel()

      await user.click(screen.getByRole('checkbox', { name: 'Paint Layer' }))
      expect(canvas.style.opacity).toBe('0')

      await user.click(screen.getByRole('checkbox', { name: 'Paint Layer' }))
      expect(canvas.style.opacity).toBe('1')
    })

    it('should toggle the base image canvas opacity', async () => {
      const user = userEvent.setup()
      const canvas = makeCanvas()
      mockStore.imgCanvas = canvas
      renderPanel()

      await user.click(
        screen.getByRole('checkbox', { name: 'Base Image Layer' })
      )

      expect(canvas.style.opacity).toBe('0')
    })

    it('should not throw when toggling visibility for missing canvases', async () => {
      const user = userEvent.setup()
      renderPanel()

      for (const name of ['Mask Layer', 'Paint Layer', 'Base Image Layer']) {
        await expect(
          user.click(screen.getByRole('checkbox', { name }))
        ).resolves.not.toThrow()
      }
    })
  })

  describe('layer rows', () => {
    it('should mark the active layer button as pressed', () => {
      mockStore.activeLayer = 'mask'
      renderPanel()

      expect(rowButton('mask-layer-row')).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      expect(rowButton('paint-layer-row')).toHaveAttribute(
        'aria-pressed',
        'false'
      )
    })

    it('activates the mask layer from the row button', async () => {
      const user = userEvent.setup()
      mockStore.activeLayer = 'rgb'
      renderPanel({
        toolManager: {
          setActiveLayer: mockSetActiveLayer
        } as unknown as ToolManager
      })

      await user.click(rowButton('mask-layer-row'))

      expect(mockSetActiveLayer).toHaveBeenCalledWith('mask')
    })

    it('activates the mask layer with Enter', async () => {
      const user = userEvent.setup()
      mockStore.activeLayer = 'rgb'
      renderPanel({
        toolManager: {
          setActiveLayer: mockSetActiveLayer
        } as unknown as ToolManager
      })

      rowButton('mask-layer-row').focus()
      await user.keyboard('{Enter}')

      expect(mockSetActiveLayer).toHaveBeenCalledWith('mask')
    })

    it('activates the paint layer with Space', async () => {
      const user = userEvent.setup()
      mockStore.activeLayer = 'mask'
      renderPanel({
        toolManager: {
          setActiveLayer: mockSetActiveLayer
        } as unknown as ToolManager
      })

      rowButton('paint-layer-row').focus()
      await user.keyboard('[Space]')

      expect(mockSetActiveLayer).toHaveBeenCalledWith('rgb')
    })

    it('activates the paint layer from the row button', async () => {
      const user = userEvent.setup()
      mockStore.activeLayer = 'mask'
      renderPanel({
        toolManager: {
          setActiveLayer: mockSetActiveLayer
        } as unknown as ToolManager
      })

      await user.click(rowButton('paint-layer-row'))

      expect(mockSetActiveLayer).toHaveBeenCalledWith('rgb')
    })

    it('does not throw when toolManager is omitted', async () => {
      const user = userEvent.setup()
      renderPanel()

      await expect(
        user.click(rowButton('mask-layer-row'))
      ).resolves.not.toThrow()
    })
  })

  describe('base image preview', () => {
    it('should render the base image src from the store', () => {
      mockStore.image = new Image()
      mockStore.image.src = 'https://example.com/img.png'
      renderPanel()

      expect(screen.getByAltText('Base layer preview')).toHaveAttribute(
        'src',
        'https://example.com/img.png'
      )
    })

    it('should render an empty src when there is no image', () => {
      mockStore.image = null
      renderPanel()

      expect(
        screen.getByAltText('Base layer preview').getAttribute('src')
      ).toBe('')
    })
  })
})
