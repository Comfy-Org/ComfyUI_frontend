/* eslint-disable testing-library/no-container, testing-library/no-node-access -- layer rows have unlabeled checkboxes and the blend-mode select has no role-friendly label */
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createI18n } from 'vue-i18n'

import type { useToolManager } from '@/composables/maskeditor/useToolManager'
import ImageLayerSettingsPanel from '@/components/maskeditor/ImageLayerSettingsPanel.vue'
import { MaskBlendMode, Tools } from '@/extensions/core/maskeditor/types'

type ToolManager = ReturnType<typeof useToolManager>

const initialMock = () =>
  reactive({
    maskOpacity: 0.8,
    maskBlendMode: MaskBlendMode.Black,
    activeLayer: 'mask' as 'mask' | 'rgb',
    currentTool: Tools.MaskPen,
    image: { src: 'https://example.com/base.png' } as { src: string } | null,
    maskCanvas: null as HTMLCanvasElement | null,
    rgbCanvas: null as HTMLCanvasElement | null,
    imgCanvas: null as HTMLCanvasElement | null,
    setMaskOpacity: vi.fn()
  })

let mockStore: ReturnType<typeof initialMock>
const mockUpdateMaskColor = vi.fn().mockResolvedValue(undefined)
const mockSetActiveLayer = vi.fn()

vi.mock('@/stores/maskEditorStore', () => ({
  useMaskEditorStore: () => mockStore
}))

vi.mock('@/composables/maskeditor/useCanvasManager', () => ({
  useCanvasManager: () => ({ updateMaskColor: mockUpdateMaskColor })
}))

vi.mock('@/components/maskeditor/controls/SliderControl.vue', () => ({
  default: {
    name: 'SliderControlStub',
    props: ['label', 'min', 'max', 'step', 'modelValue'],
    emits: ['update:modelValue'],
    template: `<button data-slider="true" @click="$emit('update:modelValue', 0.3)">{{ modelValue }}</button>`
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
        maskBlendingOptions: 'Mask Blending Options',
        black: 'Black',
        white: 'White',
        negative: 'Negative',
        maskLayer: 'Mask Layer',
        paintLayer: 'Paint Layer',
        baseImageLayer: 'Base Image Layer',
        activateLayer: 'Activate Layer',
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
    vi.clearAllMocks()
    mockStore = initialMock()
  })

  describe('mask opacity slider', () => {
    it('should call setMaskOpacity and update mask canvas opacity', async () => {
      const user = userEvent.setup()
      const canvas = makeCanvas()
      mockStore.maskCanvas = canvas
      const { container } = renderPanel()

      await user.click(
        container.querySelector('[data-slider="true"]') as HTMLElement
      )

      expect(mockStore.setMaskOpacity).toHaveBeenCalledWith(0.3)
      expect(canvas.style.opacity).toBe('0.3')
    })

    it('should leave canvas alone when no maskCanvas is set', async () => {
      const user = userEvent.setup()
      const { container } = renderPanel()

      await expect(
        user.click(
          container.querySelector('[data-slider="true"]') as HTMLElement
        )
      ).resolves.not.toThrow()

      expect(mockStore.setMaskOpacity).toHaveBeenCalledWith(0.3)
    })
  })

  describe('blend mode select', () => {
    it.each([
      ['black', MaskBlendMode.Black],
      ['white', MaskBlendMode.White],
      ['negative', MaskBlendMode.Negative],
      ['unknown-fallback', MaskBlendMode.Black]
    ] as const)('should map %s to MaskBlendMode.%s', async (raw, expected) => {
      const { container } = renderPanel()
      const select = container.querySelector('select') as HTMLSelectElement

      Object.defineProperty(select, 'value', {
        value: raw,
        configurable: true
      })
      select.dispatchEvent(new Event('change', { bubbles: true }))

      await new Promise((r) => setTimeout(r, 0))

      expect(mockStore.maskBlendMode).toBe(expected)
      expect(mockUpdateMaskColor).toHaveBeenCalled()
    })
  })

  describe('layer visibility checkboxes', () => {
    it('should toggle mask canvas opacity to maskOpacity when checked, 0 when unchecked', async () => {
      const user = userEvent.setup()
      const canvas = makeCanvas()
      mockStore.maskCanvas = canvas
      mockStore.maskOpacity = 0.5

      const { container } = renderPanel()
      const checkbox = container.querySelectorAll(
        'input[type="checkbox"]'
      )[0] as HTMLInputElement

      await user.click(checkbox)
      expect(canvas.style.opacity).toBe('0')

      await user.click(checkbox)
      expect(canvas.style.opacity).toBe('0.5')
    })

    it('should toggle paint (rgb) canvas opacity between 0 and 1', async () => {
      const user = userEvent.setup()
      const canvas = makeCanvas()
      mockStore.rgbCanvas = canvas

      const { container } = renderPanel()
      const checkbox = container.querySelectorAll(
        'input[type="checkbox"]'
      )[1] as HTMLInputElement

      await user.click(checkbox)
      expect(canvas.style.opacity).toBe('0')

      await user.click(checkbox)
      expect(canvas.style.opacity).toBe('1')
    })

    it('should toggle base image canvas opacity between 0 and 1', async () => {
      const user = userEvent.setup()
      const canvas = makeCanvas()
      mockStore.imgCanvas = canvas

      const { container } = renderPanel()
      const checkbox = container.querySelectorAll(
        'input[type="checkbox"]'
      )[2] as HTMLInputElement

      await user.click(checkbox)
      expect(canvas.style.opacity).toBe('0')
    })

    it('should not throw when toggling visibility for missing canvases', async () => {
      const user = userEvent.setup()
      const { container } = renderPanel()
      const checkboxes = container.querySelectorAll('input[type="checkbox"]')

      for (const cb of checkboxes) {
        await expect(user.click(cb as HTMLInputElement)).resolves.not.toThrow()
      }
    })
  })

  describe('activate layer buttons', () => {
    it('should forward the layer to toolManager.setActiveLayer when clicked', async () => {
      const user = userEvent.setup()
      mockStore.activeLayer = 'rgb'

      renderPanel({
        toolManager: {
          setActiveLayer: mockSetActiveLayer
        } as unknown as ToolManager
      })

      const [maskBtn] = screen.getAllByRole('button', {
        name: 'Activate Layer'
      })
      await user.click(maskBtn)

      expect(mockSetActiveLayer).toHaveBeenCalledWith('mask')
    })

    it('should not throw when toolManager prop is omitted', async () => {
      const user = userEvent.setup()
      mockStore.activeLayer = 'rgb'

      renderPanel()
      const [maskBtn] = screen.getAllByRole('button', {
        name: 'Activate Layer'
      })

      await expect(user.click(maskBtn)).resolves.not.toThrow()
    })

    it('should mark the active-layer button disabled', () => {
      mockStore.activeLayer = 'mask'

      renderPanel()
      const [maskBtn] = screen.getAllByRole('button', {
        name: 'Activate Layer'
      })

      expect(maskBtn.hasAttribute('disabled')).toBe(true)
    })
  })

  describe('paint layer activate visibility', () => {
    const styleOf = (el: Element): string => el.getAttribute('style') ?? ''

    it('should hide paint activate button when current tool is not Eraser', () => {
      mockStore.currentTool = Tools.MaskPen
      const { container } = renderPanel()
      const buttons = Array.from(container.querySelectorAll('button'))
      const paintBtn = buttons.find((b) => styleOf(b).includes('display:'))

      expect(paintBtn).toBeDefined()
      expect(styleOf(paintBtn as Element)).toContain('display: none')
    })

    it('should show paint activate button when current tool is Eraser', () => {
      mockStore.currentTool = Tools.Eraser
      const { container } = renderPanel()
      const buttons = Array.from(container.querySelectorAll('button'))
      const paintBtn = buttons.find((b) => styleOf(b).includes('display:'))

      expect(paintBtn).toBeDefined()
      expect(styleOf(paintBtn as Element)).toContain('display: block')
    })
  })

  describe('base image preview', () => {
    it('should render base image src from store', () => {
      mockStore.image = { src: 'https://example.com/img.png' }
      renderPanel()
      const img = screen.getByAltText('Base layer preview')

      expect((img as HTMLImageElement).src).toBe('https://example.com/img.png')
    })

    it('should render empty src when no image', () => {
      mockStore.image = null
      renderPanel()
      const img = screen.getByAltText('Base layer preview')

      expect(img.getAttribute('src')).toBe('')
    })
  })
})
