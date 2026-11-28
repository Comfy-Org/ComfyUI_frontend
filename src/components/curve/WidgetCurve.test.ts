import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { registerTestWidget } from '@/renderer/extensions/vueNodes/widgets/components/widgetTestUtils'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

import type { CurveData } from '@comfyorg/graph-model/curve'
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
  const { computed, ref } = await import('vue')
  return {
    useUpstreamValue: (getLinkedUpstream: () => unknown) => {
      const upstream = (upstreamHolder.ref ??= ref<unknown>(undefined))
      return computed(() => (getLinkedUpstream() ? upstream.value : undefined))
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

function makeWidget({ disabled = false } = {}): WidgetId {
  return registerTestWidget({
    name: 'curve_w',
    type: 'curve',
    value: {
      points: [
        [0, 0],
        [1, 1]
      ],
      interpolation: 'monotone_cubic'
    },
    options: { disabled }
  })
}

function makeLinkableWidget() {
  const graph = new LGraph()
  vi.mocked(app).rootGraph = graph
  const source = new LGraphNode('Source')
  source.addOutput('curve', 'CURVE')
  graph.add(source)
  const target = new LGraphNode('Target')
  target.addInput('curve_w', 'CURVE', { widget: { name: 'curve_w' } })
  graph.add(target)
  const id = widgetId(graph.id, target.id, 'curve_w')
  useWidgetValueStore().registerWidget(id, {
    type: 'curve',
    value: {
      points: [
        [0, 0],
        [1, 1]
      ],
      interpolation: 'monotone_cubic'
    },
    options: {}
  })
  return {
    widgetId: id,
    link: () => source.connect(0, target, 0),
    unlink: () => target.disconnectInput(0)
  }
}

function setUpstream(value: CurveData | undefined) {
  if (!upstreamHolder.ref) upstreamHolder.ref = { value: undefined }
  upstreamHolder.ref.value = value
}

function renderWidget(
  widgetId: WidgetId,
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
    setup: () => ({ value, widgetId }),
    template: '<WidgetCurve v-model="value" :widget-id="widgetId" />'
  })
  const utils = render(Harness, {
    global: {
      plugins: [i18n],
      stubs: {
        CurveEditor: CurveEditorStub
      }
    }
  })
  return { ...utils, value, widgetId }
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
      renderWidget(makeWidget({ disabled: true }))
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
      const linkable = makeLinkableWidget()
      const { value } = renderWidget(linkable.widgetId, original)
      const user = userEvent.setup()
      await user.click(screen.getByTestId('curve-editor'))
      setUpstream(upstream)
      linkable.link()
      await nextTick()
      await nextTick()
      linkable.unlink()
      await nextTick()
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()

      await user.click(screen.getByTestId('curve-editor'))
      await user.click(screen.getByRole('button', { name: 'Undo' }))
      expect(value.value).toEqual(upstream)
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    })
  })

  describe('Disabled state + upstream', () => {
    it('uses the upstream curve while linked to an upstream node', () => {
      const upstream: CurveData = {
        points: [
          [0, 0],
          [0.5, 0.5],
          [1, 1]
        ],
        interpolation: 'linear'
      }
      setUpstream(upstream)
      const linkable = makeLinkableWidget()
      linkable.link()
      renderWidget(linkable.widgetId)
      const parsed = JSON.parse(
        screen.getByTestId('curve-editor').dataset.points!
      )
      expect(parsed).toEqual(upstream.points)
    })
  })
})
