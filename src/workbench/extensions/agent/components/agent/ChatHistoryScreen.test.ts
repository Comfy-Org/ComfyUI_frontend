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

const secondSession = {
  id: 'thread-2',
  title: 'Second title',
  updatedAt: 2
}

const bucketLabels = /^(Current|Today|Yesterday|Earlier)$/

function groupsWithTitle(title: string): HistoryGroups {
  return {
    ...emptyGroups,
    today: [{ ...originalSession, title }]
  }
}

function groupsWithTwoRows(secondTitle: string): HistoryGroups {
  return {
    ...emptyGroups,
    today: [originalSession, { ...secondSession, title: secondTitle }]
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

function renderedBucketLabels(): (string | null)[] {
  return screen.getAllByText(bucketLabels).map((label) => label.textContent)
}

async function openRename(
  user: ReturnType<typeof userEvent.setup>,
  rowIndex = 0
): Promise<HTMLInputElement> {
  await user.click(
    screen.getAllByRole('button', { name: 'Chat options' })[rowIndex]
  )
  await user.click(await screen.findByRole('menuitem', { name: 'Rename' }))
  return screen.findByRole<HTMLInputElement>('textbox', { name: 'Rename' })
}

describe('ChatHistoryScreen', () => {
  beforeEach(() => {
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

  it('orders populated bucket labels current, today, yesterday, earlier', () => {
    renderScreen({
      current: [{ id: 'thread-c', title: 'Alpha', updatedAt: 4 }],
      today: [{ id: 'thread-t', title: 'Bravo', updatedAt: 3 }],
      yesterday: [{ id: 'thread-y', title: 'Charlie', updatedAt: 2 }],
      earlier: [{ id: 'thread-e', title: 'Delta', updatedAt: 1 }]
    })

    expect(renderedBucketLabels()).toEqual([
      'Current',
      'Today',
      'Yesterday',
      'Earlier'
    ])
  })

  it('renders no label for an empty bucket', () => {
    renderScreen({ ...emptyGroups, earlier: [originalSession] })

    expect(renderedBucketLabels()).toEqual(['Earlier'])
    expect(screen.queryByText('Today')).toBeNull()
  })

  it('shows the empty state only while every bucket is empty', async () => {
    const { rerender } = renderScreen()

    expect(screen.getByText('No conversations yet')).toBeVisible()

    await rerender({ groups: groupsWithTitle('Original title') })

    expect(screen.queryByText('No conversations yet')).toBeNull()
  })

  it('scopes select, copy, and delete to the invoked row', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen(groupsWithTwoRows(''))

    await user.click(screen.getByRole('button', { name: 'Untitled' }))
    await user.click(
      screen.getAllByRole('button', { name: 'Copy as markdown' })[1]
    )
    await user.click(screen.getAllByRole('button', { name: 'Chat options' })[1])
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))

    expect(emitted().select).toEqual([['thread-2']])
    expect(emitted().copyMarkdown).toEqual([['thread-2']])
    expect(emitted().delete).toEqual([['thread-2']])
    expect(screen.getByRole('button', { name: 'Original title' })).toBeVisible()
    expect(emitted().rename).toBeUndefined()
  })

  it('opens and commits a rename on the invoked row only', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen(groupsWithTwoRows('Second title'))

    const input = await openRename(user, 1)

    expect(screen.getAllByRole('textbox', { name: 'Rename' })).toHaveLength(1)
    expect(input).toHaveValue('Second title')
    expect(screen.getByRole('button', { name: 'Original title' })).toBeVisible()

    await user.clear(input)
    await user.type(input, 'Second renamed{Enter}')

    expect(emitted().rename).toEqual([['thread-2', 'Second renamed']])
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

  it('emits trimmed rename and renders the parent-updated title', async () => {
    const user = userEvent.setup()
    const { emitted, rerender } = renderScreen(
      groupsWithTitle('Original title')
    )
    const input = await openRename(user)

    await user.clear(input)
    await user.type(input, '  Findable title  {Enter}')

    expect(emitted().rename).toEqual([['thread-1', 'Findable title']])

    await rerender({ groups: groupsWithTitle('Findable title') })

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

  it('discards a partial rename when focus leaves the input', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen(groupsWithTitle('Original title'))
    const input = await openRename(user)

    await user.clear(input)
    await user.type(input, 'Partial title')
    await user.tab()

    expect(screen.queryByRole('textbox', { name: 'Rename' })).toBeNull()
    expect(emitted().rename).toBeUndefined()
  })

  // The close-auto-focus fence is conditional: it must not eat the focus
  // restore when the menu is dismissed without starting a rename, or keyboard
  // users lose their place to <body>.
  it('returns focus to the options trigger when the menu closes without a rename', async () => {
    const user = userEvent.setup()
    renderScreen(groupsWithTitle('Original title'))

    const trigger = screen.getByRole('button', { name: 'Chat options' })
    await user.click(trigger)
    await screen.findByRole('menuitem', { name: 'Rename' })
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it('still discards the draft on Escape', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen(groupsWithTitle('Original title'))
    const input = await openRename(user)

    await user.clear(input)
    await user.type(input, 'Discarded')
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('textbox', { name: 'Rename' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Original title' })).toBeVisible()
    expect(emitted().rename).toBeUndefined()
  })

  it('keeps the editor focused and the draft intact when the row changes bucket mid-rename', async () => {
    const user = userEvent.setup()
    const { rerender } = renderScreen(groupsWithTitle('Original title'))
    const input = await openRename(user)

    await user.clear(input)
    await user.type(input, 'Half typed')

    await rerender({
      groups: { ...emptyGroups, yesterday: [originalSession] }
    })

    const moved = await screen.findByRole<HTMLInputElement>('textbox', {
      name: 'Rename'
    })
    expect(moved).toHaveFocus()
    expect(moved.value).toBe('Half typed')

    await user.type(moved, ' and more')
    expect(moved.value).toBe('Half typed and more')
  })

  it('clears a rename when its session disappears', async () => {
    const user = userEvent.setup()
    const { emitted, rerender } = renderScreen(
      groupsWithTwoRows('Second title')
    )
    const input = await openRename(user)

    await user.clear(input)
    await user.type(input, 'Stale draft')
    await rerender({
      groups: { ...emptyGroups, today: [secondSession] }
    })

    expect(screen.queryByRole('textbox', { name: 'Rename' })).toBeNull()
    expect(emitted().rename).toBeUndefined()

    const trigger = screen.getByRole('button', { name: 'Chat options' })
    await user.click(trigger)
    await screen.findByRole('menuitem', { name: 'Rename' })
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
  })

  it('caps how long a renamed title can grow', async () => {
    const user = userEvent.setup()
    renderScreen(groupsWithTitle('Original title'))
    const input = await openRename(user)

    await user.clear(input)
    await user.paste('x'.repeat(250))

    expect(input.value).toHaveLength(200)
  })

  it('falls back to the untitled label for a whitespace-only title', () => {
    renderScreen(groupsWithTitle('   '))

    expect(screen.getByRole('button', { name: 'Untitled' })).toBeVisible()
  })

  it('emits no rename when only surrounding whitespace differs', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen(groupsWithTitle('  Padded  '))
    const input = await openRename(user)

    await user.keyboard('{Enter}')

    expect(input.value).toBe('  Padded  ')
    expect(emitted().rename).toBeUndefined()
  })

  // Deliberately asserts only that nothing is silently committed. Whether the
  // editor should survive a regroup is unsettled, so this test does not pin it.
  it('commits nothing when the row changes bucket mid-rename', async () => {
    const user = userEvent.setup()
    const { emitted, rerender } = renderScreen(
      groupsWithTitle('Original title')
    )
    const input = await openRename(user)

    await user.clear(input)
    await user.type(input, 'Renamed mid-move')

    await rerender({
      groups: { ...emptyGroups, yesterday: [originalSession] }
    })

    expect(emitted().rename).toBeUndefined()
    expect(
      screen.queryByRole('button', { name: 'Renamed mid-move' })
    ).toBeNull()
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
