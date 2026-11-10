import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
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

function field() {
  return screen.getByRole('combobox', { name: 'Search chat history' })
}

const bucketLabels = /^(Current|Today|Yesterday|Earlier)$/

describe('ChatHistoryScreen keyboard path', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
  })

  it('first Esc clears the query, keeps focus in the field and stays in History', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen()
    await user.type(field(), 'plan')

    await user.keyboard('{Escape}')

    expect(field()).toHaveValue('')
    expect(field()).toHaveFocus()
    expect(screen.getAllByText(bucketLabels)).toHaveLength(3)
    expect(emitted('back')).toBeUndefined()
  })

  it('a second Esc leaves History', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen()
    await user.type(field(), 'plan')

    await user.keyboard('{Escape}{Escape}')

    expect(emitted('back')).toHaveLength(1)
  })

  it('Esc with an empty query leaves History immediately', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen()
    await user.click(field())

    await user.keyboard('{Escape}')

    expect(emitted('back')).toHaveLength(1)
  })

  it('ArrowDown twice then Enter opens the second result like a click', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen()
    await user.type(field(), 'plan')

    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getByRole('button', { name: 'Weekly plan' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(emitted('select')).toEqual([['plan-today']])
  })

  it('ArrowUp moves back up and from the first result returns to the field', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(field(), 'plan')

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}')
    expect(screen.getByRole('button', { name: 'Deploy plan' })).toHaveFocus()
    await user.keyboard('{ArrowUp}')

    expect(field()).toHaveFocus()
  })

  it('stops at the last result without wrapping', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(field(), 'plan')

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}')

    expect(screen.getByRole('button', { name: 'Old plan' })).toHaveFocus()
  })

  it('ArrowDown with no results does nothing', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(field(), 'zzzq')

    await user.keyboard('{ArrowDown}')

    expect(field()).toHaveFocus()
  })

  it('ArrowDown on an empty query does not leave the field', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(field())

    await user.keyboard('{ArrowDown}')

    expect(field()).toHaveFocus()
  })

  it('Esc on a focused result returns to the field and clears the query', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen()
    await user.type(field(), 'plan')
    await user.keyboard('{ArrowDown}')

    await user.keyboard('{Escape}')

    expect(field()).toHaveFocus()
    expect(field()).toHaveValue('')
    expect(emitted('back')).toBeUndefined()
  })

  it('typing while a result is focused continues in the field', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(field(), 'pla')
    await user.keyboard('{ArrowDown}')

    await user.keyboard('n')

    expect(field()).toHaveFocus()
    expect(field()).toHaveValue('plan')
  })

  it('Esc while renaming a result cancels the rename without leaving History', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen()
    await user.type(field(), 'plan')
    await user.click(screen.getAllByRole('button', { name: 'Chat options' })[1])
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }))
    expect(screen.getByRole('textbox', { name: 'Rename' })).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('textbox', { name: 'Rename' })).toBeNull()
    expect(emitted('back')).toBeUndefined()
  })

  it('labels the results as a list', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(field(), 'plan')

    expect(
      screen.getByRole('list', { name: 'Search results' })
    ).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })
})
