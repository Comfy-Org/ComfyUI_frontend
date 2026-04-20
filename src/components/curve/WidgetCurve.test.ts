/* eslint-disable vue/one-component-per-file */
/* eslint-disable vue/no-reserved-component-names */
/* eslint-disable vue/no-unused-emit-declarations */
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      curveWidget: {
        linear: 'Linear',
        monotone_cubic: 'Smooth',
        step: 'Step'
      }
    }
  }
})

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

import WidgetCurve from './WidgetCurve.vue'
import type { CurveData } from './types'

const CurveEditorStub = defineComponent({
  name: 'CurveEditor',
  props: {
    modelValue: { type: Array, default: () => [] },
    disabled: { type: Boolean, default: false },
    interpolation: { type: String, default: '' },
    histogram: { type: Object, default: null }
  },
  emits: ['update:modelValue'],
  template: `
    <div data-testid="curve-editor"
      :data-disabled="String(disabled)"
      :data-interpolation="interpolation"
      :data-has-histogram="String(!!histogram)"
      :data-points="JSON.stringify(modelValue)"
      @click="$emit('update:modelValue', [[0,0],[0.5,1],[1,0]])"
    />
  `
})

const SelectStub = defineComponent({
  name: 'Select',
  props: { modelValue: { type: String, default: '' } },
  emits: ['update:modelValue'],
  template: `
    <div data-testid="interp-select" :data-value="modelValue">
      <button
        data-testid="select-linear"
        @click="$emit('update:modelValue', 'linear')"
      >linear</button>
      <slot />
    </div>
  `
})
const Passthrough = defineComponent({
  name: 'SelectPassthrough',
  template: '<slot />'
})

function makeWidget(
  overrides: Partial<SimplifiedWidget<CurveData>> = {}
): SimplifiedWidget<CurveData> {
  return {
    name: 'curve_w',
    type: 'curve',
    value: {
      points: [
        [0, 0],
        [1, 1]
      ],
      interpolation: 'monotone_cubic'
    },
    options: {},
    ...overrides
  } as unknown as SimplifiedWidget<CurveData>
}

function setUpstream(value: CurveData | undefined) {
  if (!upstreamHolder.ref) upstreamHolder.ref = { value: undefined }
  upstreamHolder.ref.value = value
}

function renderWidget(
  widget: SimplifiedWidget<CurveData>,
  initialModel: CurveData = {
    points: [
      [0, 0],
      [1, 1]
    ],
    interpolation: 'monotone_cubic'
  }
) {
  const value = ref<CurveData>(initialModel)
  const Harness = defineComponent({
    components: { WidgetCurve },
    setup: () => ({ value, widget }),
    template: '<WidgetCurve v-model="value" :widget="widget" />'
  })
  const utils = render(Harness, {
    global: {
      plugins: [i18n],
      stubs: {
        CurveEditor: CurveEditorStub,
        Select: SelectStub,
        SelectContent: Passthrough,
        SelectTrigger: Passthrough,
        SelectValue: Passthrough,
        SelectItem: Passthrough
      }
    }
  })
  return { ...utils, value }
}

describe('WidgetCurve', () => {
  beforeEach(() => {
    upstreamHolder.ref = null
    outputsHolder.nodeOutputs = {}
  })

  describe('Point forwarding', () => {
    it('forwards model points to CurveEditor', () => {
      renderWidget(makeWidget(), {
        points: [
          [0, 0],
          [0.5, 0.2],
          [1, 1]
        ],
        interpolation: 'monotone_cubic'
      })
      const parsed = JSON.parse(
        screen.getByTestId('curve-editor').dataset.points!
      )
      expect(parsed).toEqual([
        [0, 0],
        [0.5, 0.2],
        [1, 1]
      ])
    })

    it('updates v-model when CurveEditor emits new points', async () => {
      const { value } = renderWidget(makeWidget())
      const user = userEvent.setup()
      await user.click(screen.getByTestId('curve-editor'))
      expect(value.value.points).toEqual([
        [0, 0],
        [0.5, 1],
        [1, 0]
      ])
    })

    it('preserves interpolation when points change', async () => {
      const { value } = renderWidget(makeWidget(), {
        points: [
          [0, 0],
          [1, 1]
        ],
        interpolation: 'linear'
      })
      const user = userEvent.setup()
      await user.click(screen.getByTestId('curve-editor'))
      expect(value.value.interpolation).toBe('linear')
    })
  })

  describe('Interpolation select', () => {
    it('shows the Select when not disabled', () => {
      renderWidget(makeWidget())
      expect(screen.getByTestId('interp-select')).toBeInTheDocument()
    })

    it('hides the Select when disabled', () => {
      renderWidget(makeWidget({ options: { disabled: true } }))
      expect(screen.queryByTestId('interp-select')).toBeNull()
    })

    it('updates interpolation in v-model when Select emits a change', async () => {
      const { value } = renderWidget(makeWidget())
      const user = userEvent.setup()
      await user.click(screen.getByTestId('select-linear'))
      expect(value.value.interpolation).toBe('linear')
    })

    it('preserves points when interpolation changes', async () => {
      const original = {
        points: [
          [0, 0],
          [0.3, 0.8],
          [1, 1]
        ],
        interpolation: 'monotone_cubic' as const
      }
      const { value } = renderWidget(makeWidget(), original)
      const user = userEvent.setup()
      await user.click(screen.getByTestId('select-linear'))
      expect(value.value.points).toEqual(original.points)
    })
  })

  describe('Disabled state + upstream', () => {
    it('uses upstream curve when disabled and upstream is available', () => {
      const upstream: CurveData = {
        points: [
          [0, 0],
          [0.5, 0.5],
          [1, 1]
        ],
        interpolation: 'linear'
      }
      setUpstream(upstream)
      renderWidget(
        makeWidget({
          options: { disabled: true },
          linkedUpstream: { nodeId: 'n1' }
        })
      )
      const parsed = JSON.parse(
        screen.getByTestId('curve-editor').dataset.points!
      )
      expect(parsed).toEqual(upstream.points)
    })
  })
})
