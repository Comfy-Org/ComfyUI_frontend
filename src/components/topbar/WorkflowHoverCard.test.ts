import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { i18n } from '@/i18n'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

import WorkflowHoverCard from './WorkflowHoverCard.vue'

const OPEN_DELAY_MS = 200
const CLOSE_DELAY_MS = 150

function renderMenus(workflowNames = ['portrait']) {
  useWorkflowTabActivityStore().setAgentChats(
    new Map(
      workflowNames.map((name) => [
        `workflows/${name}.json`,
        [{ id: `th-${name}`, title: `${name} chat`, updatedAt: Date.now() }]
      ])
    ),
    vi.fn()
  )
  render(
    defineComponent(() => () => [
      h('input', { 'aria-label': 'Search' }),
      ...workflowNames.map((name) =>
        h(WorkflowHoverCard, {
          workflowPath: `workflows/${name}.json`,
          workflowName: name
        })
      )
    ]),
    { global: { plugins: [i18n] } }
  )
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

function chatsButton(workflowName = 'portrait') {
  return screen.getByRole('button', { name: `1 chat on ${workflowName}` })
}

describe('WorkflowHoverCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
  })

  it('opens on a resting hover without taking focus, but not on a pass-over', async () => {
    const user = renderMenus()
    const search = screen.getByRole('textbox', { name: 'Search' })
    await user.click(search)

    await user.hover(chatsButton())
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS - 1)
    await user.unhover(chatsButton())
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)
    expect(screen.queryByRole('menu')).toBeNull()

    await user.hover(chatsButton())
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)

    expect(
      screen.getByRole('menuitem', { name: /^portrait chat/ })
    ).toBeVisible()
    expect(search).toHaveFocus()
  })

  it('stays open while the pointer is in the menu and closes once it leaves', async () => {
    const user = renderMenus()
    await user.hover(chatsButton())
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)

    await user.hover(screen.getByRole('menu'))
    await vi.advanceTimersByTimeAsync(CLOSE_DELAY_MS * 2)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.unhover(screen.getByRole('menu'))
    await vi.advanceTimersByTimeAsync(CLOSE_DELAY_MS - 1)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('keeps a hover-opened menu open when its icon is clicked', async () => {
    const user = renderMenus()
    await user.hover(chatsButton())
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)

    await user.click(chatsButton())
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.click(chatsButton())
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('opens from a long tap and stays open after the finger lifts', async () => {
    const user = renderMenus()

    await user.pointer({ keys: '[TouchA>]', target: chatsButton() })
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS * 2)
    await user.pointer({ keys: '[/TouchA]' })
    await vi.advanceTimersByTimeAsync(CLOSE_DELAY_MS * 2)

    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('opens from the keyboard and returns focus to its icon on Escape, without a tooltip', async () => {
    const user = renderMenus()
    chatsButton().focus()

    await user.keyboard('{Enter}')
    await user.keyboard('{ArrowDown}')
    expect(
      screen.getByRole('menuitem', { name: /^portrait chat/ })
    ).toHaveFocus()

    await user.keyboard('{Escape}')
    await vi.runOnlyPendingTimersAsync()

    expect(screen.queryByRole('menu')).toBeNull()
    expect(chatsButton()).toHaveFocus()
    await vi.runOnlyPendingTimersAsync()
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('marks the panel’s current chat in its place and closes when it is picked', async () => {
    const open = vi.fn()
    useWorkflowTabActivityStore().setAgentChats(
      new Map([
        [
          'workflows/portrait.json',
          [
            {
              id: 'th-newer',
              title: 'Newer chat',
              updatedAt: Date.now(),
              current: false
            },
            {
              id: 'th-current',
              title: 'Open chat',
              updatedAt: Date.now() - 3_600_000,
              current: true
            }
          ]
        ]
      ]),
      open
    )
    render(WorkflowHoverCard, {
      props: {
        workflowPath: 'workflows/portrait.json',
        workflowName: 'portrait'
      },
      global: { plugins: [i18n] }
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    await user.click(
      screen.getByRole('button', { name: '2 chats on portrait' })
    )

    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent)
    ).toEqual([
      'Newer chatnow',
      'Open chatCurrent · 1h ago',
      'New chat on this workflow'
    ])
    const current = screen.getByRole('menuitem', { name: 'Open chat' })
    expect(current).toHaveAccessibleDescription('Current · 1h ago')
    expect(
      screen.getByRole('menuitem', { name: 'Newer chat' })
    ).toHaveAccessibleDescription('now')

    await user.click(current)

    expect(open).toHaveBeenCalledExactlyOnceWith(
      'workflows/portrait.json',
      'th-current'
    )
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('keeps only one menu open at a time', async () => {
    const user = renderMenus(['portrait', 'archive'])
    chatsButton('portrait').focus()
    await user.keyboard('{Enter}')

    await user.hover(chatsButton('archive'))
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)

    expect(
      screen.queryByRole('menuitem', { name: /^portrait chat/ })
    ).toBeNull()
    expect(
      screen.getByRole('menuitem', { name: /^archive chat/ })
    ).toBeVisible()
  })
})
