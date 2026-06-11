import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'

import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import { promoteValueWidgetViaSubgraphInput } from '@/core/graph/subgraph/promotionUtils'
import SubgraphEditor from './SubgraphEditor.vue'
import type { ComponentProps } from 'vue-component-type-helpers'
import type DraggableList from '@/components/common/DraggableList.vue'

type DraggableListProps = ComponentProps<typeof DraggableList>
type PromotedRow =
  DraggableListProps['modelValue'] extends Array<infer T> ? T : never

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

  it('updates rendered order when promoted widgets are reordered', async () => {
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

    let listSetter: ((value: PromotedRow[]) => void) | undefined
    const draggableListStub = {
      props: ['modelValue'],
      emits: ['update:modelValue'],
      setup(
        _: unknown,
        {
          emit,
          slots
        }: {
          emit: (event: string, ...args: unknown[]) => void
          slots: { default?: (props: { dragClass: string }) => unknown }
        }
      ) {
        listSetter = (value) => emit('update:modelValue', value)
        return () => slots.default?.({ dragClass: 'draggable-item' })
      }
    }
    render(SubgraphEditor, {
      container: document.body.appendChild(document.createElement('div')),
      global: {
        plugins: [i18n],
        stubs: { DraggableList: draggableListStub }
      }
    })
    await nextTick()

    const shown = screen.getByTestId('subgraph-editor-shown-section')
    expect(
      within(shown)
        .getAllByTestId('subgraph-widget-label')
        .map((el) => el.textContent?.trim())
    ).toEqual(['first', 'second'])

    const promotedWidgets = host.widgets.filter(isPromotedWidgetView)
    const reversed = [
      { kind: 'promoted', node: secondNode, widget: promotedWidgets[1] },
      { kind: 'promoted', node: firstNode, widget: promotedWidgets[0] }
    ] as PromotedRow[]
    listSetter?.(reversed)
    await nextTick()

    expect(
      within(shown)
        .getAllByTestId('subgraph-widget-label')
        .map((el) => el.textContent?.trim())
    ).toEqual(['second', 'first'])
  })

  it('demotes linked promoted widgets when "Hide all" is clicked', async () => {
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
            template:
              '<div data-testid="draggable-list"><slot drag-class="draggable-item" /></div>'
          }
        }
      }
    })

    expect(host.widgets.filter(isPromotedWidgetView)).toHaveLength(2)

    const shown = screen.getByTestId('subgraph-editor-shown-section')
    const hideAllLink = within(shown).getByText('Hide all')
    await userEvent.click(hideAllLink)

    expect(host.widgets.filter(isPromotedWidgetView)).toHaveLength(0)
  })

  it('removes the exposure when a preview row without a real source widget is demoted', async () => {
    const subgraph = createTestSubgraph()
    const host = createTestSubgraphNode(subgraph)
    const orphanedSourceNode = new LGraphNode('OrphanedNode')
    orphanedSourceNode.type = 'OrphanedNode'
    subgraph.add(orphanedSourceNode)

    const previewStore = usePreviewExposureStore()
    previewStore.addExposure(subgraph.rootGraph.id, String(host.id), {
      sourceNodeId: String(orphanedSourceNode.id),
      sourcePreviewName: '$$canvas-image-preview'
    })

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

    expect(
      previewStore.getExposures(subgraph.rootGraph.id, String(host.id))
    ).toHaveLength(1)

    const shown = screen.getByTestId('subgraph-editor-shown-section')
    const toggleButton = within(shown).getByTestId('subgraph-widget-toggle')
    await userEvent.click(toggleButton)

    expect(
      previewStore.getExposures(subgraph.rootGraph.id, String(host.id))
    ).toHaveLength(0)
  })
})
