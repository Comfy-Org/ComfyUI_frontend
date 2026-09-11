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
import type { TurnId } from '../../schemas/agentApiSchema'

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

    expect(useAgentComposerStore().draft).toBe(prompt)
    expect(textarea).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'New chat' }))

    expect(textarea).not.toHaveFocus()
  })

  it('replaces and focuses the composer draft when editing the eligible prompt', async () => {
    const user = userEvent.setup()
    const pinia = getActivePinia()!
    const prompt = 'Generate a yellow duck with a hockey mask'
    const { emitted } = render(AgentPanel, {
      props: {
        editableTurnId: 'msg-1' as TurnId,
        entries: [{ id: 'msg-1' as TurnId, role: 'user', text: prompt }],
        historyGroups
      },
      global: {
        plugins: [pinia, i18n],
        directives: { tooltip: {} },
        stubs: { WorkflowSelectorChip: true }
      }
    })
    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'unfinished draft')

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    expect(useAgentComposerStore().draft).toBe(prompt)
    expect(textarea).toHaveFocus()

    await user.clear(textarea)
    await user.type(textarea, 'Generate a yellow duck at sunrise')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(emitted().send[0]).toEqual(['Generate a yellow duck at sunrise', []])
  })
})
