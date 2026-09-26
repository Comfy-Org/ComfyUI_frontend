import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { getActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The node preview constructs its observer at import time; jsdom omits this API.
vi.hoisted(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

import { i18n } from '@/i18n'
import { toTurnId } from '../../schemas/agentApiSchema'
import type { WorkflowReference } from '../../types/workflowReference'

import AgentPanel from './AgentPanel.vue'
import { setupInlinePromptEditorDom } from './composer/inlinePromptEditorTestSetup'

setupInlinePromptEditorDom()

const historyGroups = {
  current: [],
  today: [],
  yesterday: [],
  earlier: []
}

function mountHistory(
  selectHistory: (id: string, isCurrent: () => boolean) => Promise<boolean>
) {
  return render(AgentPanel, {
    props: {
      entries: [],
      sessionId: 'previous',
      historyGroups: {
        ...historyGroups,
        today: [
          { id: 'first', title: 'First chat', updatedAt: 1 },
          { id: 'second', title: 'Second chat', updatedAt: 2 },
          { id: 'previous', title: 'Previous chat', updatedAt: 3 }
        ]
      },
      selectHistory
    },
    global: { plugins: [i18n], stubs: { Composer: true, EmptyState: true } }
  })
}

function mount(isMaximized = false) {
  return render(AgentPanel, {
    props: {
      entries: [],
      historyGroups,
      isMaximized,
      activeTab: { path: 'workflows/portrait.json', name: 'portrait' }
    },
    global: {
      plugins: [i18n],
      stubs: {
        Composer: true,
        EmptyState: true,
        PanelHeader: true
      }
    }
  })
}

describe('AgentPanel', () => {
  beforeEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('keeps a failed opening in history and lets the user retry that row', async () => {
    const select = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true)
    mountHistory(select)
    await userEvent.click(
      screen.getByRole('button', { name: 'Show chat history' })
    )
    await userEvent.click(screen.getByRole('button', { name: 'First chat' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      i18n.global.t('agent.historyOpenFailed')
    )
    expect(screen.getByRole('heading', { name: 'Chat history' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'First chat' }))

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Chat history' })).toBeNull()
    )
    expect(
      screen.getByRole('button', { name: 'Show chat history' })
    ).toBeVisible()
  })

  it.for([true, false])(
    'ignores an older opening that resolves to %s',
    async (result) => {
      let finishFirst = (_ready: boolean) => {}
      const first = new Promise<boolean>((resolve) => {
        finishFirst = resolve
      })
      let finishSecond = (_ready: boolean) => {}
      const second = new Promise<boolean>((resolve) => {
        finishSecond = resolve
      })
      const select = vi
        .fn()
        .mockReturnValueOnce(first)
        .mockReturnValueOnce(second)
      mountHistory(select)
      await userEvent.click(
        screen.getByRole('button', { name: 'Show chat history' })
      )
      await userEvent.click(screen.getByRole('button', { name: 'First chat' }))
      expect(screen.getByRole('button', { name: 'First chat' })).toBeDisabled()
      await userEvent.click(screen.getByRole('button', { name: 'Second chat' }))
      finishFirst(result)
      await first
      await nextTick()

      expect(
        screen.getByRole('button', { name: 'Second chat' })
      ).toHaveAttribute('aria-busy', 'true')
      expect(screen.queryByRole('alert')).toBeNull()
      expect(
        screen.getByRole('heading', { name: 'Chat history' })
      ).toBeVisible()
      finishSecond(true)
      await waitFor(() =>
        expect(
          screen.queryByRole('heading', { name: 'Chat history' })
        ).toBeNull()
      )
      expect(
        screen.getByRole('button', { name: 'Show chat history' })
      ).toBeVisible()
    }
  )

  it('invalidates opening when the user starts a new chat', async () => {
    let finish = (_ready: boolean) => {}
    const pending = new Promise<boolean>((resolve) => {
      finish = resolve
    })
    let isCurrent = () => false
    const { emitted } = mountHistory((_id, current) => {
      isCurrent = current
      return pending
    })
    await userEvent.click(
      screen.getByRole('button', { name: 'Show chat history' })
    )
    await userEvent.click(screen.getByRole('button', { name: 'First chat' }))
    expect(isCurrent()).toBe(true)
    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.newChat') })
    )
    expect(isCurrent()).toBe(false)
    finish(false)
    await pending
    await nextTick()

    expect(emitted().newChat).toEqual([[]])
    expect(screen.queryByRole('heading', { name: 'Chat history' })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Show chat history' })
    ).toBeVisible()
  })

  it.for([true, false])(
    'keeps the original chat after Back and an obsolete %s result',
    async (result) => {
      let finish = (_ready: boolean) => {}
      const pending = new Promise<boolean>((resolve) => {
        finish = resolve
      })
      const select = vi.fn((id: string) =>
        id === 'first' ? pending : Promise.resolve(true)
      )
      mountHistory(select)
      await userEvent.click(
        screen.getByRole('button', { name: 'Show chat history' })
      )
      await userEvent.click(screen.getByRole('button', { name: 'First chat' }))
      await userEvent.click(
        screen.getByRole('button', { name: 'Back to previous chat' })
      )
      await screen.findByRole('button', { name: 'Show chat history' })
      finish(result)
      await pending
      await nextTick()

      expect(select.mock.calls.map(([id]) => id)).toEqual(['first', 'previous'])
      expect(
        screen.getByRole('button', { name: 'Show chat history' })
      ).toBeVisible()
      expect(screen.queryByRole('heading', { name: 'Chat history' })).toBeNull()
    }
  )

  it('does not return to a chat deleted while another chat is opening', async () => {
    let finish = (_ready: boolean) => {}
    const pending = new Promise<boolean>((resolve) => {
      finish = resolve
    })
    const select = vi.fn((id: string) =>
      id === 'first' ? pending : Promise.resolve(true)
    )
    const { emitted } = mountHistory(select)
    await userEvent.click(
      screen.getByRole('button', { name: 'Show chat history' })
    )
    await userEvent.click(screen.getByRole('button', { name: 'First chat' }))
    await userEvent.click(
      screen.getAllByRole('button', {
        name: i18n.global.t('agent.chatOptions')
      })[2]
    )
    await userEvent.click(
      await screen.findByRole('menuitem', { name: i18n.global.t('g.delete') })
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Back to previous chat' })
    )
    finish(false)
    await pending
    await nextTick()

    expect(select.mock.calls.map(([id]) => id)).toEqual(['first'])
    expect(emitted().newChat).toEqual([[]])
    expect(
      screen.getByRole('button', { name: 'Show chat history' })
    ).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Chat history' })).toBeNull()
  })

  it('passes the editable workflow into the minimized run notice', () => {
    mount()

    expect(screen.getByRole('note')).toHaveTextContent(
      'The agent can now edit portrait. It works on 1 workflow at a time, and you can switch workflows during chat.'
    )
    expect(
      screen.getByRole('button', { name: 'Share feedback' })
    ).toBeInTheDocument()
  })

  it('passes the editable workflow into the expanded run notice', () => {
    mount(true)

    expect(screen.getByRole('note')).toHaveTextContent(
      'The agent can now edit portrait. It works on 1 workflow at a time, and you can switch workflows during chat.'
    )
    expect(
      screen.getByRole('button', { name: 'Share feedback' })
    ).toBeInTheDocument()
  })

  it('groups chat options with the title and separates history navigation', () => {
    const title = 'A comfortably short title'
    render(AgentPanel, {
      props: {
        entries: [],
        historyGroups,
        sessionId: 'thread-1',
        customTitle: title
      },
      global: {
        plugins: [i18n],
        stubs: {
          Composer: true,
          EmptyState: true,
          PanelHeader: true
        }
      }
    })

    const titleGroup = screen.getByRole('group', {
      name: i18n.global.t('agent.chatOptions')
    })
    const titleButton = within(titleGroup).getByRole('button', { name: title })
    const optionsButton = within(titleGroup).getByRole('button', {
      name: i18n.global.t('agent.chatOptions')
    })
    const historyButton = screen.getByRole('button', {
      name: i18n.global.t('agent.showChatHistory')
    })

    expect(titleButton).toBeVisible()
    expect(optionsButton).toBeVisible()
    expect(titleGroup).not.toContainElement(historyButton)
  })

  it('focuses the composer input body after a suggestion and clears on blur', async () => {
    const user = userEvent.setup()
    const pinia = getActivePinia()!
    render(AgentPanel, {
      props: { entries: [], historyGroups },
      global: {
        plugins: [pinia, i18n],
        directives: { tooltip: {} },
        stubs: {
          WorkflowSelectorChip: true
        }
      }
    })
    const prompt = 'Generate a yellow duck with a hockey mask'
    const suggestion = screen.getByRole('button', { name: prompt })
    const textarea = screen.getByRole('textbox')

    await user.click(suggestion)

    expect(textarea).toHaveTextContent(prompt)
    expect(textarea).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'New chat' }))

    expect(textarea).not.toHaveFocus()
  })

  it.for([true, false])(
    'restores the edited prompt and its references (references: %s)',
    async (hasReferences) => {
      const user = userEvent.setup()
      const pinia = getActivePinia()!
      const prompt = 'Compare  with  please.'
      const turnId = toTurnId('msg-1')
      const references: WorkflowReference[] = hasReferences
        ? [
            { id: 'wf-b', name: 'Flow B', textOffset: 8 },
            { id: 'wf-a', name: 'Flow A', textOffset: 14 }
          ]
        : []
      useAgentComposerStore().setWorkflowReferences([
        { id: 'stale', name: 'Stale draft reference', textOffset: 0 }
      ])
      const { emitted } = render(AgentPanel, {
        props: {
          editableTurnId: turnId,
          entries: [
            {
              id: turnId,
              role: 'user',
              text: prompt,
              workflowReferences: references
            }
          ],
          historyGroups
        },
        global: {
          plugins: [pinia, i18n],
          directives: { tooltip: {} },
          stubs: { WorkflowSelectorChip: true }
        }
      })
      const textarea = screen.getByRole('textbox')
      useAgentComposerStore().setText('unfinished draft')

      await user.click(screen.getByRole('button', { name: 'Edit' }))

      expect(textarea).toHaveTextContent(
        hasReferences
          ? 'Compare Flow B with Flow A please.'
          : 'Compare with please.'
      )
      expect(
        within(textarea).queryByText('Stale draft reference')
      ).not.toBeInTheDocument()
      expect(textarea).toHaveFocus()

      await user.pointer({ target: textarea, offset: 0, keys: '[MouseLeft]' })
      await user.paste('Updated. ')
      expect(screen.getByTestId('user-message-bubble')).toHaveTextContent(
        hasReferences
          ? 'Compare Flow B with Flow A please.'
          : 'Compare with please.'
      )
      await user.click(screen.getByRole('button', { name: 'Send' }))

      expect(emitted().send[0]).toEqual(
        hasReferences
          ? [
              `Updated. ${prompt}`,
              [],
              references.map((reference) => ({
                ...reference,
                textOffset: reference.textOffset + 9
              }))
            ]
          : [`Updated. ${prompt}`, []]
      )
    }
  )
})
