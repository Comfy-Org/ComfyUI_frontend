import type { HistoryGroups } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

import { i18n } from '@/i18n'

import { openFeedbackDialog } from '@/workbench/extensions/agent/feedback'
import type { AgentExperience } from '@/workbench/extensions/agent/experiments/chatRedesign'
import { toTurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import type { ConversationEntry } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import AgentPanel from './AgentPanel.vue'
import { setupInlinePromptEditorDom } from './composer/inlinePromptEditorTestSetup'

vi.mock(import('@/workbench/extensions/agent/feedback'))
vi.mock(import('@/composables/auth/useCurrentUser'))

setupInlinePromptEditorDom()

const tabs = [
  { path: 'workflows/portrait.json', name: 'portrait' },
  { path: 'workflows/upscale.json', name: 'upscale' }
]

function mount(experience: AgentExperience, entries: ConversationEntry[] = []) {
  useAgentPanelStore().experience = experience
  return render(AgentPanel, {
    props: {
      entries,
      historyGroups: { current: [], today: [], yesterday: [], earlier: [] },
      activeTab: tabs[0],
      workflowTabs: tabs,
      visibleTabPath: tabs[0].path
    },
    global: {
      plugins: [i18n],
      directives: { tooltip: {} }
    }
  })
}

const composer = () => screen.getByTestId('agent-composer')
const inputBox = () => screen.getByTestId('composer-input-box')
const workflowPicker = () =>
  screen.getByRole('button', { name: 'Switch workflow' })
const runPermissions = () => screen.getByRole('button', { name: /^Ask/ })

describe('AgentPanel composer in the redesign', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('puts the workflow picker, feedback and run permissions under the input', () => {
    mount('redesign')

    const row = screen.getByRole('group', { name: 'Chat settings' })

    expect(composer()).toContainElement(row)
    expect(inputBox()).not.toContainElement(row)
    expect(row).toContainElement(workflowPicker())
    expect(row).toContainElement(runPermissions())
    expect(
      within(row).getByRole('button', { name: 'Share feedback' })
    ).toBeVisible()
    expect(
      Boolean(
        inputBox().compareDocumentPosition(row) &
        Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true)
  })

  it('keeps the run permissions out of the input card', () => {
    mount('redesign')

    expect(inputBox()).not.toContainElement(runPermissions())
    expect(
      screen.getByRole('textbox', { name: 'Describe what you want to create' })
    ).toBeVisible()
  })

  it('opens the feedback dialog from the row', async () => {
    mount('redesign')

    await userEvent.click(
      screen.getByRole('button', { name: 'Share feedback' })
    )

    expect(openFeedbackDialog).toHaveBeenCalledExactlyOnceWith('agent-panel')
  })

  it('lists the open workflows from the picker in the row', async () => {
    mount('redesign')

    await userEvent.click(workflowPicker())

    expect(
      await screen.findByRole('menuitemradio', { name: 'upscale' })
    ).toBeVisible()
  })

  it('leaves the classic composer as it is', () => {
    mount('classic')

    expect(screen.queryByRole('group', { name: 'Chat settings' })).toBeNull()
    expect(inputBox()).toContainElement(runPermissions())
    expect(composer()).toContainElement(workflowPicker())
    expect(
      Boolean(
        workflowPicker().compareDocumentPosition(inputBox()) &
        Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true)
    expect(
      screen.getAllByRole('button', { name: 'Share feedback' })
    ).toHaveLength(1)
  })
})

function follows(first: Element, second: Element): boolean {
  return Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING
  )
}

describe('AgentPanel empty chat in the redesign', () => {
  beforeEach(() => {
    localStorage.clear()
    window.innerWidth = 1920
    window.dispatchEvent(new Event('resize'))
  })

  const firstMessage: ConversationEntry[] = [
    { id: toTurnId('turn-1'), role: 'user', text: 'Make a fox portrait' }
  ]
  const greeting = () => screen.getByText('What do you want to make?')
  const starterPrompts = () =>
    within(screen.getByTestId('agent-starter-prompts')).getByTestId(
      'suggested-prompts'
    )

  function mountFullscreen() {
    const store = useAgentPanelStore()
    store.experience = 'redesign'
    store.toggleMaximize()
    return { store, ...mount('redesign') }
  }

  const presentations = [
    { presentation: 'docked', mountEmpty: () => mount('redesign') },
    { presentation: 'full screen', mountEmpty: mountFullscreen }
  ]

  it('puts the composer between the greeting and the starter prompts in full screen', () => {
    mountFullscreen()

    expect(follows(greeting(), composer())).toBe(true)
    expect(follows(composer(), starterPrompts())).toBe(true)
    expect(screen.getAllByText('What do you want to make?')).toHaveLength(1)
    expect(screen.getAllByTestId('suggested-prompts')).toHaveLength(1)
  })

  it('keeps the composer under the greeting and the starter prompts while docked', () => {
    mount('redesign')

    expect(follows(greeting(), starterPrompts())).toBe(true)
    expect(follows(starterPrompts(), composer())).toBe(true)
    expect(screen.getAllByText('What do you want to make?')).toHaveLength(1)
    expect(screen.getAllByTestId('suggested-prompts')).toHaveLength(1)
  })

  it('moves the starter prompts above the composer when the panel leaves full screen', async () => {
    const { store } = mountFullscreen()

    store.toggleMaximize()

    await vi.waitFor(() =>
      expect(follows(starterPrompts(), composer())).toBe(true)
    )
    expect(screen.getAllByTestId('suggested-prompts')).toHaveLength(1)
  })

  it.for(presentations)(
    'writes a starter prompt into the composer when it is chosen while $presentation',
    async ({ mountEmpty }) => {
      mountEmpty()
      const [first] = within(starterPrompts()).getAllByRole('button')

      await userEvent.click(first)

      expect(screen.getByRole('textbox')).toHaveTextContent(
        first.textContent.trim()
      )
    }
  )

  it.for(presentations)(
    'drops the greeting and the starter prompts once the chat has a message while $presentation',
    async ({ mountEmpty }) => {
      const view = mountEmpty()

      await view.rerender({ entries: firstMessage })

      expect(screen.queryByText('What do you want to make?')).toBeNull()
      expect(screen.queryByTestId('suggested-prompts')).toBeNull()
      expect(composer()).toBeVisible()
    }
  )

  it('keeps the caret in the composer when the first message is sent', async () => {
    const view = mount('redesign')
    await userEvent.click(screen.getByRole('textbox'))

    await view.rerender({ entries: firstMessage })

    expect(screen.getByRole('textbox')).toHaveFocus()
  })

  it('keeps the caret in the composer when the panel enters full screen', async () => {
    mount('redesign')
    await userEvent.click(screen.getByRole('textbox'))

    useAgentPanelStore().toggleMaximize()

    await vi.waitFor(() =>
      expect(follows(composer(), starterPrompts())).toBe(true)
    )
    expect(screen.getByRole('textbox')).toHaveFocus()
  })

  it('keeps the starter prompts above the composer in the classic experience', () => {
    mount('classic')

    expect(follows(screen.getByTestId('suggested-prompts'), composer())).toBe(
      true
    )
  })
})

describe('AgentPanel target notice in the redesign', () => {
  beforeEach(() => {
    localStorage.clear()
    window.innerWidth = 1920
    window.dispatchEvent(new Event('resize'))
  })

  const followingNotice = () =>
    screen.queryByText(/Target workflow follows the visible tab/)

  function mountFollowing() {
    const store = useAgentPanelStore()
    store.enabled = true
    store.isOpen = true
    store.experience = 'redesign'
    render(AgentPanel, {
      props: {
        entries: [],
        historyGroups: { current: [], today: [], yesterday: [], earlier: [] },
        activeTab: tabs[0],
        workflowTabs: tabs,
        visibleTabPath: tabs[0].path,
        followsVisibleWorkflow: true
      },
      global: { plugins: [i18n], directives: { tooltip: {} } }
    })
    return store
  }

  it('explains that the chat follows the visible tab while docked', () => {
    mountFollowing()

    expect(followingNotice()).toBeVisible()
  })

  it('drops that notice in full screen, where no tab is visible', async () => {
    const store = mountFollowing()

    store.toggleMaximize()

    await vi.waitFor(() => expect(followingNotice()).toBeNull())
  })
})

describe('AgentPanel opening a chat from the sidebar', () => {
  beforeEach(() => {
    localStorage.clear()
    window.innerWidth = 1920
    window.dispatchEvent(new Event('resize'))
  })

  const historyGroups: HistoryGroups = {
    current: [],
    today: [
      { id: 'fox', title: 'Fox portrait', updatedAt: 2, titleSource: 'server' }
    ],
    yesterday: [],
    earlier: []
  }

  function mountFullscreen(
    selectHistory: (id: string) => Promise<boolean> = async () => true
  ) {
    const store = useAgentPanelStore()
    store.enabled = true
    store.isOpen = true
    store.experience = 'redesign'
    store.toggleMaximize()
    const view = render(AgentPanel, {
      props: {
        entries: [],
        historyGroups,
        sessionId: 'previous',
        activeTab: tabs[0],
        workflowTabs: tabs,
        selectHistory
      },
      global: { plugins: [i18n], directives: { tooltip: {} } }
    })
    return { store, ...view }
  }

  it('has no history button, since the sidebar lists the chats', () => {
    mountFullscreen()

    expect(
      screen.queryByRole('button', { name: 'Show chat history' })
    ).toBeNull()
    expect(composer()).toBeVisible()
  })

  it('moves the chat title into the top bar and leaves the brand to the sidebar', () => {
    mountFullscreen()
    const topBar = screen.getByRole('banner')

    expect(
      within(topBar).getByRole('group', { name: 'Chat options' })
    ).toBeVisible()
    expect(
      within(topBar).queryByRole('heading', { name: 'Comfy Agent' })
    ).toBeNull()
    expect(
      within(topBar).queryByRole('button', { name: 'New chat' })
    ).toBeNull()
  })

  it('keeps the brand in the top bar while the sidebar is a rail', async () => {
    const { store } = mountFullscreen()

    store.toggleSidebar()

    expect(
      await within(screen.getByRole('banner')).findByRole('heading', {
        name: 'Comfy Agent'
      })
    ).toBeVisible()
  })

  it('offers to pin the open chat from the top bar', async () => {
    const view = mountFullscreen()

    await userEvent.click(
      within(screen.getByRole('banner')).getByRole('button', {
        name: 'Chat options'
      })
    )
    await userEvent.click(screen.getByRole('menuitem', { name: 'Pin' }))

    expect(view.emitted().togglePinChat).toHaveLength(1)
  })

  it('keeps the brand and the title row where they are while docked', () => {
    mount('redesign')
    const topBar = screen.getByRole('banner')

    expect(
      within(topBar).getByRole('heading', { name: 'Comfy Agent' })
    ).toBeVisible()
    expect(
      within(topBar).getByRole('button', { name: 'New chat' })
    ).toBeVisible()
    expect(
      within(topBar).queryByRole('group', { name: 'Chat options' })
    ).toBeNull()
    expect(screen.getByRole('group', { name: 'Chat options' })).toBeVisible()
  })

  it('keeps the history button while docked', () => {
    mount('redesign')

    expect(
      screen.getByRole('button', { name: 'Show chat history' })
    ).toBeVisible()
  })

  it('shows which chat is opening, then the conversation once it has opened', async () => {
    let finish: (opened: boolean) => void = () => {}
    const selectHistory = vi.fn(
      () => new Promise<boolean>((resolve) => (finish = resolve))
    )
    const { store } = mountFullscreen(selectHistory)

    store.view = {
      screen: 'history',
      previousThreadId: 'previous',
      selection: { status: 'loading', id: 'fox' }
    }

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Opening Fox portrait'
    )
    expect(screen.queryByTestId('agent-composer')).toBeNull()

    store.view = { screen: 'chat' }
    finish(true)

    await vi.waitFor(() => expect(composer()).toBeVisible())
    expect(screen.queryByTestId('agent-chat-opening')).toBeNull()
  })

  it('offers a retry when the chat could not open', async () => {
    const selectHistory = vi.fn(async () => true)
    const { store } = mountFullscreen(selectHistory)
    store.view = {
      screen: 'history',
      previousThreadId: 'previous',
      selection: { status: 'failed', id: 'fox' }
    }

    await userEvent.click(
      await screen.findByRole('button', { name: 'Try again' })
    )

    expect(selectHistory).toHaveBeenCalledWith('fox', expect.any(Function))
    await vi.waitFor(() => expect(composer()).toBeVisible())
  })

  it('keeps the conversation on screen when the list was merely open', () => {
    const { store } = mountFullscreen()

    store.view = {
      screen: 'history',
      previousThreadId: 'previous',
      selection: { status: 'idle' }
    }

    expect(composer()).toBeVisible()
  })
})

describe('AgentPanel deleting a chat with a confirmation', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const historyGroups: HistoryGroups = {
    current: [],
    today: [
      { id: 'fox', title: 'Fox portrait', updatedAt: 2, titleSource: 'server' }
    ],
    yesterday: [],
    earlier: []
  }

  async function deleteFromHistory(confirmDelete?: () => Promise<boolean>) {
    useAgentPanelStore().experience = 'redesign'
    const view = render(AgentPanel, {
      props: {
        entries: [],
        historyGroups,
        sessionId: 'previous',
        confirmDelete
      },
      global: { plugins: [i18n], directives: { tooltip: {} } }
    })
    await userEvent.click(
      screen.getByRole('button', { name: 'Show chat history' })
    )
    await userEvent.click(screen.getByRole('button', { name: 'Chat options' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    return view
  }

  it('deletes once the confirmation is accepted', async () => {
    const confirmDelete = vi.fn(async () => true)

    const view = await deleteFromHistory(confirmDelete)

    expect(confirmDelete).toHaveBeenCalledExactlyOnceWith('fox')
    await vi.waitFor(() =>
      expect(view.emitted().deleteHistory).toEqual([['fox']])
    )
  })

  it('keeps the chat when the confirmation is declined', async () => {
    const confirmDelete = vi.fn(async () => false)

    const view = await deleteFromHistory(confirmDelete)

    await vi.waitFor(() => expect(confirmDelete).toHaveBeenCalledOnce())
    expect(view.emitted().deleteHistory).toBeUndefined()
  })

  it('deletes at once when no confirmation is asked for', async () => {
    const view = await deleteFromHistory()

    await vi.waitFor(() =>
      expect(view.emitted().deleteHistory).toEqual([['fox']])
    )
  })
})
