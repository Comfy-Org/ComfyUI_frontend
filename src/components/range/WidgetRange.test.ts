/* eslint-disable vue/one-component-per-file */
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

import type {
  IWidgetRangeOptions,
  RangeValue
} from '@/lib/litegraph/src/types/widgets'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const upstreamHolder = vi.hoisted(() => ({
  ref: null as { value: unknown } | null
}))

vi.mock('@/composables/useUpstreamValue', async () => {
  const { ref } = await import('vue')
  return {
    useUpstreamValue: () => {
      upstreamHolder.ref = upstreamHolder.ref ?? ref<unknown>(undefined)
      return upstreamHolder.ref
    },
    singleValueExtractor: () => () => undefined
  }
})

const outputsHolder = vi.hoisted(() => ({
  nodeOutputs: {} as Record<string, unknown>
}))

vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => outputsHolder
}))

import WidgetRange from './WidgetRange.vue'

const RangeEditorStub = defineComponent({
  name: 'RangeEditor',
  props: {
    modelValue: { type: Object, default: () => ({ min: 0, max: 1 }) },
    disabled: { type: Boolean, default: false },
    histogram: { type: Object, default: null },
    display: { type: String, default: '' }
  },
  // eslint-disable-next-line vue/no-unused-emit-declarations
  emits: ['update:modelValue'],
  template: `
    <div data-testid="range-editor"
      :data-disabled="String(disabled)"
      :data-has-histogram="String(!!histogram)"
      :data-model="JSON.stringify(modelValue)"
      :data-display="display"
      @click="$emit('update:modelValue', { min: 5, max: 10 })"
    />
  `
})

function makeWidget(
  options: Partial<IWidgetRangeOptions> = {},
  widgetOverrides: Partial<
    SimplifiedWidget<RangeValue, IWidgetRangeOptions>
  > = {}
): SimplifiedWidget<RangeValue, IWidgetRangeOptions> {
  return {
    name: 'range_w',
    type: 'range',
    value: { min: 0, max: 1 },
    options: options as IWidgetRangeOptions,
    ...widgetOverrides
  } as SimplifiedWidget<RangeValue, IWidgetRangeOptions>
}

function setUpstream(value: RangeValue | undefined) {
  if (!upstreamHolder.ref) upstreamHolder.ref = { value: undefined }
  upstreamHolder.ref.value = value
}

function renderWidget(
  widget: SimplifiedWidget<RangeValue, IWidgetRangeOptions>,
  initialModel: RangeValue = { min: 0, max: 1 }
) {
  const value = ref<RangeValue>(initialModel)
  const Harness = defineComponent({
    components: { WidgetRange },
    setup: () => ({ value, widget }),
    template: '<WidgetRange v-model="value" :widget="widget" />'
  })
  const utils = render(Harness, {
    global: { stubs: { RangeEditor: RangeEditorStub } }
  })
  return { ...utils, value }
}

describe('WidgetRange', () => {
  beforeEach(() => {
    upstreamHolder.ref = null
    outputsHolder.nodeOutputs = {}
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
      renderWidget(
        makeWidget({ disabled: true } as IWidgetRangeOptions, {
          linkedUpstream: { nodeId: 'n1' }
        }),
        { min: 0, max: 1 }
      )
      const el = screen.getByTestId('range-editor')
      expect(JSON.parse(el.dataset.model!)).toEqual({ min: 0.3, max: 0.7 })
    })

    it('ignores upstream value when not disabled', () => {
      setUpstream({ min: 0.3, max: 0.7 })
      renderWidget(makeWidget({}, { linkedUpstream: { nodeId: 'n1' } }), {
        min: 0,
        max: 1
      })
      const el = screen.getByTestId('range-editor')
      expect(JSON.parse(el.dataset.model!)).toEqual({ min: 0, max: 1 })
    })
  })

  describe('Histogram', () => {
    it('passes null histogram when nodeLocatorId is absent', () => {
      renderWidget(makeWidget())
      expect(screen.getByTestId('range-editor').dataset.hasHistogram).toBe(
        'false'
      )
    })

    it('passes a histogram when node output has a matching histogram entry', () => {
      outputsHolder.nodeOutputs = {
        loc1: { histogram_range_w: [1, 2, 3, 4] }
      }
      renderWidget(makeWidget({}, { nodeLocatorId: 'loc1' }))
      expect(screen.getByTestId('range-editor').dataset.hasHistogram).toBe(
        'true'
      )
    })

    it('treats an empty histogram array as null', () => {
      outputsHolder.nodeOutputs = {
        loc1: { histogram_range_w: [] }
      }
      renderWidget(makeWidget({}, { nodeLocatorId: 'loc1' }))
      expect(screen.getByTestId('range-editor').dataset.hasHistogram).toBe(
        'false'
      )
    })
  })
})
