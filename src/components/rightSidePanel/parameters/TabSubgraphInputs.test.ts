import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import {
  demoteWidget,
  promoteValueWidgetViaSubgraphInput,
  promoteWidget
} from '@/core/graph/subgraph/promotionUtils'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

import TabSubgraphInputs from './TabSubgraphInputs.vue'

vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: vi.fn() })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      rightSidePanel: {
        inputs: 'Inputs',
        inputsNone: 'None',
        advancedInputs: 'Advanced Inputs'
      }
    }
  }
})

const captured: { rows: { node: LGraphNode; widget: IBaseWidget }[] } = {
  rows: []
}

const SectionWidgetsStub = {
  props: ['widgets', 'node', 'host'],
  setup(props: Record<string, unknown>) {
    captured.rows = props.widgets as {
      node: LGraphNode
      widget: IBaseWidget
    }[]
    return () => null
  }
}

function buildHostWithPromotedSeed(): {
  host: SubgraphNode
  sourceNode: LGraphNode
} {
  const subgraph = createTestSubgraph()
  const host = createTestSubgraphNode(subgraph)
  const graph = host.graph as LGraph
  graph.add(host)

  const sourceNode = new LGraphNode('Sampler')
  const input = sourceNode.addInput('seed', 'INT')
  const seedWidget = sourceNode.addWidget('number', 'seed', 42, () => {})
  input.widget = { name: seedWidget.name }
  subgraph.add(sourceNode)

  promoteValueWidgetViaSubgraphInput(host, sourceNode, seedWidget)
  return { host, sourceNode }
}

function renderPanel(node: SubgraphNode) {
  return render(TabSubgraphInputs, {
    props: { node },
    global: {
      plugins: [i18n],
      stubs: {
        SectionWidgets: SectionWidgetsStub,
        PanelSearchHeader: true,
        CollapseToggleButton: true
      }
    }
  })
}

describe('TabSubgraphInputs', () => {
  beforeEach(() => {
    captured.rows = []
  })

  it('lists a subgraph node promoted widget as a store-backed parameter row', () => {
    const { host } = buildHostWithPromotedSeed()

    renderPanel(host)

    const seedRow = captured.rows.find((row) => row.widget.name === 'seed')
    expect(seedRow).toBeDefined()
    expect(seedRow?.node.id).toBe(host.id)
    expect(seedRow?.widget.type).toBe('number')
    expect(seedRow?.widget.widgetId).toBe(
      widgetId(host.rootGraph.id, host.id, 'seed')
    )
    expect(seedRow?.widget.value).toBe(42)
  })

  it('reflects the current host widget value from the store', () => {
    const { host } = buildHostWithPromotedSeed()
    const id = widgetId(host.rootGraph.id, host.id, 'seed')
    useWidgetValueStore().setValue(id, 7)

    renderPanel(host)

    const seedRow = captured.rows.find((row) => row.widget.name === 'seed')
    expect(seedRow?.widget.value).toBe(7)
  })

  it('reflects value changes through the same descriptor without rebuilding it', () => {
    const { host } = buildHostWithPromotedSeed()
    renderPanel(host)

    const seedRow = captured.rows.find((row) => row.widget.name === 'seed')!
    expect(seedRow.widget.value).toBe(42)

    // A value edit must not require a new descriptor object: the same row
    // reflects the store change via its live getter, keeping render keys stable.
    useWidgetValueStore().setValue(
      widgetId(host.rootGraph.id, host.id, 'seed'),
      100
    )
    expect(seedRow.widget.value).toBe(100)
  })

  it('shows a widget in Advanced Inputs immediately after Hide input, and lets it be re-shown', async () => {
    const { host, sourceNode } = buildHostWithPromotedSeed()
    const seedWidget = sourceNode.widgets?.find((w) => w.name === 'seed')
    if (!seedWidget) throw new Error('Missing seed widget')

    const AdvancedAwareSectionWidgetsStub = {
      props: {
        widgets: { type: Array, default: () => [] },
        showNodeName: { type: Boolean, default: false }
      },
      setup(props: Record<string, unknown>) {
        return () =>
          h(
            'div',
            {
              'data-testid': props.showNodeName
                ? 'advanced-inputs-section'
                : 'main-inputs-section'
            },
            (props.widgets as { widget: IBaseWidget }[]).map((row) =>
              h('span', row.widget.name)
            )
          )
      }
    }

    render(TabSubgraphInputs, {
      props: { node: host },
      global: {
        plugins: [i18n],
        stubs: {
          SectionWidgets: AdvancedAwareSectionWidgetsStub,
          PanelSearchHeader: true,
          CollapseToggleButton: true
        }
      }
    })

    expect(screen.queryByTestId('advanced-inputs-section')).toBeNull()

    demoteWidget(sourceNode, seedWidget, [host])
    await nextTick()

    expect(screen.getByTestId('advanced-inputs-section').textContent).toContain(
      'seed'
    )

    promoteWidget(sourceNode, seedWidget, [host])
    await nextTick()

    expect(screen.queryByTestId('advanced-inputs-section')).toBeNull()
  })
})
