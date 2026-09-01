import { createTestingPinia } from '@pinia/testing'
import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import type { TurnId } from '../../schemas/agentApiSchema'

import AgentPanel from './AgentPanel.vue'

const historyGroups = {
  current: [],
  today: [],
  yesterday: [],
  earlier: []
}

function mount(isMaximized = false) {
  return render(AgentPanel, {
    props: { entries: [], historyGroups, isMaximized },
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

function mountChat() {
  return render(AgentPanel, {
    props: {
      entries: [],
      historyGroups,
      sessionId: 'thread-1',
      customTitle: 'Duck pipeline'
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
    localStorage.clear()
  })

  it('shows the minimized run notice and disclaimer by default', () => {
    mount()

    expect(
      screen.getByText(
        "The agent can modify the graph. You'll need to click run to execute the workflow."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText('The AI agent can make mistakes')
    ).toBeInTheDocument()
  })

  it('shows the expanded run notice and disclaimer when maximized', () => {
    mount(true)

    expect(
      screen.getByText(
        "The agent can modify your workflow. You'll need to click run to execute."
      )
    ).toBeInTheDocument()
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

  it('renames the current chat on Enter and blur', async () => {
    const user = userEvent.setup()
    const { emitted } = mountChat()

    await user.click(screen.getByRole('button', { name: 'Duck pipeline' }))
    const input = screen.getByRole('textbox', {
      name: i18n.global.t('g.rename')
    })
    expect(input).toHaveFocus()
    await user.clear(input)
    await user.type(input, 'First rename{Enter}')

    await user.click(screen.getByRole('button', { name: 'Duck pipeline' }))
    const nextInput = screen.getByRole('textbox', {
      name: i18n.global.t('g.rename')
    })
    await user.clear(nextInput)
    await user.type(nextInput, 'Blur rename')
    nextInput.blur()

    expect(emitted().renameChat).toEqual([['First rename'], ['Blur rename']])
  })

  it('abandons a current-chat rename on Escape', async () => {
    const user = userEvent.setup()
    const { emitted } = mountChat()

    await user.click(screen.getByRole('button', { name: 'Duck pipeline' }))
    const input = screen.getByRole('textbox', {
      name: i18n.global.t('g.rename')
    })
    await user.clear(input)
    await user.type(input, 'Discarded{Escape}')

    expect(
      screen.queryByRole('textbox', { name: i18n.global.t('g.rename') })
    ).not.toBeInTheDocument()
    expect(emitted().renameChat).toBeUndefined()
  })

  it('opens chat history and reports the navigation', async () => {
    const user = userEvent.setup()
    const { emitted } = mountChat()

    await user.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.showChatHistory')
      })
    )

    expect(
      screen.getByRole('heading', { name: i18n.global.t('agent.history') })
    ).toBeInTheDocument()
    expect(emitted().openHistory).toEqual([[]])
  })

  it('reports deletion of the current chat', async () => {
    const user = userEvent.setup()
    const { emitted } = mountChat()

    await user.click(
      screen.getByRole('button', { name: i18n.global.t('agent.chatOptions') })
    )
    await user.click(
      await screen.findByRole('menuitem', { name: i18n.global.t('g.delete') })
    )

    expect(emitted().deleteHistory).toEqual([['thread-1']])
  })

  it('focuses the composer input body after a suggestion and clears on blur', async () => {
    const user = userEvent.setup()
    const pinia = createTestingPinia({ stubActions: false })
    setActivePinia(pinia)
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

    expect(textarea).toHaveValue(prompt)
    expect(textarea).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'New chat' }))

    expect(textarea).not.toHaveFocus()
  })

  it('replaces and focuses the composer draft when editing the eligible prompt', async () => {
    const user = userEvent.setup()
    const pinia = createTestingPinia({ stubActions: false })
    setActivePinia(pinia)
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

    expect(textarea).toHaveValue(prompt)
    expect(textarea).toHaveFocus()

    await user.clear(textarea)
    await user.type(textarea, 'Generate a yellow duck at sunrise')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(emitted().send[0]).toEqual(['Generate a yellow duck at sunrise', []])
  })
})
