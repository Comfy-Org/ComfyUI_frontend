/* eslint-disable vue/one-component-per-file */
/* eslint-disable vue/no-reserved-component-names */
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { Bounds } from '@/renderer/core/layout/types'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import type { Ref } from 'vue'

const cropHolder = vi.hoisted(() => ({
  state: null as Record<string, unknown> | null
}))

function createDefaultCropState() {
  return {
    imageUrl: ref<string | null>(null),
    isLoading: ref(false),
    selectedRatio: ref('1:1'),
    isLockEnabled: ref(false),
    cropBoxStyle: ref({}),
    resizeHandles: ref([]),
    handleImageLoad: () => {},
    handleImageError: () => {},
    handleDragStart: () => {},
    handleDragMove: () => {},
    handleDragEnd: () => {},
    handleResizeStart: () => {},
    handleResizeMove: () => {},
    handleResizeEnd: () => {}
  }
}

vi.mock('@/composables/useImageCrop', async () => {
  return {
    ASPECT_RATIOS: {
      '1:1': 1,
      '4:3': 4 / 3,
      custom: null
    },
    useImageCrop: () => {
      if (!cropHolder.state) {
        cropHolder.state = createDefaultCropState()
      }
      return cropHolder.state
    }
  }
})

const upstreamHolder = vi.hoisted(() => ({
  ref: null as Ref<unknown> | null
}))

vi.mock('@/composables/useUpstreamValue', async () => {
  const { ref } = await import('vue')
  return {
    useUpstreamValue: () => {
      upstreamHolder.ref = upstreamHolder.ref ?? ref<unknown>(undefined)
      return upstreamHolder.ref
    },
    boundsExtractor: () => () => undefined
  }
})

import WidgetImageCrop from './WidgetImageCrop.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      imageCrop: {
        loading: 'Loading...',
        noInputImage: 'No input image connected',
        cropPreviewAlt: 'Crop preview',
        ratio: 'Ratio',
        lockRatio: 'Lock aspect ratio',
        unlockRatio: 'Unlock aspect ratio',
        custom: 'Custom'
      },
      boundingBox: { x: 'X', y: 'Y', width: 'Width', height: 'Height' }
    }
  }
})

const ButtonStub = defineComponent({
  name: 'Button',
  inheritAttrs: false,
  template: '<button v-bind="$attrs" type="button"><slot /></button>'
})

const Passthrough = defineComponent({
  template: '<div><slot /></div>'
})

const WidgetBoundingBoxStub = defineComponent({
  name: 'WidgetBoundingBox',
  props: {
    modelValue: { type: Object, default: () => ({}) },
    disabled: { type: Boolean, default: false }
  },
  // eslint-disable-next-line vue/no-unused-emit-declarations
  emits: ['update:modelValue'],
  template: `<div data-testid="bbox-child"
    :data-disabled="String(disabled)"
    :data-model="JSON.stringify(modelValue)"
    @click="$emit('update:modelValue', { x: 1, y: 2, width: 3, height: 4 })"
  />`
})

function primeCropState(overrides: Record<string, unknown> = {}) {
  cropHolder.state = {
    ...createDefaultCropState(),
    ...overrides
  }
}

function makeWidget(
  overrides: Partial<SimplifiedWidget<Bounds>> = {}
): SimplifiedWidget<Bounds> {
  return {
    name: 'crop',
    type: 'imagecrop',
    value: { x: 0, y: 0, width: 512, height: 512 },
    options: {},
    ...overrides
  } as SimplifiedWidget<Bounds>
}

function renderWidget(
  widget: SimplifiedWidget<Bounds> = makeWidget(),
  initialModel: Bounds = { x: 0, y: 0, width: 512, height: 512 }
) {
  const value = ref<Bounds>(initialModel)
  const Harness = defineComponent({
    components: { WidgetImageCrop },
    setup: () => ({ value, widget }),
    template:
      '<WidgetImageCrop v-model="value" :widget="widget" :node-id="1" />'
  })
  const utils = render(Harness, {
    global: {
      plugins: [i18n],
      stubs: {
        Button: ButtonStub,
        Select: Passthrough,
        SelectContent: Passthrough,
        SelectTrigger: Passthrough,
        SelectValue: Passthrough,
        SelectItem: Passthrough,
        WidgetBoundingBox: WidgetBoundingBoxStub
      }
    }
  })
  return { ...utils, value }
}

describe('WidgetImageCrop', () => {
  beforeEach(() => {
    cropHolder.state = null
    upstreamHolder.ref = null
  })

  describe('Image states', () => {
    it('shows the empty-state placeholder when imageUrl is null', () => {
      primeCropState()
      renderWidget()
      expect(screen.getByTestId('crop-empty-state')).toBeInTheDocument()
      expect(screen.getByText('No input image connected')).toBeInTheDocument()
    })

    it('shows the loading message when isLoading is true', () => {
      primeCropState({ isLoading: ref(true), imageUrl: ref('/img.png') })
      renderWidget()
      expect(screen.getByText('Loading...')).toBeInTheDocument()
      expect(screen.queryByTestId('crop-empty-state')).toBeNull()
    })

    it('renders an img when imageUrl is set and not loading', () => {
      primeCropState({ imageUrl: ref('/img.png'), isLoading: ref(false) })
      renderWidget()
      expect(
        screen.getByRole('img', { name: 'Crop preview' })
      ).toBeInTheDocument()
      expect(screen.queryByText('Loading...')).toBeNull()
    })

    it('renders the crop overlay when an image is loaded', () => {
      primeCropState({ imageUrl: ref('/img.png'), isLoading: ref(false) })
      renderWidget()
      expect(screen.getByTestId('crop-overlay')).toBeInTheDocument()
    })
  })

  describe('Disabled state', () => {
    it('hides the ratio controls when widget is disabled', () => {
      renderWidget(makeWidget({ options: { disabled: true } }))
      expect(screen.queryByText('Ratio')).toBeNull()
    })

    it('shows the ratio controls when widget is enabled', () => {
      renderWidget()
      expect(screen.getByText('Ratio')).toBeInTheDocument()
    })

    it('passes disabled=true to the bounding box child when disabled', () => {
      renderWidget(makeWidget({ options: { disabled: true } }))
      expect(screen.getByTestId('bbox-child').dataset.disabled).toBe('true')
    })
  })

  describe('Bounds delegation', () => {
    it('forwards v-model to the bounding box child', () => {
      renderWidget(undefined, { x: 5, y: 10, width: 100, height: 200 })
      const parsed = JSON.parse(screen.getByTestId('bbox-child').dataset.model!)
      expect(parsed).toEqual({ x: 5, y: 10, width: 100, height: 200 })
    })

    it('updates v-model when the bounding box emits a change', async () => {
      const { value } = renderWidget()
      const user = userEvent.setup()
      await user.click(screen.getByTestId('bbox-child'))
      expect(value.value).toEqual({ x: 1, y: 2, width: 3, height: 4 })
    })

    it('uses upstream bounds when disabled and upstream is available', () => {
      upstreamHolder.ref = ref<unknown>({
        x: 7,
        y: 8,
        width: 20,
        height: 30
      })
      renderWidget(
        makeWidget({
          options: { disabled: true },
          linkedUpstream: { nodeId: 'n1' }
        }),
        { x: 0, y: 0, width: 512, height: 512 }
      )
      const parsed = JSON.parse(screen.getByTestId('bbox-child').dataset.model!)
      expect(parsed).toEqual({ x: 7, y: 8, width: 20, height: 30 })
    })
  })
})
