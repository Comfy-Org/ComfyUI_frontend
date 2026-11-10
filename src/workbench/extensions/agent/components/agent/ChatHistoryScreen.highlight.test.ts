import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import type {
  ChatSession,
  HistoryGroups
} from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import {
  DOCK_PREVIEW_CHARS,
  DOCK_TITLE_CHARS
} from '@/workbench/extensions/agent/utils/chatHistoryRowText'

import ChatHistoryScreen from './ChatHistoryScreen.vue'

const NOW = new Date(2026, 10, 10, 12).getTime()

function session(overrides: Partial<ChatSession> & { id: string }) {
  return {
    title: overrides.id,
    updatedAt: NOW,
    titleSource: 'server',
    ...overrides
  } satisfies ChatSession
}

function groupsOf(...today: ChatSession[]): HistoryGroups {
  return { current: [], today, yesterday: [], earlier: [] }
}

function renderScreen(
  sessions: ChatSession[],
  props: {
    workflowNameFor?: (s: { workflowId?: string }) => string | undefined
    narrow?: boolean
  } = {}
) {
  return render(ChatHistoryScreen, {
    props: { groups: groupsOf(...sessions), ...props },
    global: { plugins: [i18n] }
  })
}

async function search(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(
    screen.getByRole('combobox', { name: 'Search chat history' }),
    text
  )
}

const marks = (row: HTMLElement) =>
  within(row)
    .queryAllByText(/./, { selector: 'mark' })
    .map((m) => m.textContent)

const LONG_WORKFLOW = 'Portrait upscale final (copy 2)'

describe('ChatHistoryScreen search highlights', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
  })

  it('highlights matched text in the title and visible preview, keeping the original case', async () => {
    const user = userEvent.setup()
    renderScreen([
      session({
        id: 'a',
        title: 'Weekly Plan',
        preview: 'Help me plan the week'
      })
    ])

    await search(user, 'PLAN')

    const row = screen.getByRole('button', { name: 'Weekly Plan' })
    expect(marks(row)).toEqual(['Plan', 'plan'])
    expect(within(row).queryByText(/^Message:/)).toBeNull()
  })

  it('highlights only the matched text, not the surrounding words', async () => {
    const user = userEvent.setup()
    renderScreen([session({ id: 'a', title: 'Weekly plan' })])

    await search(user, 'plan')

    const row = screen.getByRole('button', { name: 'Weekly plan' })
    expect(marks(row)).toEqual(['plan'])
    expect(row).toHaveTextContent('Weekly plan')
  })

  it('renders markup-like titles as text, never as HTML', async () => {
    const user = userEvent.setup()
    renderScreen([session({ id: 'a', title: '<b>bold</b> plan' })])

    await search(user, 'bold')

    const row = screen.getByRole('button', { name: '<b>bold</b> plan' })
    expect(within(row).queryByText(/./, { selector: 'b' })).toBeNull()
    expect(row).toHaveTextContent('<b>bold</b> plan')
    expect(marks(row)).toEqual(['bold'])
  })

  it('keeps the row button name equal to the title with highlights and a match line', async () => {
    const user = userEvent.setup()
    const preview = `${'y'.repeat(DOCK_PREVIEW_CHARS + 5)} needle`
    renderScreen([session({ id: 'a', title: 'Short', preview })])

    await search(user, 'needle')

    const row = screen.getByRole('button', { name: 'Short' })
    expect(within(row).getByText(/^Message:/)).toBeVisible()
  })
})

describe('ChatHistoryScreen search match line', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
  })

  it('shows a Message line when the preview match is not visible', async () => {
    const user = userEvent.setup()
    const preview = `${'y'.repeat(DOCK_PREVIEW_CHARS + 5)} needle ${'z'.repeat(60)}`
    renderScreen([session({ id: 'a', title: 'Short', preview })])

    await search(user, 'needle')

    const row = screen.getByRole('button', { name: 'Short' })
    expect(within(row).getByText(/^Message:/)).toBeVisible()
    expect(marks(row)).toEqual(['needle'])
    expect(row).not.toHaveTextContent('z'.repeat(60))
  })

  it('shows a Title line when the title match is beyond the title line', async () => {
    const user = userEvent.setup()
    const title = `${'x'.repeat(DOCK_TITLE_CHARS + 5)} needle`
    renderScreen([session({ id: 'a', title })])

    await search(user, 'needle')

    const row = screen.getByRole('button', { name: title })
    expect(within(row).getByText(/^Title:/)).toBeVisible()
    // Once in the (clipped) title line, once in the match line.
    expect(marks(row)).toEqual(['needle', 'needle'])
  })

  it('shows a Workflow line instead of a tail highlight when the tail is dropped', async () => {
    const user = userEvent.setup()
    renderScreen([session({ id: 'a', title: 'Cats', workflowId: 'wf' })], {
      workflowNameFor: () => LONG_WORKFLOW,
      narrow: true
    })

    await search(user, 'portrait')

    const row = screen.getByRole('button', { name: 'Cats' })
    expect(within(row).getByText(/^Workflow:/)).toBeVisible()
    expect(marks(row)).toEqual(['Portrait'])
  })

  it('shows at most one match line, preferring title over message', async () => {
    const user = userEvent.setup()
    const title = `${'x'.repeat(DOCK_TITLE_CHARS + 5)} needle`
    const preview = `${'y'.repeat(DOCK_PREVIEW_CHARS + 5)} needle`
    renderScreen([session({ id: 'a', title, preview })])

    await search(user, 'needle')

    const row = screen.getByRole('button', { name: title })
    expect(within(row).getAllByText(/^(Title|Message|Workflow):/)).toHaveLength(
      1
    )
    expect(within(row).getByText(/^Title:/)).toBeVisible()
  })

  it('does not show a match line when the matches are visible in the row', async () => {
    const user = userEvent.setup()
    renderScreen(
      [
        session({
          id: 'a',
          title: 'Weekly plan',
          preview: 'Help me plan the week',
          workflowId: 'wf'
        })
      ],
      { workflowNameFor: () => 'Plan board' }
    )

    await search(user, 'plan')

    const row = screen.getByRole('button', { name: 'Weekly plan' })
    expect(within(row).queryByText(/^(Title|Message|Workflow):/)).toBeNull()
    expect(marks(row)).toEqual(['plan', 'plan', 'Plan'])
  })
})

describe('ChatHistoryScreen search workflow tail', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
  })

  it('shows the date untruncated and the workflow name middle-truncated', async () => {
    const user = userEvent.setup()
    renderScreen([session({ id: 'a', title: 'Cats', workflowId: 'wf' })], {
      workflowNameFor: () => LONG_WORKFLOW
    })

    await search(user, 'cats')

    const row = screen.getByRole('button', { name: 'Cats' })
    expect(within(row).getByText('Nov 10')).toBeVisible()
    expect(within(row).queryByText(LONG_WORKFLOW)).toBeNull()
    const tail = within(row).getByText(/^Portrait.*…/)
    expect(tail.textContent).toHaveLength(18)
    expect(tail.textContent.endsWith('(copy 2)')).toBe(true)
  })

  it('keeps a workflow match visible inside the truncated tail', async () => {
    const user = userEvent.setup()
    renderScreen([session({ id: 'a', title: 'Cats', workflowId: 'wf' })], {
      workflowNameFor: () => LONG_WORKFLOW
    })

    await search(user, 'copy')

    const row = screen.getByRole('button', { name: 'Cats' })
    expect(marks(row)).toEqual(['copy'])
    expect(within(row).queryByText(/^Workflow:/)).toBeNull()
  })

  it('drops the workflow tail below the narrow dock but keeps the date', async () => {
    const user = userEvent.setup()
    renderScreen([session({ id: 'a', title: 'Cats', workflowId: 'wf' })], {
      workflowNameFor: () => 'Portrait',
      narrow: true
    })

    await search(user, 'cats')

    const row = screen.getByRole('button', { name: 'Cats' })
    expect(within(row).queryByText('Portrait')).toBeNull()
    expect(within(row).getByText('Nov 10')).toBeVisible()
  })

  it('shrinks the workflow name while the current marker shares the line', async () => {
    const user = userEvent.setup()
    render(ChatHistoryScreen, {
      props: {
        groups: {
          current: [session({ id: 'a', title: 'Cats', workflowId: 'wf' })],
          today: [],
          yesterday: [],
          earlier: []
        },
        workflowNameFor: () => LONG_WORKFLOW
      },
      global: { plugins: [i18n] }
    })

    await search(user, 'cats')

    const row = screen.getByRole('button', { name: 'Cats' })
    expect(within(row).getByText('Current chat')).toBeVisible()
    expect(within(row).getByText('Nov 10')).toBeVisible()
    expect(within(row).getByText(/^Por…/).textContent).toHaveLength(8)
  })
})
