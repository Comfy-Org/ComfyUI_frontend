import { fireEvent, render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

const sizeHolder = vi.hoisted(() => ({ width: 0, height: 0 }))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    useElementSize: () => ({
      width: ref(sizeHolder.width),
      height: ref(sizeHolder.height)
    })
  }
})

const painterHolder = vi.hoisted(() => ({
  state: null as Record<string, unknown> | null
}))

function createDefaultPainterState() {
  return {
    tool: ref('brush'),
    brushSize: ref(20),
    brushColor: ref('#000000'),
    brushOpacity: ref(1),
    brushHardness: ref(1),
    backgroundColor: ref('#ffffff'),
    canvasWidth: ref(512),
    canvasHeight: ref(512),
    cursorVisible: ref(true),
    displayBrushSize: ref(20),
    inputImageUrl: ref<string | null>(null),
    isImageInputConnected: ref(false),
    handlePointerDown: vi.fn(),
    handlePointerMove: vi.fn(),
    handlePointerUp: vi.fn(),
    handlePointerEnter: vi.fn(),
    handlePointerLeave: vi.fn(),
    handleInputImageLoad: vi.fn(),
    handleClear: vi.fn()
  }
}

vi.mock('@/composables/painter/usePainter', () => ({
  PAINTER_TOOLS: { BRUSH: 'brush', ERASER: 'eraser' } as const,
  usePainter: () => {
    if (!painterHolder.state) painterHolder.state = createDefaultPainterState()
    return painterHolder.state
  }
}))

import WidgetPainter from './WidgetPainter.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      painter: {
        tool: 'Tool',
        brush: 'Brush',
        eraser: 'Eraser',
        size: 'Size',
        color: 'Color',
        hardness: 'Hardness',
        width: 'Width',
        height: 'Height',
        background: 'Background',
        clear: 'Clear'
      }
    }
  }
})

const ButtonStub = defineComponent({
  name: 'Button',
  inheritAttrs: false,
  template: '<button v-bind="$attrs" type="button"><slot /></button>'
})

const SliderStub = defineComponent({
  name: 'Slider',
  props: {
    modelValue: { type: Array, default: () => [] },
    min: Number,
    max: Number,
    step: Number
  },
  emits: ['update:modelValue'],
  template:
    '<div data-testid="slider-stub" :data-min="min" @click="$emit(\'update:modelValue\', [Number(min) + Number(step ?? 1)])" />'
})

function primePainterState(overrides: Record<string, unknown> = {}) {
  painterHolder.state = { ...createDefaultPainterState(), ...overrides }
}

function renderWidget(initialModel = '') {
  const value = ref(initialModel)
  const Harness = defineComponent({
    components: { WidgetPainter },
    setup: () => ({ value }),
    template: '<WidgetPainter v-model="value" node-id="42" />'
  })
  return render(Harness, {
    global: {
      plugins: [i18n],
      stubs: { Button: ButtonStub, Slider: SliderStub }
    }
  })
}

describe('WidgetPainter', () => {
  beforeEach(() => {
    sizeHolder.width = 0
    sizeHolder.height = 0
    painterHolder.state = null
  })

  describe('Label visibility', () => {
    const allLabels = [
      'Tool',
      'Size',
      'Color',
      'Hardness',
      'Width',
      'Height',
      'Background'
    ]

    it('renders every label in wide layout (width >= 350)', () => {
      sizeHolder.width = 600
      primePainterState()
      renderWidget()
      for (const label of allLabels) {
        expect(screen.getByText(label)).toBeInTheDocument()
      }
    })

    it('still renders every label in compact layout (width < 350)', () => {
      sizeHolder.width = 200
      primePainterState()
      renderWidget()
      for (const label of allLabels) {
        expect(screen.getByText(label)).toBeInTheDocument()
      }
    })

    it('keeps labels at the responsive boundary (width = 350)', () => {
      sizeHolder.width = 350
      primePainterState()
      renderWidget()
      for (const label of allLabels) {
        expect(screen.getByText(label)).toBeInTheDocument()
      }
    })
  })

  describe('Image-input branch', () => {
    it('hides canvas-size and background controls when an image is connected', () => {
      primePainterState({
        isImageInputConnected: ref(true),
        inputImageUrl: ref('/img.png')
      })
      renderWidget()

      expect(screen.queryByText('Width')).toBeNull()
      expect(screen.queryByText('Height')).toBeNull()
      expect(screen.queryByText('Background')).toBeNull()
      expect(screen.getByTestId('painter-dimension-text')).toBeInTheDocument()
    })

    it('renders the input image inside the canvas container', () => {
      primePainterState({
        isImageInputConnected: ref(true),
        inputImageUrl: ref('/img.png')
      })
      renderWidget()

      const container = screen.getByTestId('painter-canvas-container')
      expect(within(container).getByRole('img')).toBeInTheDocument()
    })
  })

  describe('Tool selection', () => {
    it('hides brush-only controls when the eraser tool is active', () => {
      primePainterState({ tool: ref('eraser') })
      renderWidget()

      expect(screen.queryByText('Color')).toBeNull()
      expect(screen.queryByText('Hardness')).toBeNull()
    })

    it('updates the active tool when clicking brush/eraser buttons', async () => {
      const tool = ref<'brush' | 'eraser'>('brush')
      primePainterState({ tool })
      renderWidget()
      const user = userEvent.setup()

      await user.click(screen.getByText('Eraser'))
      expect(tool.value).toBe('eraser')

      await user.click(screen.getByText('Brush'))
      expect(tool.value).toBe('brush')
    })
  })

  describe('Canvas events', () => {
    it('forwards pointerdown/up to the composable on click', async () => {
      primePainterState()
      renderWidget()
      const user = userEvent.setup()

      await user.click(screen.getByTestId('painter-canvas'))

      const s = painterHolder.state!
      expect(s.handlePointerDown).toHaveBeenCalled()
      expect(s.handlePointerUp).toHaveBeenCalled()
    })

    it('forwards pointerenter/leave to the composable on hover', async () => {
      primePainterState()
      renderWidget()
      const user = userEvent.setup()
      const canvas = screen.getByTestId('painter-canvas')

      await user.hover(canvas)
      await user.unhover(canvas)

      const s = painterHolder.state!
      expect(s.handlePointerEnter).toHaveBeenCalled()
      expect(s.handlePointerLeave).toHaveBeenCalled()
    })

    it('invokes handleInputImageLoad when the input image fires load', async () => {
      primePainterState({
        isImageInputConnected: ref(true),
        inputImageUrl: ref('/img.png')
      })
      renderWidget()

      const img = within(
        screen.getByTestId('painter-canvas-container')
      ).getByRole('img')
      await fireEvent.load(img)
      expect(painterHolder.state!.handleInputImageLoad).toHaveBeenCalled()
    })
  })

  describe('Control bindings', () => {
    it('invokes handleClear when the clear button is clicked', async () => {
      primePainterState()
      renderWidget()
      const user = userEvent.setup()

      await user.click(screen.getByTestId('painter-clear-button'))
      expect(painterHolder.state!.handleClear).toHaveBeenCalled()
    })

    it('updates brushSize via the size slider', async () => {
      const brushSize = ref(20)
      primePainterState({ brushSize })
      renderWidget()
      const user = userEvent.setup()

      const slider = within(screen.getByTestId('painter-size-row')).getByTestId(
        'slider-stub'
      )
      await user.click(slider)
      expect(brushSize.value).toBe(2) // min=1, step=1 -> emits 2
    })

    it('updates brushColor via the color picker', async () => {
      const brushColor = ref('#000000')
      primePainterState({ brushColor })
      renderWidget()

      const colorInput = within(
        screen.getByTestId('painter-color-row')
      ).getByDisplayValue('#000000')
      // <input type="color"> has no userEvent equivalent — fire input directly
      // eslint-disable-next-line testing-library/prefer-user-event
      await fireEvent.input(colorInput, { target: { value: '#ff0000' } })
      expect(brushColor.value.toLowerCase()).toBe('#ff0000')
    })

    it('updates brushOpacity via the percent input', async () => {
      const brushOpacity = ref(1)
      primePainterState({ brushOpacity })
      renderWidget()
      const user = userEvent.setup()

      const percentInput = within(
        screen.getByTestId('painter-color-row')
      ).getByDisplayValue('100')
      await user.clear(percentInput)
      await user.type(percentInput, '50')
      await user.tab() // blur to trigger @change
      expect(brushOpacity.value).toBeCloseTo(0.5)
    })

    it('clamps opacity input to the 0-100 range', async () => {
      const brushOpacity = ref(1)
      primePainterState({ brushOpacity })
      renderWidget()
      const user = userEvent.setup()

      const percentInput = within(
        screen.getByTestId('painter-color-row')
      ).getByDisplayValue('100')
      await user.clear(percentInput)
      await user.type(percentInput, '999')
      await user.tab()
      expect(brushOpacity.value).toBe(1) // clamped to 100% -> 1.0
    })

    it('updates background color via the bg color input', async () => {
      const backgroundColor = ref('#ffffff')
      primePainterState({ backgroundColor })
      renderWidget()

      const bgInput = within(
        screen.getByTestId('painter-bg-color-row')
      ).getByDisplayValue('#ffffff')
      // eslint-disable-next-line testing-library/prefer-user-event
      await fireEvent.input(bgInput, { target: { value: '#00ff00' } })
      expect(backgroundColor.value.toLowerCase()).toBe('#00ff00')
    })
  })
})
