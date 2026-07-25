import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import AgentComposerNodeChips from './AgentComposerNodeChips.vue'

const { focusNodeInstance } = vi.hoisted(() => ({
  focusNodeInstance: vi.fn()
}))

vi.mock('@/composables/canvas/useFocusNode', () => ({
  useFocusNode: () => ({ focusNodeInstance })
}))

function createMockNode(id: string, title: string): LGraphNode {
  return { id, title } as unknown as LGraphNode
}

function renderChips(nodes: LGraphNode[]) {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })

  return render(AgentComposerNodeChips, {
    props: { nodes, graphNodes: nodes },
    global: { plugins: [i18n] }
  })
}

describe('AgentComposerNodeChips', () => {
  beforeEach(() => {
    focusNodeInstance.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('focuses the node on the canvas when its chip is clicked', async () => {
    const node = createMockNode('1', 'Save Image')
    renderChips([node])
    const user = userEvent.setup()

    await user.click(screen.getByText('Save Image'))

    expect(focusNodeInstance).toHaveBeenCalledWith(node)
  })

  it('focuses the node via the keyboard when the chip is activated with Enter', async () => {
    const node = createMockNode('1', 'Save Image')
    renderChips([node])
    const user = userEvent.setup()

    await user.tab()
    await user.keyboard('{Enter}')

    expect(focusNodeInstance).toHaveBeenCalledWith(node)
  })

  it('emits remove without also focusing the node when the remove action is clicked', async () => {
    const node = createMockNode('1', 'Save Image')
    const { emitted } = renderChips([node])
    const user = userEvent.setup()

    await user.click(screen.getByLabelText('Remove'))

    expect(emitted().remove).toEqual([[node]])
    expect(focusNodeInstance).not.toHaveBeenCalled()
  })

  it('shows a "Locate node" tooltip when hovering the chip', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const node = createMockNode('1', 'Save Image')
    renderChips([node])

    expect(screen.queryByText('Locate node')).not.toBeInTheDocument()

    const chip = screen.getByRole('button', { name: 'Locate node' })
    // The hover listener lives on the tooltip trigger wrapper, not the chip.
    // eslint-disable-next-line testing-library/no-node-access
    await user.hover(chip.parentElement!)
    await vi.advanceTimersByTimeAsync(500)

    expect(screen.getByText('Locate node')).toBeInTheDocument()
  })

  it('only applies the scroll-fade mask once the chips overflow three rows', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100)
    const scrollHeightSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockReturnValue(80)
    const node = createMockNode('1', 'Save Image')
    const { container, rerender } = renderChips([node])
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- scroll tray has no ARIA role to query by
    const tray = container.querySelector('.overflow-y-auto')

    await vi.waitFor(() => expect(tray).not.toHaveClass('scroll-fade'))

    scrollHeightSpy.mockReturnValue(140)
    const secondNode = createMockNode('2', 'Load Image')
    await rerender({
      nodes: [node, secondNode],
      graphNodes: [node, secondNode]
    })

    await vi.waitFor(() => expect(tray).toHaveClass('scroll-fade'))
  })

  it('scrolls the newest chip into view when a node reference is added', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    const scrollToSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollTo')
      .mockImplementation(() => {})
    const node = createMockNode('1', 'Save Image')
    const { rerender } = renderChips([node])

    const secondNode = createMockNode('2', 'Load Image')
    await rerender({
      nodes: [node, secondNode],
      graphNodes: [node, secondNode]
    })

    await vi.waitFor(() =>
      expect(scrollToSpy).toHaveBeenCalledWith({
        top: expect.any(Number),
        behavior: 'smooth'
      })
    )
  })
})
