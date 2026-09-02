import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { promoteValueWidgetViaSubgraphInput } from '@/core/graph/subgraph/promotionUtils'
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
  messages: { en: { rightSidePanel: { inputs: 'Inputs', inputsNone: 'None' } } }
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

  it('omits promoted widgets hidden by connections or panel visibility', () => {
    const { host: connectedHost } = buildHostWithPromotedSeed()
    const graph = connectedHost.graph as LGraph
    const outerSource = new LGraphNode('Outer Source')
    outerSource.addOutput('seed', 'INT')
    graph.add(outerSource)
    outerSource.connect(0, connectedHost, 0)

    renderPanel(connectedHost)
    const connectedRow = captured.rows.find((row) => row.widget.name === 'seed')

    const { host: panelHiddenHost } = buildHostWithPromotedSeed()
    const id = widgetId(
      panelHiddenHost.rootGraph.id,
      panelHiddenHost.id,
      'seed'
    )
    const visibility = useWidgetValueStore().getWidgetVisibility(id)
    if (!visibility) throw new Error('Missing promoted widget visibility')
    visibility.display.panel = 'never'

    renderPanel(panelHiddenHost)
    const panelHiddenRow = captured.rows.find(
      (row) => row.widget.name === 'seed'
    )

    expect({ connectedRow, panelHiddenRow }).toEqual({
      connectedRow: undefined,
      panelHiddenRow: undefined
    })
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
})
