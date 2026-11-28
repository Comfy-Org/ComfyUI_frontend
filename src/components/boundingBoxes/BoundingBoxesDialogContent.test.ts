import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/vue'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

vi.mock(import('@/composables/auth/useCurrentUser'))
import { createI18n } from 'vue-i18n'

import BoundingBoxesDialogContent from './BoundingBoxesDialogContent.vue'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { openBoundingBoxesDialog } from './boundingBoxesDialog'
import messages from '@/locales/en/main.json'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useDialogStore } from '@/stores/dialogStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { BoundingBox } from '@comfyorg/graph-model/boundingBoxes'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

vi.mock(import('@/scripts/app'))

vi.mock<unknown>(import('./BoundingBoxesDialogHeader.vue'), async () => {
  await new Promise((resolve) => setTimeout(resolve, 50))
  const { defineComponent, h } = await import('vue')
  const { BOUNDING_BOXES_HEADER_ACTIONS_ID } =
    await import('./boundingBoxesHeaderActionsId')
  return {
    default: defineComponent(
      () => () =>
        h('div', [
          h('div', { id: BOUNDING_BOXES_HEADER_ACTIONS_ID, role: 'group' })
        ])
    )
  }
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: messages.g,
      widgetHistory: messages.widgetHistory,
      boundingBoxes: messages.boundingBoxes,
      palette: { swatchTitle: 'Edit', addColor: 'Add' }
    }
  }
})

function addBoxesNode(value: BoundingBox[] = [], callback = () => {}) {
  const graph = app.rootGraph
  const node = new LGraphNode('BoundingBoxes')
  node.addWidget('number', 'width', 512, () => {})
  node.addWidget('number', 'height', 512, () => {})
  node.addWidget('boundingboxes', 'bboxes', value, callback)
  graph.add(node)
  return { graph, node, widgetId: widgetId(graph.id, node.id, 'bboxes') }
}

const box = (desc: string): BoundingBox => ({
  x: 64,
  y: 64,
  width: 256,
  height: 256,
  metadata: { type: 'obj', text: '', desc, palette: ['#ff0000'] }
})

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

describe('openBoundingBoxesDialog', () => {
  it('shows the editor toolbar in the header even when the header module loads last', async () => {
    const { node, widgetId } = addBoxesNode([box('a cat')])
    render(GlobalDialog, { global: { plugins: [i18n] } })
    openBoundingBoxesDialog(node.id, widgetId)

    const header = await screen.findByRole('group')
    await waitFor(() =>
      expect(
        within(header).getByRole('button', { name: 'Clear all' })
      ).toBeInTheDocument()
    )
  })

  it('opens a maximized dialog editing the given widget', () => {
    const { node, widgetId } = addBoxesNode()
    openBoundingBoxesDialog(node.id, widgetId)

    const options = vi.mocked(useDialogStore().showDialog).mock.calls[0][0]
    expect(options.key).toBe('global-bounding-boxes-editor')
    expect(options.props).toMatchObject({ nodeId: node.id, widgetId })
    expect(options.dialogComponentProps).toMatchObject({
      maximized: true,
      dismissOnPointerDownOutside: false
    })

    const { props } = options
    assert(props && 'close' in props && typeof props.close === 'function')
    props.close()
    expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
      key: 'global-bounding-boxes-editor'
    })
  })
})

describe('BoundingBoxesDialogContent', () => {
  function renderContent(widgetId: WidgetId, nodeId: NodeId) {
    const target = document.createElement('div')
    target.id = 'bounding-boxes-header-actions'
    document.body.appendChild(target)
    onTestFinished(() => target.remove())

    const close = vi.fn()
    const { unmount } = render(BoundingBoxesDialogContent, {
      props: { nodeId, widgetId, close },
      global: { plugins: [i18n] }
    })
    return { close, unmount }
  }

  function renderForNewNode(value: BoundingBox[] = [box('a cat')]) {
    const callback = vi.fn()
    const { graph, node, widgetId } = addBoxesNode(value, callback)
    return { graph, node, callback, ...renderContent(widgetId, node.id) }
  }

  function reconfigure(graph: LGraph) {
    graph.events.dispatch('configuring', {
      data: graph.serialize(),
      clearGraph: true
    })
  }

  it('edits the boxes stored on the node widget', () => {
    renderForNewNode()

    expect(screen.getByDisplayValue('a cat')).toBeTruthy()
  })

  it('writes edits back to the live widget', async () => {
    const { node, callback } = renderForNewNode()
    await fireEvent.update(screen.getByDisplayValue('a cat'), 'a dog')

    expect(callback).toHaveBeenLastCalledWith(
      [box('a dog')],
      expect.anything(),
      node
    )
    expect(node.widgets?.find((w) => w.name === 'bboxes')?.value).toEqual([
      box('a dog')
    ])
  })

  it('starts empty when the widget holds no box list', () => {
    const { node, widgetId } = addBoxesNode()
    useWidgetValueStore().setValue(widgetId, 'not boxes')
    renderContent(widgetId, node.id)

    expect(screen.getByText('Drag on the canvas to add a region.')).toBeTruthy()
  })

  it('closes at once when its node was removed before it opened', () => {
    const { graph, node, widgetId } = addBoxesNode([box('a cat')])
    graph.remove(node)

    const { close } = renderContent(widgetId, node.id)

    expect(close).toHaveBeenCalledOnce()
  })

  it('closes when a workflow load reconfigures the graph', () => {
    const { graph, close } = renderForNewNode()
    reconfigure(graph)

    expect(close).toHaveBeenCalledOnce()
  })

  it('closes when its node is removed but not for other nodes', () => {
    const { graph, node, close } = renderForNewNode()
    const other = new LGraphNode('Other')
    graph.add(other)
    graph.remove(other)
    expect(close).not.toHaveBeenCalled()

    graph.remove(node)
    expect(close).toHaveBeenCalledOnce()
  })

  it('stops listening to the graph once closed', () => {
    const { graph, close, unmount } = renderForNewNode()
    unmount()
    reconfigure(graph)

    expect(close).not.toHaveBeenCalled()
  })
})
