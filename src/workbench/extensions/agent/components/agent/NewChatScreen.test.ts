import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import type { FollowLanding } from '@/workbench/extensions/agent/composables/agent/useAgentWorkflowChatFollow'

import NewChatScreen from './NewChatScreen.vue'

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: false }))

const landing: FollowLanding = {
  workflowName: 'portrait',
  status: 'ready',
  chats: [
    {
      id: 'th-1',
      title: 'Retouch the skin',
      titleSource: 'server',
      updatedAt: 1,
      workflowId: 'wf-portrait'
    }
  ],
  hasMore: false,
  openingId: null,
  failedId: null
}

function mount(props: Record<string, unknown> = {}) {
  return render(NewChatScreen, {
    props: { landing, ...props },
    global: { plugins: [i18n] }
  })
}

describe('NewChatScreen', () => {
  it('lists the chats of the workflow in place of the greeting and the starter prompts', () => {
    mount()

    expect(
      screen.getByRole('button', { name: 'Retouch the skin' })
    ).toBeVisible()
    expect(screen.queryByTestId('suggested-prompts')).toBeNull()
    expect(
      screen.queryByText(i18n.global.t('agent.greetingQuestion'))
    ).toBeNull()
  })

  describe('while it is not known whether the workflow has chats', () => {
    const loading: FollowLanding = { ...landing, status: 'loading', chats: [] }

    const loadingState = () =>
      screen.getByRole('status', {
        name: i18n.global.t('agent.workflowChats.loading', {
          workflowName: 'portrait'
        })
      })

    function expectNoGreetingOrStarterPrompts() {
      expect(screen.queryByTestId('suggested-prompts')).toBeNull()
      expect(
        screen.queryByText(i18n.global.t('agent.greetingQuestion'))
      ).toBeNull()
    }

    it('shows nothing for the first moment, and marks the screen busy', () => {
      vi.useFakeTimers()
      mount({ landing: loading })

      expectNoGreetingOrStarterPrompts()
      expect(screen.queryByTestId('workflow-chat-list')).toBeNull()
      expect(screen.queryByRole('status')).toBeNull()
      expect(screen.getByTestId('agent-empty-state')).toHaveAttribute(
        'aria-busy',
        'true'
      )
    })

    it('shows a loading state once that takes a moment, and still no greeting or starter prompts', async () => {
      vi.useFakeTimers()
      mount({ landing: loading })

      await vi.advanceTimersByTimeAsync(120)

      expect(loadingState()).toBeVisible()
      expectNoGreetingOrStarterPrompts()
    })

    it('shows only the chats when they arrive within a blink', async () => {
      vi.useFakeTimers()
      const { rerender } = mount({ landing: loading })
      await vi.advanceTimersByTimeAsync(50)

      await rerender({ landing })

      expect(
        screen.getByRole('button', { name: 'Retouch the skin' })
      ).toBeVisible()
      expect(screen.queryByRole('status')).toBeNull()
      expectNoGreetingOrStarterPrompts()
      expect(screen.getByTestId('agent-empty-state')).toHaveAttribute(
        'aria-busy',
        'false'
      )
    })

    it('swaps the loading state for the chats, with no greeting or starter prompts in between', async () => {
      vi.useFakeTimers()
      const { rerender } = mount({ landing: loading })
      await vi.advanceTimersByTimeAsync(150)
      expect(loadingState()).toBeVisible()

      await rerender({ landing })

      expect(
        screen.getByRole('button', { name: 'Retouch the skin' })
      ).toBeVisible()
      expect(screen.queryByTestId('workflow-chat-list-placeholder')).toBeNull()
      expectNoGreetingOrStarterPrompts()
    })

    it('swaps the loading state for the greeting and the starter prompts when the workflow has no chats', async () => {
      vi.useFakeTimers()
      const { rerender } = mount({ landing: loading })
      await vi.advanceTimersByTimeAsync(150)
      expect(loadingState()).toBeVisible()

      await rerender({ landing: null })

      expect(screen.getByTestId('suggested-prompts')).toBeVisible()
      expect(
        screen.getByText(i18n.global.t('agent.greetingQuestion'))
      ).toBeVisible()
      expect(screen.queryByTestId('workflow-chat-list')).toBeNull()
      expect(screen.queryByRole('status')).toBeNull()
    })

    it('shows the error and a retry, and no greeting or starter prompts, when the chats cannot be loaded', async () => {
      vi.useFakeTimers()
      const { rerender } = mount({ landing: loading })
      await vi.advanceTimersByTimeAsync(150)

      await rerender({ landing: { ...landing, status: 'failed', chats: [] } })

      expect(screen.getByRole('alert')).toHaveTextContent(
        i18n.global.t('agent.workflowChats.loadFailed', {
          workflowName: 'portrait'
        })
      )
      expectNoGreetingOrStarterPrompts()
    })

    it('shows the loading state at once after a retry, with no greeting or starter prompts in between', async () => {
      vi.useFakeTimers()
      const { rerender } = mount({ landing: loading })
      await vi.advanceTimersByTimeAsync(150)
      await rerender({ landing: { ...landing, status: 'failed', chats: [] } })

      await rerender({ landing: loading })

      expect(loadingState()).toBeVisible()
      expectNoGreetingOrStarterPrompts()
    })
  })

  it('shows no list when there is none to show', () => {
    mount({ landing: null })

    expect(screen.getByTestId('suggested-prompts')).toBeVisible()
    expect(screen.queryByTestId('workflow-chat-list')).toBeNull()
  })

  it('reports the chat the user picks and the retry of a failed list', async () => {
    const { emitted, rerender } = mount()

    await userEvent.click(
      screen.getByRole('button', { name: 'Retouch the skin' })
    )
    await rerender({ landing: { ...landing, status: 'failed', chats: [] } })
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.workflowChats.retry', {
          workflowName: 'portrait'
        })
      })
    )

    expect(emitted('selectChat')).toEqual([['th-1']])
    expect(emitted('retry')).toHaveLength(1)
  })

  it('reports a click on the entry that follows a short list', async () => {
    const { emitted } = mount({ landing: { ...landing, hasMore: true } })

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.workflowChats.allChats')
      })
    )

    expect(emitted('showAll')).toHaveLength(1)
  })

  it('is busy and cannot be used while one of the listed chats opens', async () => {
    const { rerender } = mount({ landing: { ...landing, openingId: 'th-1' } })

    expect(screen.getByTestId('agent-empty-state')).toHaveAttribute(
      'aria-busy',
      'true'
    )
    expect(screen.getByTestId('agent-empty-state')).toHaveAttribute('inert')

    await rerender({ landing: { ...landing, failedId: 'th-1' } })

    expect(screen.getByTestId('agent-empty-state')).toHaveAttribute(
      'aria-busy',
      'false'
    )
    expect(screen.getByTestId('agent-empty-state')).not.toHaveAttribute('inert')
  })

  describe('while the chat of the workflow opens', () => {
    it('shows only a loading state, once that takes a moment', async () => {
      vi.useFakeTimers()
      mount({ openingWorkflowName: 'portrait' })

      expect(screen.queryByTestId('suggested-prompts')).toBeNull()
      expect(screen.queryByTestId('workflow-chat-list')).toBeNull()
      expect(screen.queryByRole('status')).toBeNull()

      await vi.advanceTimersByTimeAsync(120)

      expect(
        screen.getByRole('status', {
          name: i18n.global.t('agent.openingWorkflowChat', {
            workflowName: 'portrait'
          })
        })
      ).toBeVisible()
    })

    it('waits the full moment again for the next opening', async () => {
      vi.useFakeTimers()
      const { rerender } = mount({ openingWorkflowName: 'portrait' })
      await vi.advanceTimersByTimeAsync(100)
      await rerender({ openingWorkflowName: undefined })

      await rerender({ openingWorkflowName: 'portrait' })
      await vi.advanceTimersByTimeAsync(119)

      expect(screen.queryByRole('status')).toBeNull()
      await vi.advanceTimersByTimeAsync(1)
      expect(screen.getByRole('status')).toBeVisible()
    })
  })
})
