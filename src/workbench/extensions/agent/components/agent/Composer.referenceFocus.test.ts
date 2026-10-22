import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { fillNodeAskAgentPrompt } from '@/components/graph/askAgentFromNode'
import { i18n } from '@/i18n'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { toNodeId } from '@/types/nodeId'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import Composer from './Composer.vue'
import { setupInlinePromptEditorDom } from './composer/inlinePromptEditorTestSetup'

setupInlinePromptEditorDom()

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/platform/telemetry'))

function renderComposer() {
  const store = useAgentComposerStore()
  store.setNodeScope('workflow-A')
  render(Composer, {
    props: { hasWorkflowTarget: true },
    global: { plugins: [i18n] }
  })
  return { store, editor: screen.getByRole('textbox') }
}

describe('composer focus after node reference chips', () => {
  it.for([
    {
      nodes: [{ id: '5', title: 'KSampler' }],
      text: ' hello'
    },
    {
      nodes: [
        { id: '5', title: 'KSampler' },
        { id: '12', title: 'VAE Decode' }
      ],
      text: '  hello'
    }
  ])(
    'focuses an open composer and types after $nodes.length chip(s)',
    async ({ nodes, text }) => {
      const { editor, store } = renderComposer()
      store.setNodes(nodes)
      store.requestEditorFocus()

      await waitFor(() => expect(editor).toHaveFocus())
      await userEvent.keyboard('hello')

      expect(store.prompt.text).toBe(text)
      expect(store.prompt.references[0]?.textOffset).toBe(0)
    }
  )

  it('focuses after mount when chips were added while the editor was unmounted', async () => {
    const store = useAgentComposerStore()
    store.setNodeScope('workflow-A')
    store.setNodes([{ id: '5', title: 'KSampler' }])
    store.requestEditorFocus()

    render(Composer, {
      props: { hasWorkflowTarget: true },
      global: { plugins: [i18n] }
    })
    const editor = screen.getByRole('textbox')

    await waitFor(() => expect(editor).toHaveFocus())
    await userEvent.keyboard('hello')

    expect(store.prompt.text).toBe(' hello')
    expect(store.prompt.references[0]?.textOffset).toBe(0)
  })

  it('focuses after a hover starter fills chip plus template text', async () => {
    const node = new LGraphNode('KSampler')
    node.id = toNodeId(5)
    const graph = new LGraph()
    graph.add(node)
    useCanvasStore().currentGraph = graph
    useWorkflowStore().activeWorkflow = createMockLoadedWorkflow({
      path: 'workflows/a.json',
      instanceId: 'workflow-A'
    })
    const panel = useAgentPanelStore()
    panel.enabled = true
    panel.isOpen = true

    const { editor, store } = renderComposer()
    expect(fillNodeAskAgentPrompt(node.id, 'Explain this node for me')).toBe(
      true
    )

    await waitFor(() => expect(editor).toHaveFocus())
    await userEvent.keyboard('!')

    expect(store.prompt.text).toBe('Explain this node for me!')
    expect(store.prompt.references[0]?.textOffset).toBe(0)
    expect(store.insertionPoint.textOffset).toBe(
      'Explain this node for me!'.length
    )
  })
})
