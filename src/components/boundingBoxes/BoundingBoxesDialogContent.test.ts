import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/vue'
import { fromAny } from '@total-typescript/shoehorn'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { createI18n } from 'vue-i18n'

import BoundingBoxesDialogContent from './BoundingBoxesDialogContent.vue'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { openBoundingBoxesDialog } from './boundingBoxesDialog'
import messages from '@/locales/en/main.json'
import { registerTestWidget } from '@/renderer/extensions/vueNodes/widgets/components/widgetTestUtils'
import { useDialogStore } from '@/stores/dialogStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { BoundingBox } from '@comfyorg/graph-model/boundingBoxes'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

const { appState } = vi.hoisted(() => {
  const appState: {
    node: unknown
    events: EventTarget
    rootEvents: EventTarget
  } = { node: null, events: new EventTarget(), rootEvents: new EventTarget() }
  return { appState }
})

vi.mock(import('@/composables/widgetHistoryScope'), () => ({
  locateWidgetNode: () => ({
    graph: fromAny({
      getNodeById: () => appState.node,
      events: appState.events,
      rootGraph: { events: appState.rootEvents }
    }),
    nodeId: toNodeId('1')
  }),
  widgetHistoryScope: () => null
}))

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

function registerBoxesWidget(value: unknown = []) {
  return registerTestWidget({
    name: 'bboxes',
    type: 'boundingboxes',
    value: Array.isArray(value) ? value : []
  })
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
    seedNode([box('a cat')])
    render(GlobalDialog, { global: { plugins: [i18n] } })
    openBoundingBoxesDialog(toNodeId('1'), registerBoxesWidget())

    const header = await screen.findByRole('group')
    await waitFor(() =>
      expect(
        within(header).getByRole('button', { name: 'Clear all' })
      ).toBeInTheDocument()
    )
  })

  it('opens a maximized dialog editing the given widget', () => {
    const widgetId = registerBoxesWidget()
    openBoundingBoxesDialog(toNodeId('7'), widgetId)

    const options = vi.mocked(useDialogStore().showDialog).mock.calls[0][0]
    expect(options.key).toBe('global-bounding-boxes-editor')
    expect(options.props).toMatchObject({ nodeId: toNodeId('7'), widgetId })
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

function seedNode(value: unknown) {
  appState.events = new EventTarget()
  appState.rootEvents = new EventTarget()
  appState.node = {
    widgets: [
      { name: 'width', value: 512 },
      { name: 'height', value: 512 },
      { name: 'bboxes', value }
    ],
    properties: {},
    findInputSlot: () => -1,
    getInputNode: () => null
  }
}

describe('BoundingBoxesDialogContent', () => {
  function renderContent(value: unknown, beforeOpen = () => {}) {
    const target = document.createElement('div')
    target.id = 'bounding-boxes-header-actions'
    document.body.appendChild(target)
    onTestFinished(() => target.remove())

    seedNode(value)
    beforeOpen()
    const widgetId = registerBoxesWidget(value)
    const close = vi.fn()
    const { unmount } = render(BoundingBoxesDialogContent, {
      props: {
        nodeId: toNodeId('1'),
        widgetId,
        close
      },
      global: { plugins: [i18n] }
    })
    return { widgetId, close, unmount }
  }

  it('edits the boxes stored on the node widget', () => {
    renderContent([box('a cat')])

    expect(screen.getByDisplayValue('a cat')).toBeTruthy()
  })

  it('writes edits back to the widget value', async () => {
    const { widgetId } = renderContent([box('a cat')])
    await fireEvent.update(screen.getByDisplayValue('a cat'), 'a dog')

    expect(useWidgetValueStore().getWidget(widgetId)?.value).toEqual([
      box('a dog')
    ])
  })

  it('starts empty when the widget holds no box list', () => {
    renderContent('not boxes')

    expect(screen.getByText('Drag on the canvas to add a region.')).toBeTruthy()
  })

  it('closes at once when its node was removed before it opened', () => {
    const { close } = renderContent([box('a cat')], () => {
      appState.node = null
    })

    expect(close).toHaveBeenCalledOnce()
  })

  it('closes when a workflow load reconfigures the graph', () => {
    const { close } = renderContent([box('a cat')])
    appState.rootEvents.dispatchEvent(new CustomEvent('configuring'))

    expect(close).toHaveBeenCalledOnce()
  })

  it('closes when its node is removed but not for other nodes', () => {
    const { close } = renderContent([box('a cat')])
    appState.events.dispatchEvent(
      new CustomEvent('node:removed', { detail: { node: {} } })
    )
    expect(close).not.toHaveBeenCalled()

    appState.events.dispatchEvent(
      new CustomEvent('node:removed', { detail: { node: appState.node } })
    )
    expect(close).toHaveBeenCalledOnce()
  })

  it('stops listening to the graph once closed', () => {
    const { close, unmount } = renderContent([box('a cat')])
    unmount()
    appState.rootEvents.dispatchEvent(new CustomEvent('configuring'))

    expect(close).not.toHaveBeenCalled()
  })
})
