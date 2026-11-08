import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import type {
  ChatSession,
  HistoryGroups
} from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'

import ChatHistoryScreen from './ChatHistoryScreen.vue'

const emptyGroups: HistoryGroups = {
  current: [],
  today: [],
  yesterday: [],
  earlier: []
}

const originalSession: ChatSession = {
  id: 'thread-1',
  title: 'Original title',
  updatedAt: 1,
  titleSource: 'server'
}

const secondSession: ChatSession = {
  id: 'thread-2',
  title: 'Second title',
  updatedAt: 2,
  titleSource: 'server'
}

function renderScreen(
  groups: HistoryGroups = emptyGroups,
  rowState: { loadingId?: string; failedId?: string } = {}
) {
  return render(ChatHistoryScreen, {
    props: { groups, ...rowState },
    global: {
      plugins: [i18n]
    }
  })
}

describe('ChatHistoryScreen', () => {
  beforeEach(() => {
    vi.useRealTimers()
    i18n.global.locale.value = 'en'
  })

  it('renders a separate back control and Chat History heading', () => {
    renderScreen()

    expect(
      screen.getByRole('button', { name: 'Back to previous chat' })
    ).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Chat history' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Chat history' })).toBeNull()
  })

  it('shows the exact back tooltip after hovering the control', async () => {
    const user = userEvent.setup()
    renderScreen()

    const back = screen.getByRole('button', {
      name: 'Back to previous chat'
    })
    expect(screen.queryByRole('tooltip')).toBeNull()
    await user.hover(back)

    expect(await screen.findByTestId('tooltip-content')).toHaveTextContent(
      'Back to previous chat'
    )
  })

  it('emits back when the back control is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen()

    await user.click(
      screen.getByRole('button', { name: 'Back to previous chat' })
    )

    expect(emitted().back).toEqual([[]])
  })

  it('emits select, copy, delete, and rename from a list row', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen({
      ...emptyGroups,
      today: [originalSession]
    })

    await user.click(screen.getByRole('button', { name: 'Original title' }))
    await user.click(screen.getByRole('button', { name: 'Copy as markdown' }))
    await user.click(screen.getByRole('button', { name: 'Chat options' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Chat options' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }))
    const input = await screen.findByRole('textbox', { name: 'Rename' })
    await user.clear(input)
    await user.type(input, 'Renamed title{Enter}')

    expect(emitted().select).toEqual([['thread-1']])
    expect(emitted().copyMarkdown).toEqual([['thread-1']])
    expect(emitted().delete).toEqual([['thread-1']])
    expect(emitted().rename).toEqual([['thread-1', 'Renamed title']])
    expect(emitted().back).toBeUndefined()
  })

  it('shows which row is loading and which row failed to open', () => {
    renderScreen(
      { ...emptyGroups, today: [originalSession, secondSession] },
      { loadingId: 'thread-1', failedId: 'thread-2' }
    )

    expect(
      screen.getByRole('button', { name: 'Original title' })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Second title' })).toBeEnabled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not open. Select this chat to retry.'
    )
  })
})
