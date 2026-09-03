import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import type { HistoryGroups } from '../../stores/agent/agentChatHistoryStore'

import ChatHistoryScreen from './ChatHistoryScreen.vue'

const emptyGroups: HistoryGroups = {
  current: [],
  today: [],
  yesterday: [],
  earlier: []
}

const originalSession = {
  id: 'thread-1',
  title: 'Original title',
  updatedAt: 1
}

function groupsWithTitle(title: string): HistoryGroups {
  return {
    ...emptyGroups,
    today: [{ ...originalSession, title }]
  }
}

function renderScreen(groups: HistoryGroups = emptyGroups) {
  return render(ChatHistoryScreen, {
    props: { groups },
    global: {
      plugins: [i18n]
    }
  })
}

async function openRename(
  user: ReturnType<typeof userEvent.setup>
): Promise<HTMLInputElement> {
  await user.click(screen.getByRole('button', { name: 'Chat options' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Rename' }))
  return screen.findByRole<HTMLInputElement>('textbox', { name: 'Rename' })
}

describe('ChatHistoryScreen', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
  })

  it('renders a separate back control and Chat History heading', () => {
    renderScreen()

    const back = screen.getByRole('button', {
      name: 'Back to previous chat'
    })
    // eslint-disable-next-line testing-library/no-node-access -- Iconify icons have no accessible role
    const icon = back.querySelector('.icon-\\[lucide--chevron-left\\]')

    expect(icon).toHaveClass('size-4')
    expect(screen.getByRole('heading', { name: 'Chat history' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Chat history' })).toBeNull()
  })

  it('shows the exact back tooltip after hovering the control', async () => {
    const user = userEvent.setup()
    renderScreen()

    const back = screen.getByRole('button', {
      name: 'Back to previous chat'
    })
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull()
    await user.hover(back)

    expect(
      await screen.findByRole('tooltip', { hidden: true })
    ).toHaveTextContent('Back to previous chat')
  })

  it('emits back when the back control is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen()

    await user.click(
      screen.getByRole('button', { name: 'Back to previous chat' })
    )

    expect(emitted().back).toEqual([[]])
  })

  it('preserves select, copy, and delete actions on a history row', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen(groupsWithTitle(''))

    const options = screen.getByRole('button', { name: 'Chat options' })
    expect(options).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Untitled' }))
    await user.click(screen.getByRole('button', { name: 'Copy as markdown' }))
    await user.click(options)
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))

    expect(emitted().select).toEqual([['thread-1']])
    expect(emitted().copyMarkdown).toEqual([['thread-1']])
    expect(emitted().delete).toEqual([['thread-1']])
    expect(emitted().rename).toBeUndefined()
  })

  it('shows the exact copy tooltip on a history row', async () => {
    const user = userEvent.setup()
    renderScreen(groupsWithTitle('Original title'))

    await user.hover(screen.getByRole('button', { name: 'Copy as markdown' }))

    expect(
      await screen.findByRole('tooltip', { hidden: true })
    ).toHaveTextContent('Copy as markdown')
  })

  it('opens a selected inline edit from the history-row menu', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen(groupsWithTitle('Original title'))

    await user.click(screen.getByRole('button', { name: 'Chat options' }))
    const menu = await screen.findByRole('menu')
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['Rename', 'Delete'])
    await user.click(within(menu).getByRole('menuitem', { name: 'Rename' }))
    const input = await screen.findByRole<HTMLInputElement>('textbox', {
      name: 'Rename'
    })

    expect(input).toHaveFocus()
    expect(input).toHaveValue('Original title')
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(input.value.length)
    expect(screen.queryByRole('button', { name: 'Original title' })).toBeNull()
    expect(emitted().select).toBeUndefined()
  })

  it('saves on Enter and shows the persisted title after reopening history', async () => {
    const user = userEvent.setup()
    const { emitted, rerender, unmount } = renderScreen(
      groupsWithTitle('Original title')
    )
    const input = await openRename(user)

    await user.clear(input)
    await user.type(input, '  Findable title  {Enter}')

    expect(emitted().rename).toEqual([['thread-1', 'Findable title']])
    await rerender({ groups: groupsWithTitle('Findable title') })
    expect(screen.getByRole('button', { name: 'Findable title' })).toBeVisible()

    unmount()
    renderScreen(groupsWithTitle('Findable title'))
    expect(screen.getByRole('button', { name: 'Findable title' })).toBeVisible()
  })

  it('cancels a history-row rename on Escape', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen(groupsWithTitle('Original title'))
    const input = await openRename(user)

    await user.clear(input)
    await user.type(input, 'Discarded{Escape}')

    expect(screen.queryByRole('textbox', { name: 'Rename' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Original title' })).toBeVisible()
    expect(screen.queryByText('Discarded')).toBeNull()
    expect(emitted().rename).toBeUndefined()
  })

  it('cancels a history-row rename when focus leaves the input', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen(groupsWithTitle('Original title'))
    const input = await openRename(user)

    await user.clear(input)
    await user.type(input, 'Discarded')
    await user.tab()

    expect(screen.queryByRole('textbox', { name: 'Rename' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Original title' })).toBeVisible()
    expect(screen.queryByText('Discarded')).toBeNull()
    expect(emitted().rename).toBeUndefined()
  })

  it('ignores empty or unchanged titles', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen(groupsWithTitle('Original title'))
    await openRename(user)

    await user.keyboard('{Enter}')
    expect(screen.queryByRole('textbox', { name: 'Rename' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Original title' })).toBeVisible()
    expect(emitted().rename).toBeUndefined()

    const emptyInput = await openRename(user)
    await user.clear(emptyInput)
    await user.type(emptyInput, '   ')
    await user.keyboard('{Enter}')
    expect(screen.queryByRole('textbox', { name: 'Rename' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Original title' })).toBeVisible()
    expect(emitted().rename).toBeUndefined()
  })
})
