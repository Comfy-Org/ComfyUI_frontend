import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { toNodeId } from '@/types/nodeId'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import type { CurveData } from './types'
import WidgetCurve from './WidgetCurve.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      curveWidget: {
        linear: 'Linear',
        monotone_cubic: 'Smooth',
        step: 'Step'
      },
      widgetHistory: { undo: 'Undo', redo: 'Redo' }
    }
  }
})

vi.mock(import('@/scripts/app'))

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

const CurveEditorStub = defineComponent({
  name: 'CurveEditor',
  props: {
    modelValue: { type: Array, default: () => [] },
    disabled: { type: Boolean, default: false },
    interpolation: { type: String, default: '' },
    histogram: { type: Object, default: null }
  },
  emits: ['update:modelValue', 'editEnd'],
  template: `
    <div data-testid="curve-editor"
      :data-disabled="String(disabled)"
      :data-interpolation="interpolation"
      :data-has-histogram="String(!!histogram)"
      :data-points="JSON.stringify(modelValue)"
      @click="$emit('update:modelValue', [[0,0],[0.5,1],[1,0]]); $emit('editEnd')"
    />
  `
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
    nodeLocatorId: createNodeLocatorId(null, toNodeId('1')),
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
  const currentWidget = ref(widget)
  const Harness = defineComponent({
    components: { WidgetCurve },
    setup: () => ({ value, currentWidget }),
    template: '<WidgetCurve v-model="value" :widget="currentWidget" />'
  })
  const utils = render(Harness, {
    global: {
      plugins: [i18n],
      stubs: {
        CurveEditor: CurveEditorStub
      }
    }
  })
  return { ...utils, value, currentWidget }
}

describe('WidgetCurve', () => {
  beforeEach(() => {
    upstreamHolder.ref = null
    useNodeOutputStore().nodeOutputs = {}
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
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('hides the Select when disabled', () => {
      renderWidget(makeWidget({ options: { disabled: true } }))
      expect(screen.queryByRole('combobox')).toBeNull()
    })

    it('updates interpolation in v-model when Select emits a change', async () => {
      const { value } = renderWidget(makeWidget())
      const user = userEvent.setup()
      await user.click(screen.getByRole('combobox'))
      await user.click(await screen.findByRole('option', { name: 'Linear' }))
      expect(value.value.interpolation).toBe('linear')
    })

    it('preserves points when interpolation changes', async () => {
      const original: CurveData = {
        points: [
          [0, 0],
          [0.3, 0.8],
          [1, 1]
        ],
        interpolation: 'monotone_cubic'
      }
      const { value } = renderWidget(makeWidget(), original)
      const user = userEvent.setup()
      await user.click(screen.getByRole('combobox'))
      await user.click(await screen.findByRole('option', { name: 'Linear' }))
      expect(value.value.points).toEqual(original.points)
    })
  })

  describe('Node history', () => {
    const original: CurveData = {
      points: [
        [0, 0],
        [1, 1]
      ],
      interpolation: 'monotone_cubic'
    }

    it('undoes and redoes a point edit', async () => {
      const { value } = renderWidget(makeWidget(), original)
      const user = userEvent.setup()
      await user.click(screen.getByTestId('curve-editor'))
      const edited = value.value

      await user.click(screen.getByRole('button', { name: 'Undo' }))
      expect(value.value).toEqual(original)

      await user.click(screen.getByRole('button', { name: 'Redo' }))
      expect(value.value).toEqual(edited)
    })

    it('undoes an interpolation change', async () => {
      const { value } = renderWidget(makeWidget(), original)
      const user = userEvent.setup()
      await user.click(screen.getByRole('combobox'))
      await user.click(await screen.findByRole('option', { name: 'Linear' }))

      await user.click(screen.getByRole('button', { name: 'Undo' }))
      expect(value.value.interpolation).toBe('monotone_cubic')
    })

    it('drops edits made before the upstream link replaced the curve', async () => {
      const upstream: CurveData = {
        points: [
          [0, 0.5],
          [1, 0.5]
        ],
        interpolation: 'linear'
      }
      const { value, currentWidget } = renderWidget(makeWidget(), original)
      const user = userEvent.setup()
      await user.click(screen.getByTestId('curve-editor'))
      currentWidget.value = makeWidget({ options: { disabled: true } })
      setUpstream(upstream)
      await nextTick()
      await nextTick()
      currentWidget.value = makeWidget()
      await nextTick()
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()

      await user.click(screen.getByTestId('curve-editor'))
      await user.click(screen.getByRole('button', { name: 'Undo' }))
      expect(value.value).toEqual(upstream)
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
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
          linkedUpstream: { nodeId: toNodeId('n1') }
        })
      )
      const parsed = JSON.parse(
        screen.getByTestId('curve-editor').dataset.points!
      )
      expect(parsed).toEqual(upstream.points)
    })
  })
})
