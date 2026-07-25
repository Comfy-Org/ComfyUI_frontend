import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import AgentMessageNodeChips from './AgentMessageNodeChips.vue'

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

  return render(AgentMessageNodeChips, {
    props: { nodes },
    global: { plugins: [i18n] }
  })
}

describe('AgentMessageNodeChips', () => {
  beforeEach(() => {
    focusNodeInstance.mockClear()
  })

  it('renders nothing when there are no node references', () => {
    const { container } = renderChips([])

    expect(container).toBeEmptyDOMElement()
  })

  it('renders a chip for each referenced node', () => {
    renderChips([
      createMockNode('1', 'Save Image'),
      createMockNode('2', 'Load Image')
    ])

    expect(screen.getByText('Save Image')).toBeInTheDocument()
    expect(screen.getByText('Load Image')).toBeInTheDocument()
  })

  it('focuses the node on the canvas when its chip is clicked', async () => {
    const node = createMockNode('1', 'Save Image')
    renderChips([node])
    const user = userEvent.setup()

    await user.click(screen.getByText('Save Image'))

    expect(focusNodeInstance).toHaveBeenCalledWith(node)
  })

  it('has no remove action, unlike the composer chips', () => {
    renderChips([createMockNode('1', 'Save Image')])

    expect(screen.queryByLabelText('Remove')).not.toBeInTheDocument()
  })
})
