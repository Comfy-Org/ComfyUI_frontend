import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import { i18n } from '@/i18n'
import type { HistoryGroups } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'

import ChatList from './ChatList.vue'

const groups: HistoryGroups = {
  pinned: [
    {
      id: 'sheet',
      title: 'Character sheet',
      updatedAt: 1,
      titleSource: 'server',
      workflowId: 'wf-1'
    }
  ],
  current: [],
  today: [
    {
      id: 'fox',
      title: 'Fox portrait',
      updatedAt: 3,
      titleSource: 'server',
      workflowId: 'wf-2'
    },
    {
      id: 'plain',
      title: 'Fix sampler errors',
      updatedAt: 2,
      titleSource: 'server'
    }
  ],
  yesterday: [],
  earlier: []
}

const workflowNames = new Map([['wf-1', 'astronaut_sheet']])

function renderList(props: Partial<ComponentProps<typeof ChatList>> = {}) {
  return render(ChatList, {
    props: { groups, ...props },
    global: { plugins: [i18n] }
  })
}

function rowOf(title: string): HTMLElement {
  const row = screen
    .getAllByTestId('chat-row')
    .find((candidate) =>
      within(candidate).queryByRole('button', { name: title })
    )
  if (!row) throw new Error(`row for ${title} not found`)
  return row
}

async function openRowMenu(title: string) {
  await userEvent.click(
    within(rowOf(title)).getByRole('button', { name: 'Chat options' })
  )
  return screen.getByRole('menu')
}

describe('ChatList in the sidebar', () => {
  it('lists pinned chats first, under their own heading', () => {
    renderList({ pinnedIds: new Set(['sheet']) })

    const headings = screen
      .getAllByText(/^(Pinned|Current|Today|Yesterday|Earlier)$/)
      .map((heading) => heading.textContent)

    expect(headings).toEqual(['Pinned', 'Today'])
  })

  it('offers Pin for an unpinned chat and Unpin for a pinned one', async () => {
    const view = renderList({ pinnedIds: new Set(['sheet']) })

    await userEvent.click(
      within(await openRowMenu('Fox portrait')).getByRole('menuitem', {
        name: 'Pin'
      })
    )
    await userEvent.click(
      within(await openRowMenu('Character sheet')).getByRole('menuitem', {
        name: 'Unpin'
      })
    )

    expect(view.emitted().togglePin).toEqual([['fox'], ['sheet']])
  })

  it('has no pin entry when pins are not in use', async () => {
    renderList()

    const menu = await openRowMenu('Fox portrait')

    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent.trim())
    ).toEqual(['Rename', 'Delete'])
  })

  it('names the workflow under each chat, or says there is none', () => {
    renderList({ workflowNames })

    expect(
      within(rowOf('Character sheet')).getByTestId('chat-workflow-name')
    ).toHaveTextContent('astronaut_sheet')
    expect(
      within(rowOf('Fix sampler errors')).getByTestId('chat-workflow-name')
    ).toHaveTextContent('No workflow')
    expect(
      within(rowOf('Fox portrait')).queryByTestId('chat-workflow-name')
    ).toBeNull()
  })

  it('shows no workflow line when names are not provided', () => {
    renderList()

    expect(screen.queryByTestId('chat-workflow-name')).toBeNull()
  })

  it('marks the open chat in place', () => {
    renderList({ activeId: 'fox' })

    expect(rowOf('Fox portrait')).toHaveAttribute('aria-current', 'true')
    expect(rowOf('Character sheet')).not.toHaveAttribute('aria-current')
  })

  it('opens the chat from its workflow name when the whole row selects', async () => {
    const view = renderList({ workflowNames, fullRowSelect: true })

    await userEvent.click(
      within(rowOf('Character sheet')).getByText('astronaut_sheet')
    )

    expect(view.emitted().select).toEqual([['sheet']])
  })

  it('does not open the chat from its workflow name when only the title selects', async () => {
    const view = renderList({ workflowNames })

    await userEvent.click(
      within(rowOf('Character sheet')).getByText('astronaut_sheet')
    )

    expect(view.emitted().select).toBeUndefined()
  })

  it('does not open the chat from its copy or options button', async () => {
    const view = renderList({ workflowNames, fullRowSelect: true })
    const row = within(rowOf('Character sheet'))

    await userEvent.click(row.getByRole('button', { name: 'Copy as markdown' }))
    await userEvent.click(row.getByRole('button', { name: 'Chat options' }))

    expect(view.emitted().copyMarkdown).toEqual([['sheet']])
    expect(screen.getByRole('menu')).toBeVisible()
    expect(view.emitted().select).toBeUndefined()
  })

  it('names the select button by the chat title and describes it by the workflow', () => {
    renderList({ workflowNames, fullRowSelect: true })

    const button = within(rowOf('Character sheet')).getByRole('button', {
      name: 'Character sheet'
    })

    expect(button).toHaveAccessibleName('Character sheet')
    expect(button).toHaveAccessibleDescription('astronaut_sheet')
  })

  it('describes a chat that failed to open by its workflow and the failure', () => {
    renderList({ workflowNames, fullRowSelect: true, failedId: 'sheet' })

    expect(
      within(rowOf('Character sheet')).getByRole('button', {
        name: 'Character sheet'
      })
    ).toHaveAccessibleDescription(
      'astronaut_sheet Could not open. Select this chat to retry.'
    )
  })

  it('does not open a chat that is still loading from its workflow name', async () => {
    const view = renderList({
      workflowNames,
      fullRowSelect: true,
      loadingId: 'sheet'
    })

    await userEvent.click(
      within(rowOf('Character sheet')).getByText('astronaut_sheet')
    )

    expect(view.emitted().select).toBeUndefined()
  })
})
