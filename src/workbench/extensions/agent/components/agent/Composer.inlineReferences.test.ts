import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'

import { i18n } from '@/i18n'
import type { SelectedNode } from '../../composables/agent/useCanvasSelection'
import { useCanvasSelection } from '../../composables/agent/useCanvasSelection'
import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import Composer from './Composer.vue'
import { setupInlinePromptEditorDom } from './composer/inlinePromptEditorTestSetup'

vi.hoisted(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

setupInlinePromptEditorDom()

function renderComposer() {
  const store = useAgentComposerStore()
  store.setNodeScope('workflow-A')
  const selected = ref<SelectedNode[]>([])
  const send = vi.fn()
  const Host = defineComponent({
    setup() {
      const selection = useCanvasSelection({
        staged: computed({ get: () => store.nodes, set: store.setNodes }),
        selection: selected,
        scope: () => store.nodeScope,
        isLive: true
      })
      return () =>
        h(Composer, {
          hasWorkflowTarget: true,
          availableWorkflows: [{ id: 'wf-b', name: 'Reference B' }],
          selectWorkflowReference: async ({ name }) => ({ id: 'wf-b', name }),
          selectionTags: selection.staged.value,
          onRemoveTag: selection.remove,
          onSend: send
        })
    }
  })
  const view = render(Host, {
    global: { plugins: [i18n], directives: { tooltip: () => {} } }
  })
  return { ...view, store, selected, send, editor: screen.getByRole('textbox') }
}

describe('inline node and asset references', () => {
  beforeEach(() => vi.useRealTimers())

  it('keeps upper-row removal and Undo synchronized with inline references', async () => {
    const { store, selected, editor, send } = renderComposer()
    await userEvent.click(editor)
    await userEvent.paste('Use ')
    selected.value = [{ id: '12', title: 'KSampler' }]
    await waitFor(() => expect(editor.textContent).toBe('Use KSampler #12 '))
    await userEvent.paste('with ')
    store.addAttachment({
      id: 'image',
      name: 'source.png',
      ref: 'uploaded.png'
    })
    await waitFor(() =>
      expect(editor.textContent).toBe('Use KSampler #12 with source.png ')
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove KSampler #12 reference' })
    )
    await waitFor(() =>
      expect(
        screen.queryByTestId('composer-node-section')
      ).not.toBeInTheDocument()
    )
    expect(editor.textContent).toBe('Use  with source.png ')
    expect(store.nodes).toEqual([])
    editor.focus()
    await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(() =>
      expect(screen.getByTestId('composer-node-section')).toHaveTextContent(
        'KSampler'
      )
    )
    expect(editor.textContent).toBe('Use KSampler #12 with source.png ')

    await userEvent.click(
      within(screen.getByTestId('composer-asset-section')).getByRole('button', {
        name: 'Remove'
      })
    )
    await waitFor(() =>
      expect(
        screen.queryByTestId('composer-asset-section')
      ).not.toBeInTheDocument()
    )
    expect(editor.textContent).toBe('Use KSampler #12 with  ')
    editor.focus()
    await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(() =>
      expect(screen.getByTestId('composer-asset-section')).toHaveTextContent(
        'source.png'
      )
    )
    expect(editor.textContent).toBe('Use KSampler #12 with source.png ')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(send).toHaveBeenCalledWith(
      'Use @[Node: KSampler #12] with @[Image: source.png]',
      [{ id: 'image', name: 'source.png', ref: 'uploaded.png' }]
    )
  })

  it('does not reinsert a removed asset when its upload completes', async () => {
    const { store, editor } = renderComposer()
    await userEvent.click(editor)
    await userEvent.paste('Inspect ')
    store.addAttachment({
      id: 'image',
      name: 'pending.png',
      ref: '',
      uploading: true
    })
    await screen.findByTestId('asset-reference-chip')
    await userEvent.click(
      within(screen.getByTestId('composer-asset-section')).getByRole('button', {
        name: 'Remove'
      })
    )
    store.updateAttachment('image', { ref: 'complete.png', uploading: false })
    await waitFor(() =>
      expect(
        screen.queryByTestId('asset-reference-chip')
      ).not.toBeInTheDocument()
    )
    expect(
      screen.queryByTestId('composer-asset-section')
    ).not.toBeInTheDocument()
    editor.focus()
    await userEvent.keyboard('{Control>}z{/Control}')
    await screen.findByTestId('asset-reference-chip')
    expect(store.attachments).toEqual([
      {
        id: 'image',
        name: 'pending.png',
        ref: 'complete.png',
        uploading: false
      }
    ])
  })

  it('deletes a node from the sentence without restaging the selected canvas node', async () => {
    const { store, selected, editor } = renderComposer()
    await userEvent.click(editor)
    await userEvent.paste('Use ')
    selected.value = [{ id: '12', title: 'KSampler' }]
    await screen.findByTestId('node-reference-chip')
    await userEvent.keyboard('{Backspace}')
    await waitFor(() => expect(store.draft).toBe('Use '))
    await userEvent.keyboard('{Backspace}')
    expect(editor.textContent).toBe('Use ')
    expect(store.nodes).toEqual([])
    expect(
      screen.queryByTestId('composer-node-section')
    ).not.toBeInTheDocument()
    selected.value = [{ id: '12', title: 'KSampler' }]
    await userEvent.paste('another node')
    expect(store.nodes).toEqual([])
  })

  it('copies mixed references as readable text and pastes text after a target change', async () => {
    const user = userEvent.setup()
    const { store, selected, editor } = renderComposer()
    await user.click(editor)
    await user.paste('参考 🐈 ')
    selected.value = [{ id: '12', title: 'KSampler' }]
    await screen.findByTestId('node-reference-chip')
    store.addAttachment({ id: 'image', name: 'source.png', ref: 'source.png' })
    await screen.findByTestId('asset-reference-chip')
    await user.keyboard('{Control>}a{/Control}')
    const clipboard = await user.copy()
    const text = '参考 🐈 @[Node: KSampler #12] @[Image: source.png] '
    expect(clipboard?.getData('text/plain')).toBe(text)

    selected.value = []
    store.setNodeScope('workflow-B')
    await waitFor(() => expect(editor.textContent).toBe('参考 🐈  source.png '))
    await user.click(editor)
    await user.keyboard('{Control>}z{/Control}')
    expect(editor.textContent).toBe('参考 🐈  source.png ')
    expect(store.nodes).toEqual([])
    expect(screen.queryByTestId('node-reference-chip')).not.toBeInTheDocument()
    expect(screen.getByTestId('asset-reference-chip')).toHaveTextContent(
      'source.png'
    )
    store.replaceDraft({ text: '', workflowReferences: [], attachments: [] })
    await waitFor(() => expect(editor.textContent).toBe(''))
    await user.click(editor)
    await user.paste(text)
    expect(editor.textContent).toBe(text)
    expect(store.nodeScope).toBe('workflow-B')
    expect(store.prompt.references).toEqual([])
    expect(
      screen.queryByTestId('composer-asset-section')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('composer-node-section')
    ).not.toBeInTheDocument()
  })

  it.for([
    {
      via: 'the chip remove button',
      remove: () =>
        userEvent.click(
          screen.getByRole('button', { name: 'Remove Reference B reference' })
        )
    },
    {
      via: 'Backspace beside the chip',
      remove: () => userEvent.keyboard('{ArrowLeft}{Backspace}')
    }
  ])(
    'leaves an empty draft after removing the only reference via $via',
    async ({ remove }) => {
      const { store, editor } = renderComposer()
      await userEvent.click(editor)
      await userEvent.paste('@')
      await userEvent.click(
        within(screen.getByRole('menu', { name: 'Add to prompt' })).getByRole(
          'menuitem',
          { name: 'Workflows' }
        )
      )
      await userEvent.click(
        within(screen.getByRole('menu', { name: 'Add to prompt' })).getByRole(
          'menuitem',
          { name: 'Reference B' }
        )
      )
      await screen.findByTestId('workflow-reference-chip')
      expect(editor.textContent).toBe('Reference B ')

      await remove()
      await waitFor(() =>
        expect(
          screen.queryByTestId('workflow-reference-chip')
        ).not.toBeInTheDocument()
      )
      expect(editor.textContent).toBe('')
      expect(store.prompt).toEqual({ text: '', references: [] })
    }
  )

  it('keeps a typed leading space when no reference was inserted', async () => {
    const { store, editor } = renderComposer()
    await userEvent.type(editor, ' hello')
    expect(editor.textContent).toBe(' hello')
    expect(store.draft).toBe(' hello')
  })
})
