import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import {
  fillNodeAskAgentPrompt,
  sendNodeAskAgentPrompt
} from '@/components/graph/askAgentFromNode'
import NodeAskAgentHover from '@/components/graph/NodeAskAgentHover.vue'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { toNodeId } from '@/types/nodeId'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

vi.mock(import('@/components/graph/askAgentFromNode'), () => ({
  fillNodeAskAgentPrompt: vi.fn(() => true),
  sendNodeAskAgentPrompt: vi.fn(() => true)
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      agent: {
        askAgent: 'Ask agent',
        send: 'Send',
        nodeHover: {
          placeholder: 'Ask for a change',
          explain: 'Explain this node for me',
          fixError: 'Fix node error',
          whatElse: 'What else can I do with this node',
          enhance: 'Enhance the prompt',
          enhanceFill:
            'Enhance the prompt considering the purpose of this workflow',
          shuffle: 'Shuffle starter prompts'
        }
      }
    }
  }
})

function renderHover(
  props: {
    isPartner?: boolean
    alwaysVisible?: boolean
  } = {}
) {
  useAgentPanelStore().enabled = true
  return render(NodeAskAgentHover, {
    props: {
      nodeId: toNodeId(12),
      alwaysVisible: true,
      ...props
    },
    global: {
      plugins: [i18n]
    }
  })
}

describe('NodeAskAgentHover', () => {
  it('is hidden when the agent is unavailable', () => {
    useAgentPanelStore().enabled = false
    render(NodeAskAgentHover, {
      props: { nodeId: toNodeId(12), alwaysVisible: true },
      global: { plugins: [i18n] }
    })

    expect(screen.queryByRole('button', { name: 'Ask agent' })).toBeNull()
  })

  it('opens the floating composer focused on the input', async () => {
    renderHover()

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Ask agent' }))

    expect(screen.getByTestId('node-ask-agent-composer')).toBeVisible()
    expect(
      screen.getByRole('textbox', { name: 'Ask for a change' })
    ).toHaveFocus()
    expect(
      screen.getByRole('button', { name: 'Explain this node for me' })
    ).toBeVisible()
  })

  it('fills the main composer from a starter prompt without sending', async () => {
    renderHover()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Ask agent' }))
    await user.click(
      screen.getByRole('button', { name: 'Explain this node for me' })
    )

    expect(fillNodeAskAgentPrompt).toHaveBeenCalledExactlyOnceWith(
      toNodeId(12),
      'Explain this node for me'
    )
    expect(sendNodeAskAgentPrompt).not.toHaveBeenCalled()
    expect(screen.queryByTestId('node-ask-agent-composer')).toBeNull()
  })

  it('sends typed text from the floating composer', async () => {
    renderHover()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Ask agent' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Ask for a change' }),
      'Add an output that matches'
    )
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(sendNodeAskAgentPrompt).toHaveBeenCalledExactlyOnceWith(
      toNodeId(12),
      'Add an output that matches'
    )
    expect(fillNodeAskAgentPrompt).not.toHaveBeenCalled()
  })

  it('shuffles the starter prompt order', async () => {
    renderHover()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Ask agent' }))
    const before = screen
      .getAllByTestId('node-ask-agent-starter')
      .map((button) => button.textContent)
    await user.click(
      screen.getByRole('button', { name: 'Shuffle starter prompts' })
    )
    const after = screen
      .getAllByTestId('node-ask-agent-starter')
      .map((button) => button.textContent)

    expect(before).toEqual([
      'Explain this node for me',
      'Fix node error',
      'What else can I do with this node'
    ])
    expect(after).toEqual([
      'Fix node error',
      'What else can I do with this node',
      'Explain this node for me'
    ])
  })

  it('includes Enhance the prompt on partner nodes', async () => {
    renderHover({ isPartner: true })

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Ask agent' }))
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Enhance the prompt' }))

    expect(fillNodeAskAgentPrompt).toHaveBeenCalledExactlyOnceWith(
      toNodeId(12),
      'Enhance the prompt considering the purpose of this workflow'
    )
    expect(sendNodeAskAgentPrompt).not.toHaveBeenCalled()
  })

  it('includes Enhance the prompt when the graph node is an api_node', async () => {
    class PartnerApiNode extends LGraphNode {
      static override nodeData = {
        name: 'ByteDanceSeedance',
        api_node: true
      }
    }
    const node = new PartnerApiNode('ByteDance Seedance')
    node.id = toNodeId(12)
    const graph = new LGraph()
    graph.add(node)
    useCanvasStore().currentGraph = graph
    renderHover()

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Ask agent' }))
    expect(
      screen.getByRole('button', { name: 'Enhance the prompt' })
    ).toBeVisible()
  })
})
