import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { seedAskAgentComposerFromNode } from '@/components/graph/seedAskAgentComposerFromNode'
import { i18n } from '@/i18n'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
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
    const { editor, store } = renderComposer()
    expect(
      seedAskAgentComposerFromNode({
        id: 5,
        title: 'KSampler',
        text: 'Explain this node for me',
        instanceId: 'workflow-A'
      })
    ).toBe(true)

    await waitFor(() => expect(editor).toHaveFocus())
    await userEvent.keyboard('!')

    expect(store.prompt.text).toBe('Explain this node for me!')
    expect(store.prompt.references[0]?.textOffset).toBe(0)
    expect(store.insertionPoint.textOffset).toBe(
      'Explain this node for me!'.length
    )
  })
})
