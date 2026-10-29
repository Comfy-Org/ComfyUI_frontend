import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, markRaw, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'
import AlignButton from '@/components/graph/selectionToolbox/AlignButton.vue'
import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { toNodeId } from '@/types/nodeId'
import { setCanvasSelection } from '@/utils/__tests__/canvasSelectionTestUtils'
import { createTestCanvasElement } from '@/utils/__tests__/canvasTestUtils'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { alignAndDistribute: 'Align and distribute' },
      contextMenu: {
        'Align top': 'Align top',
        'Align bottom': 'Align bottom',
        'Align left': 'Align left',
        'Align right': 'Align right',
        'Distribute horizontally': 'Distribute horizontally',
        'Distribute vertically': 'Distribute vertically'
      }
    }
  }
})

const nodeWithId = (id: number) => {
  const node = new LGraphNode(`Node ${id}`)
  node.id = toNodeId(id)
  return node
}

function selectStaggeredRow() {
  const graph = new LGraph()
  const first = markRaw(nodeWithId(1))
  const second = markRaw(nodeWithId(2))
  first.pos = [100, 200]
  second.pos = [300, 260]
  first.size = second.size = [160, 80]
  graph.add(first)
  graph.add(second)
  const element = createTestCanvasElement({ cssSize: [1000, 800] })
  const canvas = new LGraphCanvas(element, graph, { skip_render: true })
  const store = useCanvasStore()
  store.canvas = markRaw(canvas)
  store.currentGraph = graph
  setCanvasSelection([first, second])
  return { first, second }
}

function renderButton() {
  const lift = ref(0)
  const view = render(
    defineComponent({
      render: () =>
        h(TooltipProvider, () =>
          h('div', { 'data-selection-toolbox': '' }, [
            h(AlignButton, {
              lift: lift.value,
              'onUpdate:lift': (value: number) => (lift.value = value)
            }),
            h('button', 'Bypass')
          ])
        )
    }),
    { global: { plugins: [i18n] } }
  )
  return { ...view, lift }
}

const openBar = async () => {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Align and distribute' }))
  const bar = await screen.findByRole('group', {
    name: 'Align and distribute'
  })
  return { user, bar }
}

describe('AlignButton', () => {
  it('offers the align and distribute options in order and stays lifted until a press outside the toolbox', async () => {
    selectStaggeredRow()
    const { unmount, lift } = renderButton()
    const { user, bar } = await openBar()

    expect(
      within(bar)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label'))
    ).toEqual([
      'Align top',
      'Align bottom',
      'Align left',
      'Align right',
      'Distribute horizontally',
      'Distribute vertically'
    ])
    expect(lift.value).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Bypass' }))
    expect(bar).toBeInTheDocument()

    await user.click(document.body)
    await waitFor(() => expect(bar).not.toBeInTheDocument())
    expect(lift.value).toBe(0)
    unmount()
  })

  it('aligns the selected nodes to the top edge of the selection and keeps the bar open', async () => {
    const { first, second } = selectStaggeredRow()
    const { unmount } = renderButton()
    const { user, bar } = await openBar()

    await user.click(within(bar).getByRole('button', { name: 'Align top' }))

    expect([first.pos[1], second.pos[1]]).toEqual([200, 200])
    expect(bar).toBeInTheDocument()
    unmount()
  })

  it('starts closed again after it unmounts with its bar open', async () => {
    selectStaggeredRow()
    const shown = ref(true)
    const open = ref(false)
    const { unmount } = render(
      defineComponent({
        render: () =>
          h(TooltipProvider, () =>
            h(
              'div',
              { 'data-selection-toolbox': '' },
              shown.value
                ? [
                    h(AlignButton, {
                      open: open.value,
                      'onUpdate:open': (value: boolean) => (open.value = value)
                    })
                  ]
                : []
            )
          )
      }),
      { global: { plugins: [i18n] } }
    )
    await openBar()
    expect(open.value).toBe(true)

    shown.value = false
    await nextTick()
    expect(open.value).toBe(false)

    shown.value = true
    await nextTick()
    expect(
      screen.queryByRole('group', { name: 'Align and distribute' })
    ).not.toBeInTheDocument()
    unmount()
  })

  it.for<{ selection: string; arrange: () => void }>([
    {
      selection: 'two nodes on a read-only canvas',
      arrange: () => {
        selectStaggeredRow()
        useCanvasStore().isReadOnly = true
      }
    },
    {
      selection: 'one node',
      arrange: () => {
        const { first } = selectStaggeredRow()
        setCanvasSelection([first])
      }
    }
  ])('disables the align button for $selection', ({ arrange }) => {
    arrange()
    const { unmount } = renderButton()

    expect(
      screen.getByRole('button', { name: 'Align and distribute' })
    ).toBeDisabled()
    unmount()
  })

  it('closes when other nodes are selected', async () => {
    selectStaggeredRow()
    const { unmount } = renderButton()
    const { bar } = await openBar()

    setCanvasSelection([nodeWithId(3), nodeWithId(4)])
    await nextTick()

    await waitFor(() => expect(bar).not.toBeInTheDocument())
    unmount()
  })
})
