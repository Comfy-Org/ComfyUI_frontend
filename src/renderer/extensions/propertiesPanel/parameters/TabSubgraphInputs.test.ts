import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { promoteValueWidgetViaSubgraphInput } from '@/core/graph/subgraph/promotionUtils'
import { promotedInputWidgets } from '@/core/graph/subgraph/promotedInputWidget'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@comfyorg/graph-model/widgetId'

import TabSubgraphInputs from './TabSubgraphInputs.vue'

vi.mock(import('@/services/litegraphService'))

const { StubWidgetComponent } = vi.hoisted(() => ({
  StubWidgetComponent: {
    name: 'StubWidget',
    props: ['widget', 'modelValue', 'nodeId', 'nodeType'],
    template: '<button type="button" :aria-label="widget.name" />'
  }
}))

vi.mock(
  import('@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'),
  () => ({
    getComponent: vi.fn(() => StubWidgetComponent),
    shouldExpand: () => false
  })
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        rename: 'Rename',
        more: 'More'
      },
      rightSidePanel: {
        inputs: 'Inputs',
        inputsNone: 'None',
        advancedInputs: 'Advanced Inputs',
        showInput: 'Show input',
        hideInput: 'Hide input',
        addFavorite: 'Favorite',
        removeFavorite: 'Unfavorite'
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
    visibility.surfaces.panel = 'never'

    renderPanel(panelHiddenHost)
    const panelHiddenRow = captured.rows.find(
      (row) => row.widget.name === 'seed'
    )

    expect({ connectedRow, panelHiddenRow }).toEqual({
      connectedRow: undefined,
      panelHiddenRow: undefined
    })
  })

  it('omits panel-hidden interior widgets from advanced inputs', () => {
    const subgraph = createTestSubgraph()
    const host = createTestSubgraphNode(subgraph)
    const sourceNode = new LGraphNode('Source')
    const hiddenWidget = sourceNode.addWidget(
      'text',
      'panel-hidden',
      '',
      () => {}
    )
    hiddenWidget.options.hideInPanel = true
    subgraph.add(sourceNode)

    renderPanel(host)

    expect(captured.rows.map(({ widget }) => widget.name)).not.toContain(
      'panel-hidden'
    )
  })

  it('does not expose a panel-suppressed promotion as a control in Advanced Inputs', async () => {
    const { host, sourceNode } = buildHostWithPromotedSeed()
    sourceNode.addWidget('number', 'steps', 20, () => {})
    const id = widgetId(host.rootGraph.id, host.id, 'seed')
    useWidgetValueStore().updateOptions(id, { hideInPanel: true })
    host.hideInput('seed')

    render(TabSubgraphInputs, {
      props: { node: host },
      global: {
        plugins: [i18n],
        stubs: { CollapseToggleButton: true }
      }
    })

    await userEvent.click(screen.getByText('Advanced Inputs'))

    expect(screen.getByRole('button', { name: 'steps' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'seed' })
    ).not.toBeInTheDocument()
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

  function buildNestedHostWithPromotedSeed(): {
    outerHost: SubgraphNode
    innerHost: SubgraphNode
  } {
    const innerSubgraph = createTestSubgraph()
    const innerHost = createTestSubgraphNode(innerSubgraph)
    const sourceNode = new LGraphNode('Sampler')
    const input = sourceNode.addInput('seed', 'INT')
    const seedWidget = sourceNode.addWidget('number', 'seed', 42, () => {})
    input.widget = { name: seedWidget.name }
    innerSubgraph.add(sourceNode)
    promoteValueWidgetViaSubgraphInput(innerHost, sourceNode, seedWidget)

    const outerSubgraph = createTestSubgraph()
    outerSubgraph.add(innerHost)
    const outerHost = createTestSubgraphNode(outerSubgraph)
    const graph = outerHost.graph as LGraph
    graph.add(outerHost)

    const innerHostInput = innerHost.inputs.at(0)
    if (!innerHostInput)
      throw new Error('Expected a promoted input on inner host')
    const nestedPromotedWidget = promotedInputWidgets(innerHost).find(
      (widget) => widget.name === innerHostInput.name
    )
    if (!nestedPromotedWidget)
      throw new Error('Expected a promoted widget on inner host')

    promoteValueWidgetViaSubgraphInput(
      outerHost,
      innerHost,
      nestedPromotedWidget
    )

    return { outerHost, innerHost }
  }

  it('does not copy an inner host Hide onto a shown outer host on reconfigure', () => {
    const { outerHost, innerHost } = buildNestedHostWithPromotedSeed()
    innerHost.hideInput('seed')

    outerHost.configure(outerHost.serialize())

    const outerId = outerHost.inputs.at(0)?.widgetId
    if (!outerId) throw new Error('Expected a promoted outer host widget')
    expect(outerHost.isInputHidden('seed')).toBe(false)
    expect(
      useWidgetValueStore().getWidgetVisibility(outerId)?.surfaces
    ).toEqual({ canvas: 'shown', vueNode: 'shown', panel: 'shown' })
  })

  it('hides a two-level nested promotion via Hide input and restores it via Show input', async () => {
    const { outerHost, innerHost } = buildNestedHostWithPromotedSeed()
    const store = useWidgetValueStore()
    const outerId = outerHost.inputs.at(0)?.widgetId
    const innerId = innerHost.inputs.at(0)?.widgetId
    if (!outerId || !innerId) throw new Error('Expected promoted host widgets')
    store.setValue(outerId, 7)
    store.setValue(innerId, 13)

    render(TabSubgraphInputs, {
      props: { node: outerHost },
      global: {
        plugins: [i18n],
        stubs: {
          CollapseToggleButton: true,
          EditableText: {
            props: ['modelValue'],
            template: '<span>{{ modelValue }}</span>'
          }
        }
      }
    })

    expect(
      screen.getByTestId('widget-actions-hide-input-button')
    ).toBeInTheDocument()
    expect(screen.queryByText('Advanced Inputs')).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByTestId('widget-actions-hide-input-button'))

    await user.click(await screen.findByText('Advanced Inputs'))
    expect(
      screen.queryByTestId('widget-actions-hide-input-button')
    ).not.toBeInTheDocument()
    expect(outerHost.isInputHidden('seed')).toBe(true)
    expect(store.getWidget(outerId)?.value).toBe(7)
    expect(store.getWidget(innerId)?.value).toBe(13)

    await user.click(await screen.findByTestId('widget-actions-menu-button'))
    const menu = await screen.findByRole('menu')
    await user.click(within(menu).getByRole('menuitem', { name: /Show input/ }))

    expect(
      await screen.findByTestId('widget-actions-hide-input-button')
    ).toBeInTheDocument()
    expect(screen.queryByText('Advanced Inputs')).not.toBeInTheDocument()
    expect(outerHost.isInputHidden('seed')).toBe(false)
    expect(store.getWidget(outerId)?.value).toBe(7)
    expect(store.getWidget(innerId)?.value).toBe(13)
  })
})
