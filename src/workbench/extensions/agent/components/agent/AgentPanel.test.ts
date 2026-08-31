import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
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

const chatHistoryStub = defineComponent({
  emits: ['back', 'select', 'delete', 'copy-markdown', 'rename'],
  template: `
    <div data-testid="chat-history">
      <button type="button" @click="$emit('back')">Back to chat</button>
      <button type="button" @click="$emit('select', 'history-1')">Open saved chat</button>
      <button type="button" @click="$emit('delete', 'history-1')">Delete saved chat</button>
      <button type="button" @click="$emit('copy-markdown', 'history-1')">Copy saved chat</button>
      <button type="button" @click="$emit('rename', 'history-1', 'Renamed saved chat')">Rename saved chat</button>
    </div>
  `
})

const eventComposerStub = defineComponent({
  emits: [
    'send',
    'stop',
    'attach',
    'openAssets',
    'selectNodes',
    'removeTag',
    'focusTag',
    'mentionPick'
  ],
  setup(_, { expose }) {
    expose({
      insert: () => {},
      replaceDraft: () => {},
      addAttachment: () => {},
      updateAttachment: () => {},
      removeAttachment: () => {}
    })
  },
  template: `
    <div>
      <slot name="header" />
      <button type="button" @click="$emit('send', 'Forwarded prompt', [])">Composer send</button>
      <button type="button" @click="$emit('stop')">Composer stop</button>
      <button type="button" @click="$emit('attach')">Composer attach</button>
      <button type="button" @click="$emit('openAssets')">Composer assets</button>
      <button type="button" @click="$emit('selectNodes')">Composer select nodes</button>
      <button type="button" @click="$emit('removeTag', 'tag-1')">Composer remove tag</button>
      <button type="button" @click="$emit('focusTag', 'tag-1')">Composer focus tag</button>
      <button type="button" @click="$emit('mentionPick', { id: 'node-1', title: 'KSampler' })">Composer mention</button>
    </div>
  `
})

const eventWorkflowChipStub = defineComponent({
  emits: ['selectTab', 'clear'],
  template: `
    <div>
      <button type="button" @click="$emit('selectTab', 'workflow-1')">Select workflow</button>
      <button type="button" @click="$emit('clear')">Clear workflow</button>
    </div>
  `
})

const eventPanelHeaderStub = defineComponent({
  emits: ['newChat', 'toggleSize', 'close'],
  template: `
    <header>
      <button type="button" @click="$emit('newChat')">Header new chat</button>
      <button type="button" @click="$emit('toggleSize')">Header toggle size</button>
      <button type="button" @click="$emit('close')">Header close</button>
    </header>
  `
})

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

  it('focuses the composer input body after a suggestion and clears on blur', async () => {
    const user = userEvent.setup()
    const pinia = createPinia()
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
    const pinia = createPinia()
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

  it('switches into history mode and routes history actions', async () => {
    const user = userEvent.setup()
    const { emitted } = render(AgentPanel, {
      props: { entries: [], historyGroups },
      global: {
        plugins: [i18n],
        stubs: {
          ChatHistoryScreen: chatHistoryStub,
          Composer: true,
          EmptyState: true,
          PanelHeader: true
        }
      }
    })

    await user.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.showChatHistory')
      })
    )

    expect(emitted().openHistory).toHaveLength(1)
    expect(screen.getByTestId('chat-history')).toBeInTheDocument()
    expect(
      screen.queryByText('The AI agent can make mistakes')
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete saved chat' }))
    await user.click(screen.getByRole('button', { name: 'Copy saved chat' }))
    await user.click(screen.getByRole('button', { name: 'Rename saved chat' }))
    await user.click(screen.getByRole('button', { name: 'Open saved chat' }))

    expect(emitted().deleteHistory[0]).toEqual(['history-1'])
    expect(emitted().copyHistory[0]).toEqual(['history-1'])
    expect(emitted().renameHistory[0]).toEqual([
      'history-1',
      'Renamed saved chat'
    ])
    expect(emitted().selectHistory[0]).toEqual(['history-1'])
    expect(screen.queryByTestId('chat-history')).not.toBeInTheDocument()
  })

  it('renames the current chat from the title button', async () => {
    const user = userEvent.setup()
    const { emitted } = render(AgentPanel, {
      props: {
        entries: [],
        historyGroups,
        sessionId: 'thread-1',
        customTitle: 'Before title'
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

    await user.click(screen.getByRole('button', { name: 'Before title' }))
    const renameInput = screen.getByRole('textbox', {
      name: i18n.global.t('g.rename')
    })
    await user.clear(renameInput)
    await user.type(renameInput, 'After title{Enter}')

    expect(emitted().renameChat[0]).toEqual(['After title'])
    expect(screen.getByRole('button', { name: 'Before title' })).toHaveFocus()
  })

  it('cancels chat rename without emitting a rename', async () => {
    const user = userEvent.setup()
    const { emitted } = render(AgentPanel, {
      props: {
        entries: [],
        historyGroups,
        sessionId: 'thread-1',
        customTitle: 'Draft title'
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

    await user.click(screen.getByRole('button', { name: 'Draft title' }))
    await user.type(
      screen.getByRole('textbox', { name: i18n.global.t('g.rename') }),
      ' ignored{Escape}'
    )

    expect(emitted().renameChat).toBeUndefined()
    expect(screen.getByRole('button', { name: 'Draft title' })).toHaveFocus()
  })

  it('forwards header, composer, and workflow chip actions', async () => {
    const user = userEvent.setup()
    const { emitted } = render(AgentPanel, {
      props: { entries: [], historyGroups },
      global: {
        plugins: [i18n],
        stubs: {
          Composer: eventComposerStub,
          EmptyState: true,
          PanelHeader: eventPanelHeaderStub,
          WorkflowSelectorChip: eventWorkflowChipStub
        }
      }
    })

    await user.click(screen.getByRole('button', { name: 'Header new chat' }))
    await user.click(screen.getByRole('button', { name: 'Header toggle size' }))
    await user.click(screen.getByRole('button', { name: 'Header close' }))
    await user.click(screen.getByRole('button', { name: 'Composer send' }))
    await user.click(screen.getByRole('button', { name: 'Composer stop' }))
    await user.click(screen.getByRole('button', { name: 'Composer attach' }))
    await user.click(screen.getByRole('button', { name: 'Composer assets' }))
    await user.click(
      screen.getByRole('button', { name: 'Composer select nodes' })
    )
    await user.click(
      screen.getByRole('button', { name: 'Composer remove tag' })
    )
    await user.click(screen.getByRole('button', { name: 'Composer focus tag' }))
    await user.click(screen.getByRole('button', { name: 'Composer mention' }))
    await user.click(screen.getByRole('button', { name: 'Select workflow' }))
    await user.click(screen.getByRole('button', { name: 'Clear workflow' }))

    expect(emitted().newChat).toHaveLength(1)
    expect(emitted().toggleSize).toHaveLength(1)
    expect(emitted().close).toHaveLength(1)
    expect(emitted().send[0]).toEqual(['Forwarded prompt', []])
    expect(emitted().stop).toHaveLength(1)
    expect(emitted().attach).toHaveLength(1)
    expect(emitted().openAssets).toHaveLength(1)
    expect(emitted().selectNodes).toHaveLength(1)
    expect(emitted().removeTag[0]).toEqual(['tag-1'])
    expect(emitted().focusTag[0]).toEqual(['tag-1'])
    expect(emitted().mentionPick[0]).toEqual([
      { id: 'node-1', title: 'KSampler' }
    ])
    expect(emitted().selectTab[0]).toEqual(['workflow-1'])
    expect(emitted().clearWorkflow).toHaveLength(1)
  })
})
