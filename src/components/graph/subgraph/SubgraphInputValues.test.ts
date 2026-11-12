import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { getActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'
import type { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { reorderSubgraphInputs } from '@/lib/litegraph/src/subgraph/subgraphUtils'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'
import { testI18n } from '@/utils/__tests__/testI18n'

import SubgraphInputValues from './SubgraphInputValues.vue'

vi.mock(import('@/scripts/app'))

const edits: {
  name: string
  apply: (host: SubgraphNode) => void
  expected: string[]
}[] = [
  {
    name: 'addition',
    apply: (host) => {
      host.subgraph.addInput('third', 'STRING')
    },
    expected: ['first', 'second', 'third']
  },
  {
    name: 'removal',
    apply: (host) => {
      host.subgraph.removeInput(host.subgraph.inputs[0])
    },
    expected: ['second']
  },
  {
    name: 'rename',
    apply: (host) => {
      host.subgraph.renameInput(host.subgraph.inputs[0], 'Renamed')
    },
    expected: ['Renamed', 'second']
  },
  {
    name: 'reorder',
    apply: (host) => {
      reorderSubgraphInputs(host, [1, 0])
    },
    expected: ['second', 'first']
  }
]

async function renderInputNode() {
  stubCanvasGetContext()
  onTestFinished(() =>
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockRestore()
  )
  const graph = createTestSubgraph({
    inputs: [
      { name: 'first', type: 'STRING' },
      { name: 'second', type: 'STRING' }
    ]
  })
  const host = createTestSubgraphNode(graph)
  host.title = 'Host A'
  graph.rootGraph.add(host)
  vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph.rootGraph)
  const store = useCanvasStore()
  store.canvas = new LGraphCanvas(document.createElement('canvas'), graph, {
    skip_render: true,
    skip_events: true
  })
  store.currentGraph = graph
  const Probe = defineComponent({
    setup: () => () =>
      h(TooltipProvider, {}, { default: () => h(SubgraphInputValues) })
  })
  const pinia = getActivePinia()
  assert.exists(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: defineComponent(() => () => null) }]
  })
  await router.push('/')
  await router.isReady()
  render(Probe, { global: { plugins: [pinia, router, testI18n] } })
  return { graph, host }
}

describe('subgraph input node ports', () => {
  it('identifies the current instance without a picker and offers an exit action', async () => {
    const { host } = await renderInputNode()

    expect(
      screen.getByRole('heading', { name: `${host.title} · #${host.id}` })
    ).toBeVisible()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Subgraph' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Exit subgraph' })).toBeVisible()
  })

  it('does not start resizing a pinned input node', async () => {
    const { graph } = await renderInputNode()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    graph.inputNode.pinned = true
    const before = graph.inputNode.asSerialisable()
    const handle = screen.getByRole('button', {
      name: 'Resize from bottom-right corner'
    })
    handle.setPointerCapture = vi.fn()
    vi.advanceTimersByTime(1)

    await user.pointer({
      keys: '[MouseLeft>]',
      target: handle,
      coords: { x: 500, y: 500 }
    })
    await user.pointer({
      target: handle,
      coords: { x: 620, y: 600 }
    })
    await user.pointer({ keys: '[/MouseLeft]', target: handle })

    expect(handle.setPointerCapture).not.toHaveBeenCalled()
    expect(graph.inputNode.asSerialisable()).toEqual(before)
  })

  it('does not resize either definition when navigation interrupts an active gesture', async () => {
    const { graph } = await renderInputNode()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const target = createTestSubgraph({ rootGraph: graph.rootGraph })
    const before = graph.inputNode.asSerialisable()
    const targetBefore = target.inputNode.asSerialisable()
    const handle = screen.getByRole('button', {
      name: 'Resize from bottom-right corner'
    })
    handle.setPointerCapture = vi.fn()
    handle.releasePointerCapture = vi.fn()
    vi.advanceTimersByTime(1)
    await user.pointer({
      keys: '[MouseLeft>]',
      target: handle,
      coords: { x: 500, y: 500 }
    })
    await user.pointer({
      target: handle,
      coords: { x: 760, y: 700 }
    })
    const resized = graph.inputNode.asSerialisable()
    expect(handle.setPointerCapture).toHaveBeenCalledOnce()
    expect(resized.bounding).not.toEqual(before.bounding)

    useCanvasStore().currentGraph = target
    await nextTick()
    await user.pointer({
      target: handle,
      coords: { x: 900, y: 800 }
    })
    await user.pointer({ keys: '[/MouseLeft]', target: handle })

    expect(target.inputNode.asSerialisable()).toEqual(targetBefore)
    expect(graph.inputNode.asSerialisable()).toEqual(resized)
    expect(handle.releasePointerCapture).toHaveBeenCalledOnce()
  })

  it.for(edits)(
    'refreshes displayed ports after an interface $name',
    async ({ apply, expected }) => {
      const { host } = await renderInputNode()
      assert.lengthOf(screen.getAllByTestId('subgraph-input-port'), 2)

      apply(host)
      await nextTick()

      expect(
        screen
          .getAllByTestId('subgraph-input-port')
          .map((port) => port.textContent.trim())
      ).toEqual(expected)
      expect(screen.getByTestId('subgraph-add-input')).toBeVisible()
    }
  )
})
