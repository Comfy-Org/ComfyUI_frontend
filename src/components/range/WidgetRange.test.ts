import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type {
  IWidgetRangeOptions,
  RangeValue
} from '@comfyorg/graph-model/widgets'
import { registerTestWidget } from '@/renderer/extensions/vueNodes/widgets/components/widgetTestUtils'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

import WidgetRange from './WidgetRange.vue'

vi.mock(import('@/scripts/app'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { widgetHistory: { undo: 'Undo', redo: 'Redo' } } }
})

const upstreamHolder = vi.hoisted(() => ({
  ref: null as { value: unknown } | null
}))

vi.mock<unknown>(import('@/composables/useUpstreamValue'), async () => {
  const { ref } = await import('vue')
  return {
    useUpstreamValue: () => {
      upstreamHolder.ref = upstreamHolder.ref ?? ref<unknown>(undefined)
      return upstreamHolder.ref
    },
    singleValueExtractor: () => () => undefined
  }
})

const RangeEditorStub = defineComponent({
  name: 'RangeEditor',
  props: {
    modelValue: { type: Object, default: () => ({ min: 0, max: 1 }) },
    disabled: { type: Boolean, default: false },
    histogram: { type: Object, default: null },
    display: { type: String, default: '' }
  },

  emits: ['update:modelValue', 'editEnd'],
  template: `
    <div>
      <div data-testid="range-editor"
        :data-disabled="String(disabled)"
        :data-has-histogram="String(!!histogram)"
        :data-model="JSON.stringify(modelValue)"
        :data-display="display"
        @click="$emit('update:modelValue', { min: 5, max: 10 }); $emit('editEnd')"
      />
      <div data-testid="range-min-field"
        @click="$emit('update:modelValue', { ...modelValue, min: modelValue.min + 0.25 }); $emit('editEnd', 'min')"
      />
      <slot name="actions" />
    </div>
  `
})

function makeWidget(options: Partial<IWidgetRangeOptions> = {}): WidgetId {
  return registerTestWidget({
    name: 'range_w',
    type: 'range',
    value: { min: 0, max: 1 },
    options
  })
}

function setDisabled(id: WidgetId, disabled: boolean) {
  useWidgetValueStore().updateOptions(id, { disabled })
}

const WIDGET_NODE_LOCATOR = createNodeLocatorId(null, toNodeId(1))

function setUpstream(value: RangeValue | undefined) {
  if (!upstreamHolder.ref) upstreamHolder.ref = { value: undefined }
  upstreamHolder.ref.value = value
}

function renderWidget(
  widgetId: WidgetId,
  initialModel: RangeValue = { min: 0, max: 1 }
) {
  const value = ref<RangeValue>(initialModel)
  const Harness = defineComponent({
    components: { WidgetRange },
    setup: () => ({ value, widgetId }),
    template: '<WidgetRange v-model="value" :widget-id="widgetId" />'
  })
  const utils = render(Harness, {
    global: { plugins: [i18n], stubs: { RangeEditor: RangeEditorStub } }
  })
  return { ...utils, value, widgetId }
}

describe('WidgetRange', () => {
  beforeEach(() => {
    upstreamHolder.ref = null
    useNodeOutputStore().nodeOutputs = {}
  })

  describe('Value pass-through', () => {
    it('forwards modelValue to the RangeEditor', () => {
      renderWidget(makeWidget(), { min: 0.2, max: 0.8 })
      const el = screen.getByTestId('range-editor')
      expect(JSON.parse(el.dataset.model!)).toEqual({ min: 0.2, max: 0.8 })
    })

    it('propagates editor updates back to v-model', async () => {
      const { value } = renderWidget(makeWidget())
      const user = userEvent.setup()
      await user.click(screen.getByTestId('range-editor'))
      expect(value.value).toEqual({ min: 5, max: 10 })
    })

    it('forwards the display option to the RangeEditor', () => {
      renderWidget(makeWidget({ display: 'histogram' }))
      expect(screen.getByTestId('range-editor').dataset.display).toBe(
        'histogram'
      )
    })
  })

  describe('Disabled state', () => {
    it('passes disabled=true when widget.options.disabled is set', () => {
      renderWidget(makeWidget({ disabled: true }))
      expect(screen.getByTestId('range-editor').dataset.disabled).toBe('true')
    })

    it('passes disabled=false by default', () => {
      renderWidget(makeWidget())
      expect(screen.getByTestId('range-editor').dataset.disabled).toBe('false')
    })

    it('shows upstream value when disabled with a valid upstream', () => {
      setUpstream({ min: 0.3, max: 0.7 })
      renderWidget(makeWidget({ disabled: true }), { min: 0, max: 1 })
      const el = screen.getByTestId('range-editor')
      expect(JSON.parse(el.dataset.model!)).toEqual({ min: 0.3, max: 0.7 })
    })

    it('ignores upstream value when not disabled', () => {
      setUpstream({ min: 0.3, max: 0.7 })
      renderWidget(makeWidget(), {
        min: 0,
        max: 1
      })
      const el = screen.getByTestId('range-editor')
      expect(JSON.parse(el.dataset.model!)).toEqual({ min: 0, max: 1 })
    })
  })

  describe('Node history', () => {
    it('undoes and redoes an edit', async () => {
      const { value } = renderWidget(makeWidget())
      const user = userEvent.setup()
      await user.click(screen.getByTestId('range-editor'))

      await user.click(screen.getByRole('button', { name: 'Undo' }))
      expect(value.value).toEqual({ min: 0, max: 1 })

      await user.click(screen.getByRole('button', { name: 'Redo' }))
      expect(value.value).toEqual({ min: 5, max: 10 })
    })

    it('undoes consecutive changes to one field as a single step', async () => {
      const { value } = renderWidget(makeWidget())
      const user = userEvent.setup()
      await user.click(screen.getByTestId('range-min-field'))
      await user.click(screen.getByTestId('range-min-field'))
      expect(value.value.min).toBe(0.5)

      await user.click(screen.getByRole('button', { name: 'Undo' }))
      expect(value.value).toEqual({ min: 0, max: 1 })
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    })

    it('drops edits made before the upstream link replaced the range', async () => {
      const { value, widgetId } = renderWidget(makeWidget())
      const user = userEvent.setup()
      await user.click(screen.getByTestId('range-min-field'))
      setDisabled(widgetId, true)
      setUpstream({ min: 0.3, max: 0.7 })
      await nextTick()
      await nextTick()
      setDisabled(widgetId, false)
      await nextTick()
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()

      await user.click(screen.getByTestId('range-editor'))

      await user.click(screen.getByRole('button', { name: 'Undo' }))
      expect(value.value).toEqual({ min: 0.3, max: 0.7 })
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    })
  })

  describe('Histogram', () => {
    it('passes null histogram when no node output matches the widget node', () => {
      useNodeOutputStore().nodeOutputs = {
        other: { histogram_range_w: [1, 2, 3, 4] }
      }
      renderWidget(makeWidget())
      expect(screen.getByTestId('range-editor').dataset.hasHistogram).toBe(
        'false'
      )
    })

    it('passes a histogram when node output has a matching histogram entry', () => {
      useNodeOutputStore().nodeOutputs = {
        [WIDGET_NODE_LOCATOR]: { histogram_range_w: [1, 2, 3, 4] }
      }
      renderWidget(makeWidget())
      expect(screen.getByTestId('range-editor').dataset.hasHistogram).toBe(
        'true'
      )
    })

    it('treats an empty histogram array as null', () => {
      useNodeOutputStore().nodeOutputs = {
        [WIDGET_NODE_LOCATOR]: { histogram_range_w: [] }
      }
      renderWidget(makeWidget())
      expect(screen.getByTestId('range-editor').dataset.hasHistogram).toBe(
        'false'
      )
    })
  })
})
