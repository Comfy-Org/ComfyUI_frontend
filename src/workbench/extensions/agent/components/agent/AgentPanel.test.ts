// @vitest-environment jsdom

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { getActivePinia } from 'pinia'
import { render, screen, within } from '@testing-library/vue'
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

  it('passes the editable workflow into the minimized run notice', () => {
    mount()

    expect(screen.getByRole('note')).toHaveTextContent(
      'The agent can now edit portrait. It works on 1 workflow at a time, and you can switch workflows during chat.'
    )
    expect(
      screen.getByText('The AI agent can make mistakes')
    ).toBeInTheDocument()
  })

  it('passes the editable workflow into the expanded run notice', () => {
    mount(true)

    expect(screen.getByRole('note')).toHaveTextContent(
      'The agent can now edit portrait. It works on 1 workflow at a time, and you can switch workflows during chat.'
    )
    expect(
      screen.getByText(
        'The AI agent can make mistakes. Double check your response.'
      )
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
      await user.keyboard('Updated. ')
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
