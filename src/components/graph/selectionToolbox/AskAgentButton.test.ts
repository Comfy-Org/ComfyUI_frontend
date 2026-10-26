import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { referenceNodesInAgent } from '@/components/graph/referenceNodesInAgent'
import AskAgentButton from '@/components/graph/selectionToolbox/AskAgentButton.vue'
import { useSelectionState } from '@/composables/graph/useSelectionState'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'

vi.mock(import('@/components/graph/referenceNodesInAgent'), () => ({
  referenceNodesInAgent: vi.fn()
}))

vi.mock<unknown>(import('@/composables/graph/useSelectionState'), () => ({
  useSelectionState: vi.fn(() => ({
    selectedNodes: { value: [] }
  }))
}))

describe('AskAgentButton', () => {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        agent: {
          askAgent: 'Ask agent'
        }
      }
    }
  })

  const renderComponent = () =>
    render(AskAgentButton, {
      global: {
        plugins: [i18n]
      }
    })

  it('references the selected nodes without sending', async () => {
    const node = new LGraphNode('KSampler')
    node.id = toNodeId(5)
    vi.mocked(useSelectionState).mockReturnValue(
      fromPartial<ReturnType<typeof useSelectionState>>({
        selectedNodes: { value: [node] }
      })
    )
    renderComponent()

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Ask agent' }))

    expect(referenceNodesInAgent).toHaveBeenCalledExactlyOnceWith([node.id])
  })
})
