import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { Bounds } from '@comfyorg/shared-frontend-utils/geometry'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { registerTestWidget } from '@/renderer/extensions/vueNodes/widgets/components/widgetTestUtils'
import { app } from '@/scripts/app'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { Ref } from 'vue'

const cropHolder = vi.hoisted(() => ({
  state: null as Record<string, unknown> | null,
  onEditEnd: undefined as (() => void) | undefined
}))

vi.mock(import('@/scripts/app'))

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

vi.mock<unknown>(import('@/composables/useImageCrop'), async () => {
  return {
    ASPECT_RATIOS: {
      '1:1': 1,
      '4:3': 4 / 3,
      custom: null
    },
    useImageCrop: (_nodeId: unknown, options: { onEditEnd?: () => void }) => {
      cropHolder.onEditEnd = options.onEditEnd
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

vi.mock<unknown>(import('@/composables/useUpstreamValue'), async () => {
  const { computed, ref } = await import('vue')
  return {
    useUpstreamValue: (getLinkedUpstream: () => unknown) => {
      const upstream = (upstreamHolder.ref ??= ref<unknown>(undefined))
      return computed(() => (getLinkedUpstream() ? upstream.value : undefined))
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
      boundingBox: { x: 'X', y: 'Y', width: 'Width', height: 'Height' },
      widgetHistory: { undo: 'Undo', redo: 'Redo' }
    }
  }
})

const WidgetBoundingBoxStub = defineComponent({
  name: 'WidgetBoundingBox',
  props: {
    modelValue: { type: Object, default: () => ({}) },
    disabled: { type: Boolean, default: false }
  },

  emits: ['update:modelValue', 'editEnd'],
  template: `<div>
    <div data-testid="bbox-child"
      :data-disabled="String(disabled)"
      :data-model="JSON.stringify(modelValue)"
      @click="$emit('update:modelValue', { x: 1, y: 2, width: 3, height: 4 })"
    />
    <div data-testid="bbox-nudge-x"
      @click="$emit('update:modelValue', { ...modelValue, x: modelValue.x + 10 }); $emit('editEnd', 'x')"
    />
  </div>`
})

function primeCropState(overrides: Record<string, unknown> = {}) {
  cropHolder.state = {
    ...createDefaultCropState(),
    ...overrides
  }
}

function makeWidget({ disabled = false } = {}): WidgetId {
  return registerTestWidget({
    name: 'crop',
    type: 'imagecrop',
    value: { x: 0, y: 0, width: 512, height: 512 },
    options: { disabled }
  })
}

function makeLinkedWidget() {
  const graph = new LGraph()
  vi.mocked(app).rootGraph = graph
  const source = new LGraphNode('Source')
  source.addOutput('bounds', 'BOUNDING_BOX')
  graph.add(source)
  const target = new LGraphNode('Target')
  target.addInput('crop', 'BOUNDING_BOX', { widget: { name: 'crop' } })
  graph.add(target)
  const id = widgetId(graph.id, target.id, 'crop')
  useWidgetValueStore().registerWidget(id, {
    type: 'imagecrop',
    value: { x: 0, y: 0, width: 512, height: 512 },
    options: {}
  })
  source.connect(0, target, 0)
  return id
}

function renderWidget(
  widgetId: WidgetId = makeWidget(),
  initialModel: Bounds = { x: 0, y: 0, width: 512, height: 512 }
) {
  const value = ref<Bounds>(initialModel)
  const nodeId = toNodeId(1)
  const Harness = defineComponent({
    components: { WidgetImageCrop },
    setup: () => ({ value, widgetId, nodeId }),
    template:
      '<WidgetImageCrop v-model="value" :widget-id="widgetId" :node-id="nodeId" />'
  })
  const utils = render(Harness, {
    global: {
      plugins: [i18n],
      stubs: {
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
      renderWidget(makeWidget({ disabled: true }))
      expect(screen.queryByText('Ratio')).toBeNull()
    })

    it('shows the ratio controls when widget is enabled', () => {
      renderWidget()
      expect(screen.getByText('Ratio')).toBeInTheDocument()
    })

    it('passes disabled=true to the bounding box child when disabled', () => {
      renderWidget(makeWidget({ disabled: true }))
      expect(screen.getByTestId('bbox-child').dataset.disabled).toBe('true')
    })
  })

  describe('Node history', () => {
    it('undoes and redoes a crop box drag', async () => {
      primeCropState()
      const { value } = renderWidget()
      value.value.x = 50
      cropHolder.onEditEnd?.()
      await nextTick()
      await nextTick()
      const user = userEvent.setup()

      await user.click(screen.getByRole('button', { name: 'Undo' }))
      expect(value.value).toEqual({ x: 0, y: 0, width: 512, height: 512 })

      await user.click(screen.getByRole('button', { name: 'Redo' }))
      expect(value.value.x).toBe(50)
    })

    it('undoes consecutive changes to one number field as a single step', async () => {
      primeCropState()
      const { value } = renderWidget()
      const user = userEvent.setup()
      await user.click(screen.getByTestId('bbox-nudge-x'))
      await user.click(screen.getByTestId('bbox-nudge-x'))
      expect(value.value.x).toBe(20)

      await user.click(screen.getByRole('button', { name: 'Undo' }))

      expect(value.value.x).toBe(0)
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
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

    it('uses the upstream bounds while linked to an upstream node', () => {
      upstreamHolder.ref = ref<unknown>({
        x: 7,
        y: 8,
        width: 20,
        height: 30
      })
      renderWidget(makeLinkedWidget(), {
        x: 0,
        y: 0,
        width: 512,
        height: 512
      })
      const parsed = JSON.parse(screen.getByTestId('bbox-child').dataset.model!)
      expect(parsed).toEqual({ x: 7, y: 8, width: 20, height: 30 })
    })
  })
})
