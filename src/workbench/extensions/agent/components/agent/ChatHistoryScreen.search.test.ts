import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import type {
  ChatSession,
  HistoryGroups
} from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'

import ChatHistoryScreen from './ChatHistoryScreen.vue'

const NOW = new Date(2026, 10, 10, 12).getTime()
const DAY = 24 * 60 * 60 * 1000

function session(overrides: Partial<ChatSession> & { id: string }) {
  return {
    title: overrides.id,
    updatedAt: NOW,
    titleSource: 'server',
    ...overrides
  } satisfies ChatSession
}

const current = session({
  id: 'current',
  title: 'Deploy plan',
  updatedAt: NOW
})
const planToday = session({
  id: 'plan-today',
  title: 'Weekly plan',
  preview: 'Help me plan the week',
  workflowId: 'wf-1',
  updatedAt: NOW - 1000
})
const planEarlier = session({
  id: 'plan-earlier',
  title: 'Old plan',
  updatedAt: NOW - 10 * DAY
})
const unrelated = session({
  id: 'unrelated',
  title: 'Cats',
  updatedAt: NOW - 2000
})

const groups: HistoryGroups = {
  current: [current],
  today: [planToday, unrelated],
  yesterday: [],
  earlier: [planEarlier]
}

function renderScreen(
  props: {
    groups?: HistoryGroups
    workflowNameFor?: (s: { workflowId?: string }) => string | undefined
  } = {}
) {
  return render(ChatHistoryScreen, {
    props: { groups, ...props },
    global: { plugins: [i18n] }
  })
}

async function search(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(
    screen.getByRole('combobox', { name: 'Search chat history' }),
    text
  )
}

const bucketLabels = /^(Current|Today|Yesterday|Earlier)$/

describe('ChatHistoryScreen search', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
  })

  it('shows an unfocused search field above the unchanged grouped list', () => {
    renderScreen()

    const field = screen.getByRole('combobox', { name: 'Search chat history' })
    expect(field).toHaveAttribute('placeholder', 'Search chats')
    expect(field).not.toHaveFocus()
    expect(screen.getAllByText(bucketLabels).map((l) => l.textContent)).toEqual(
      ['Current', 'Today', 'Earlier']
    )
    expect(
      screen.getAllByRole('button', { name: 'Chat options' })
    ).toHaveLength(4)
  })

  it('treats a whitespace-only query as no query', async () => {
    const user = userEvent.setup()
    renderScreen()

    await search(user, '   ')

    expect(screen.getAllByText(bucketLabels)).toHaveLength(3)
  })

  it('replaces the grouped list with flat results in recency order', async () => {
    const user = userEvent.setup()
    renderScreen()

    await search(user, 'plan')

    expect(screen.queryByText(bucketLabels)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cats' })).toBeNull()
    expect(
      screen
        .getAllByRole('button', { name: /plan/i })
        .map((button) => button.getAttribute('aria-label'))
    ).toEqual(['Deploy plan', 'Weekly plan', 'Old plan'])
  })

  it('shows title, single-line preview and own date on each result', async () => {
    const user = userEvent.setup()
    renderScreen()

    await search(user, 'weekly')

    const row = screen.getByRole('button', { name: 'Weekly plan' })
    expect(within(row).getByText('Help me plan the week')).toBeVisible()
    expect(within(row).getByText('Nov 10')).toBeVisible()
  })

  it('shows each result with its own date, not a day header', async () => {
    const user = userEvent.setup()
    renderScreen()

    await search(user, 'old')

    expect(
      within(screen.getByRole('button', { name: 'Old plan' })).getByText(
        'Oct 31'
      )
    ).toBeVisible()
  })

  it('shows the workflow name only when it is resolved', async () => {
    const user = userEvent.setup()
    renderScreen({
      workflowNameFor: (s) =>
        s.workflowId === 'wf-1' ? 'Portrait flow' : undefined
    })

    await search(user, 'plan')

    expect(
      within(screen.getByRole('button', { name: 'Weekly plan' })).getByText(
        'Portrait flow'
      )
    ).toBeVisible()
    expect(screen.getAllByText('Portrait flow')).toHaveLength(1)
  })

  it('does not render workflow text when no resolver is provided', async () => {
    const user = userEvent.setup()
    renderScreen()

    await search(user, 'weekly')

    expect(screen.queryByText('Portrait flow')).toBeNull()
  })

  it('marks a matching current chat and nothing else', async () => {
    const user = userEvent.setup()
    renderScreen()

    await search(user, 'plan')

    expect(screen.getAllByText('Current chat')).toHaveLength(1)
    expect(
      within(screen.getByRole('button', { name: 'Deploy plan' })).getByText(
        'Current chat'
      )
    ).toBeVisible()
  })

  it('hides a non-matching current chat while a query is active', async () => {
    const user = userEvent.setup()
    renderScreen()

    await search(user, 'cats')

    expect(screen.getByRole('button', { name: 'Cats' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Deploy plan' })).toBeNull()
    expect(screen.queryByText('Current chat')).toBeNull()
  })

  it('shows no-results text containing the query', async () => {
    const user = userEvent.setup()
    renderScreen()

    await search(user, 'zzzq')

    expect(screen.getByText('No chats match "zzzq"')).toBeVisible()
    expect(screen.queryByText('No conversations yet')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Chat options' })).toBeNull()
  })

  it('opens a result through the same select event as a grouped row', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen()

    await search(user, 'old')
    await user.click(screen.getByRole('button', { name: 'Old plan' }))

    expect(emitted().select).toEqual([['plan-earlier']])
  })

  it('keeps copy and delete actions on result rows', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen()

    await search(user, 'old')
    await user.click(screen.getByRole('button', { name: 'Copy as markdown' }))
    await user.click(screen.getByRole('button', { name: 'Chat options' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))

    expect(emitted().copyMarkdown).toEqual([['plan-earlier']])
    expect(emitted().delete).toEqual([['plan-earlier']])
  })

  it('restores the grouped list when the query is cleared', async () => {
    const user = userEvent.setup()
    renderScreen()

    await search(user, 'plan')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(screen.getAllByText(bucketLabels)).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Cats' })).toBeVisible()
  })
})
