import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

  it('focuses the node on the canvas when its chip is clicked', async () => {
    const node = createMockNode('1', 'Save Image')
    renderChips([node])
    const user = userEvent.setup()

    await user.click(screen.getByText('Save Image'))

    expect(focusNodeInstance).toHaveBeenCalledWith(node)
  })

  it('emits remove when the remove action is clicked', async () => {
    const node = createMockNode('1', 'Save Image')
    const { emitted } = renderChips([node])
    const user = userEvent.setup()

    await user.click(screen.getByLabelText('Remove'))

    expect(emitted().remove).toEqual([[node]])
  })
})
