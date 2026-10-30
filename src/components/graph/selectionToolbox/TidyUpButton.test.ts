import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, markRaw, nextTick, ref } from 'vue'
import type { Component } from 'vue'
import { createI18n } from 'vue-i18n'

import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'
import TidyUpButton from '@/components/graph/selectionToolbox/TidyUpButton.vue'
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
      g: {
        tidyUp: 'Tidy up',
        tidyUpTooltip: 'Tidy up the selection',
        gapHandle: 'Gap between nodes',
        gapValue: '{value} canvas units'
      }
    }
  }
})

const nodeWithId = (id: number) => {
  const node = new LGraphNode(`Node ${id}`)
  node.id = toNodeId(id)
  return node
}

function selectRow() {
  const graph = new LGraph()
  const first = markRaw(nodeWithId(1))
  const second = markRaw(nodeWithId(2))
  first.pos = [100, 200]
  second.pos = [290, 200]
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

function renderButton(
  SelectionGapHandles: Component | boolean = true,
  Slider: Component | boolean = false
) {
  const lift = ref(0)
  const view = render(
    defineComponent({
      render: () =>
        h(TooltipProvider, () =>
          h('div', { 'data-selection-toolbox': '' }, [
            h(TidyUpButton, {
              lift: lift.value,
              'onUpdate:lift': (value: number) => (lift.value = value)
            }),
            h('button', 'Bypass')
          ])
        )
    }),
    { global: { plugins: [i18n], stubs: { SelectionGapHandles, Slider } } }
  )
  return { ...view, lift }
}

const openBar = async () => {
  const user = userEvent.setup()
  setCanvasSelection([nodeWithId(1), nodeWithId(2)])
  await user.click(screen.getByRole('button', { name: 'Tidy up' }))
  return { user, slider: await screen.findByRole('slider') }
}

describe('TidyUpButton', () => {
  it.for<{
    change: string
    next: (selected: LGraphNode[]) => LGraphNode[]
    staysOpen: boolean
  }>([
    {
      change: 'other nodes',
      next: () => [nodeWithId(3), nodeWithId(4)],
      staysOpen: false
    },
    {
      change: 'other nodes with the same ids',
      next: () => [nodeWithId(1), nodeWithId(2)],
      staysOpen: false
    },
    {
      change: 'the same nodes in another order',
      next: ([first, second]) => [second, first],
      staysOpen: true
    }
  ])(
    'keeps the gap bar open: $staysOpen, when the selection changes to $change',
    async ({ next, staysOpen }) => {
      const user = userEvent.setup()
      const selected = [nodeWithId(1), nodeWithId(2)]
      setCanvasSelection(selected)
      const { unmount } = renderButton()

      await user.click(screen.getByRole('button', { name: 'Tidy up' }))
      expect(await screen.findByRole('slider')).toBeInTheDocument()

      setCanvasSelection(next(selected))
      await nextTick()

      await waitFor(() =>
        expect(screen.queryByRole('slider') !== null).toBe(staysOpen)
      )
      unmount()
    }
  )

  it('starts closed again after it unmounts with its gap bar open', async () => {
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
                    h(TidyUpButton, {
                      open: open.value,
                      'onUpdate:open': (value: boolean) => (open.value = value)
                    })
                  ]
                : []
            )
          )
      }),
      { global: { plugins: [i18n], stubs: { SelectionGapHandles: true } } }
    )
    await openBar()
    expect(open.value).toBe(true)

    shown.value = false
    await nextTick()
    expect(open.value).toBe(false)

    shown.value = true
    await nextTick()
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    unmount()
  })

  it('stays open and lifted for a press on another toolbox button', async () => {
    const { unmount, lift } = renderButton()
    const { user } = await openBar()

    expect(screen.getByRole('slider')).toHaveAccessibleName('Gap between nodes')

    await user.click(screen.getByRole('button', { name: 'Bypass' }))
    await nextTick()

    expect(screen.getByRole('slider')).toBeInTheDocument()
    expect(lift.value).toBeGreaterThan(0)

    await user.click(document.body)
    await waitFor(() => expect(screen.queryByRole('slider')).toBeNull())
    expect(lift.value).toBe(0)
    unmount()
  })

  it('ignores the slider while a gap handle is being dragged', async () => {
    selectRow()
    const InputSlider = defineComponent({
      props: { modelValue: { type: Array, required: true } },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            role: 'slider',
            'aria-valuenow': props.modelValue[0],
            onInput: () => emit('update:modelValue', [48])
          })
      }
    })
    const { unmount } = renderButton(false, InputSlider)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Tidy up' }))
    const slider = await screen.findByRole('slider')
    const handle = await screen.findByRole('spinbutton')
    const shownGap = slider.getAttribute('aria-valuenow')

    await user.pointer({ keys: '[MouseLeft>]', target: handle })
    slider.focus()
    await user.paste('48')

    expect(slider).toHaveAttribute('aria-valuenow', shownGap)
    await user.pointer({ keys: '[/MouseLeft]', target: handle })
    slider.focus()
    await user.paste('48')
    expect(slider).toHaveAttribute('aria-valuenow', '48')
    unmount()
  })

  it('keeps the slider in its range when the handles leave a wider gap', async () => {
    const { first, second } = selectRow()
    const { unmount } = renderButton(false)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Tidy up' }))
    const slider = await screen.findByRole('slider')
    const handle = await screen.findByRole('spinbutton')
    handle.focus()
    await user.keyboard('{Shift>}{ArrowRight}{ArrowRight}{ArrowRight}{/Shift}')

    await waitFor(() => expect(slider).toHaveAttribute('aria-valuenow', '48'))
    expect(screen.getByText('60')).toBeInTheDocument()
    expect(second.pos[0] - first.pos[0] - 160).toBe(60)
    unmount()
  })

  it('finishes a pending slider preview before the handles measure their edit', async () => {
    const { first, second } = selectRow()
    const PreviewSlider = defineComponent({
      props: { modelValue: { type: Array, required: true } },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            role: 'slider',
            'aria-valuenow': props.modelValue[0],
            onInput: () => emit('update:modelValue', [31])
          })
      }
    })
    const { unmount } = renderButton(false, PreviewSlider)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByRole('button', { name: 'Tidy up' }))
    const slider = await screen.findByRole('slider')
    const handle = await screen.findByRole('spinbutton')

    await user.type(slider, 'a')
    expect(second.pos[0] - first.pos[0] - 160).toBe(30)
    handle.focus()
    await user.keyboard('[ArrowRight>]')
    expect(second.pos[0] - first.pos[0] - 160).toBe(32)
    await user.keyboard('[/ArrowRight]')
    vi.advanceTimersToNextFrame()
    await nextTick()

    expect(second.pos[0] - first.pos[0] - 160).toBe(32)
    expect(slider).toHaveAttribute('aria-valuenow', '32')
    unmount()
  })
})
