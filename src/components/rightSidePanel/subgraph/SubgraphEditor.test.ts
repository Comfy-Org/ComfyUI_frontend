import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { graphToPrompt } from '@/utils/executionUtil'

import {
  getSourceNodeId,
  promoteValueWidgetViaSubgraphInput
} from '@/core/graph/subgraph/promotionUtils'
import SubgraphEditor from './SubgraphEditor.vue'

vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: vi.fn() })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      subgraphStore: {
        shown: 'Shown',
        hidden: 'Hidden',
        hideAll: 'Hide all',
        showAll: 'Show all',
        addRecommended: 'Add recommended'
      },
      rightSidePanel: {
        noneSearchDesc: 'No results'
      },
      g: {
        search: 'Search',
        searchPlaceholder: 'Search'
      }
    }
  }
})

describe('SubgraphEditor', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
  })

  it('renders preview exposures after promoted inputs without drag handles', () => {
    const subgraph = createTestSubgraph()
    const host = createTestSubgraphNode(subgraph)
    const firstNode = new LGraphNode('FirstNode')
    const secondNode = new LGraphNode('SecondNode')
    const previewNode = new LGraphNode('PreviewImage')
    previewNode.type = 'PreviewImage'
    subgraph.add(firstNode)
    subgraph.add(secondNode)
    subgraph.add(previewNode)

    const firstInput = firstNode.addInput('first', 'STRING')
    const firstWidget = firstNode.addWidget('text', 'first', '', () => {})
    firstInput.widget = { name: firstWidget.name }
    const secondInput = secondNode.addInput('second', 'STRING')
    const secondWidget = secondNode.addWidget('text', 'second', '', () => {})
    secondInput.widget = { name: secondWidget.name }
    promoteValueWidgetViaSubgraphInput(host, firstNode, firstWidget)
    promoteValueWidgetViaSubgraphInput(host, secondNode, secondWidget)
    usePreviewExposureStore().addExposure(
      subgraph.rootGraph.id,
      String(host.id),
      {
        sourceNodeId: String(previewNode.id),
        sourcePreviewName: '$$canvas-image-preview'
      }
    )
    useCanvasStore().selectedItems = [host]

    render(SubgraphEditor, {
      container: document.body.appendChild(document.createElement('div')),
      global: {
        plugins: [i18n],
        stubs: {
          DraggableList: {
            template:
              '<div data-testid="draggable-list"><slot drag-class="draggable-item" /></div>'
          }
        }
      }
    })

    const shown = screen.getByTestId('subgraph-editor-shown-section')
    expect(
      within(shown)
        .getAllByTestId('subgraph-widget-label')
        .map((el) => el.textContent?.trim())
    ).toEqual(['first', 'second', '$$canvas-image-preview'])
    expect(
      within(screen.getByTestId('draggable-list'))
        .getAllByTestId('subgraph-widget-label')
        .map((el) => el.textContent?.trim())
    ).toEqual(['first', 'second'])
    expect(
      within(shown).getAllByTestId('subgraph-widget-drag-handle')
    ).toHaveLength(2)
  })

  it('reorders node widgets from dragged promoted input order when widget names repeat', async () => {
    const subgraph = createTestSubgraph()
    const host = createTestSubgraphNode(subgraph)
    const firstNode = new LGraphNode('FirstNode')
    const secondNode = new LGraphNode('SecondNode')
    subgraph.add(firstNode)
    subgraph.add(secondNode)

    const firstInput = firstNode.addInput('seed', 'STRING')
    const firstWidget = firstNode.addWidget('text', 'seed', '', () => {})
    firstInput.widget = { name: firstWidget.name }
    const secondInput = secondNode.addInput('seed', 'STRING')
    const secondWidget = secondNode.addWidget('text', 'seed', '', () => {})
    secondInput.widget = { name: secondWidget.name }
    promoteValueWidgetViaSubgraphInput(host, firstNode, firstWidget)
    promoteValueWidgetViaSubgraphInput(host, secondNode, secondWidget)
    useCanvasStore().selectedItems = [host]

    render(SubgraphEditor, {
      container: document.body.appendChild(document.createElement('div')),
      global: {
        plugins: [i18n],
        stubs: {
          DraggableList: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: `
              <button
                data-testid="reverse-promoted-widgets"
                @click="$emit('update:modelValue', [...modelValue].reverse())"
              >
                <slot drag-class="draggable-item" />
              </button>
            `
          }
        }
      }
    })

    expect(host.widgets.map((widget) => getSourceNodeId(widget))).toEqual([
      String(firstNode.id),
      String(secondNode.id)
    ])

    await userEvent.click(screen.getByTestId('reverse-promoted-widgets'))

    expect(host.widgets.map((widget) => getSourceNodeId(widget))).toEqual([
      String(secondNode.id),
      String(firstNode.id)
    ])
  })

  it('rerenders promoted widgets in dragged input order', async () => {
    const subgraph = createTestSubgraph()
    const host = createTestSubgraphNode(subgraph)
    const firstNode = new LGraphNode('FirstNode')
    const secondNode = new LGraphNode('SecondNode')
    subgraph.add(firstNode)
    subgraph.add(secondNode)

    const firstInput = firstNode.addInput('first', 'STRING')
    const firstWidget = firstNode.addWidget('text', 'first', '', () => {})
    firstInput.widget = { name: firstWidget.name }
    const secondInput = secondNode.addInput('second', 'STRING')
    const secondWidget = secondNode.addWidget('text', 'second', '', () => {})
    secondInput.widget = { name: secondWidget.name }
    promoteValueWidgetViaSubgraphInput(host, firstNode, firstWidget)
    promoteValueWidgetViaSubgraphInput(host, secondNode, secondWidget)
    useCanvasStore().selectedItems = [host]

    render(SubgraphEditor, {
      container: document.body.appendChild(document.createElement('div')),
      global: {
        plugins: [i18n],
        stubs: {
          DraggableList: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: `
              <button
                data-testid="reverse-promoted-widgets"
                @click="$emit('update:modelValue', [...modelValue].reverse())"
              >
                <slot drag-class="draggable-item" />
              </button>
            `
          }
        }
      }
    })

    expect(
      within(screen.getByTestId('subgraph-editor-shown-section'))
        .getAllByTestId('subgraph-widget-label')
        .map((el) => el.textContent?.trim())
    ).toEqual(['first', 'second'])

    await userEvent.click(screen.getByTestId('reverse-promoted-widgets'))

    expect(
      within(screen.getByTestId('subgraph-editor-shown-section'))
        .getAllByTestId('subgraph-widget-label')
        .map((el) => el.textContent?.trim())
    ).toEqual(['second', 'first'])
  })

  it('serializes promoted widget values in dragged input order', async () => {
    const subgraph = createTestSubgraph()
    const host = createTestSubgraphNode(subgraph)
    const firstNode = new LGraphNode('FirstNode')
    const secondNode = new LGraphNode('SecondNode')
    subgraph.add(firstNode)
    subgraph.add(secondNode)

    const firstInput = firstNode.addInput('first', 'STRING')
    const firstWidget = firstNode.addWidget('text', 'first', '', () => {})
    firstInput.widget = { name: firstWidget.name }
    const secondInput = secondNode.addInput('second', 'STRING')
    const secondWidget = secondNode.addWidget('text', 'second', '', () => {})
    secondInput.widget = { name: secondWidget.name }
    promoteValueWidgetViaSubgraphInput(host, firstNode, firstWidget)
    promoteValueWidgetViaSubgraphInput(host, secondNode, secondWidget)
    host.widgets[0].value = 'first value'
    host.widgets[1].value = 'second value'
    useCanvasStore().selectedItems = [host]

    render(SubgraphEditor, {
      container: document.body.appendChild(document.createElement('div')),
      global: {
        plugins: [i18n],
        stubs: {
          DraggableList: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: `
              <button
                data-testid="reverse-promoted-widgets"
                @click="$emit('update:modelValue', [...modelValue].reverse())"
              >
                <slot drag-class="draggable-item" />
              </button>
            `
          }
        }
      }
    })

    await userEvent.click(screen.getByTestId('reverse-promoted-widgets'))

    expect(host.serialize().widgets_values).toEqual([
      'second value',
      'first value'
    ])
  })

  it('sends dragged text input values to the matching prompt targets', async () => {
    const subgraph = createTestSubgraph()
    const host = createTestSubgraphNode(subgraph)
    host.comfyClass = 'Subgraph'
    const graph = host.graph!
    graph.add(host)
    const firstNode = new LGraphNode('FirstNode')
    firstNode.comfyClass = 'FirstNode'
    const secondNode = new LGraphNode('SecondNode')
    secondNode.comfyClass = 'SecondNode'
    subgraph.add(firstNode)
    subgraph.add(secondNode)

    const firstInput = firstNode.addInput('text', 'STRING')
    const firstWidget = firstNode.addWidget('text', 'text', '', () => {})
    firstInput.widget = { name: firstWidget.name }
    const secondInput = secondNode.addInput('text', 'STRING')
    const secondWidget = secondNode.addWidget('text', 'text', '', () => {})
    secondInput.widget = { name: secondWidget.name }
    promoteValueWidgetViaSubgraphInput(host, firstNode, firstWidget)
    promoteValueWidgetViaSubgraphInput(host, secondNode, secondWidget)
    host.widgets[0].value = 'first value'
    host.widgets[1].value = 'second value'
    useCanvasStore().selectedItems = [host]

    render(SubgraphEditor, {
      container: document.body.appendChild(document.createElement('div')),
      global: {
        plugins: [i18n],
        stubs: {
          DraggableList: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: `
              <button
                data-testid="reverse-promoted-widgets"
                @click="$emit('update:modelValue', [...modelValue].reverse())"
              >
                <slot drag-class="draggable-item" />
              </button>
            `
          }
        }
      }
    })

    await userEvent.click(screen.getByTestId('reverse-promoted-widgets'))

    const { output } = await graphToPrompt(graph)

    expect(output[`${host.id}:${firstNode.id}`].inputs.text).toBe('first value')
    expect(output[`${host.id}:${secondNode.id}`].inputs.text).toBe(
      'second value'
    )
  })
})
