import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'

import NewChatScreen from './NewChatScreen.vue'

describe('NewChatScreen', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  const loading = {
    workflowName: 'portrait',
    status: 'loading' as const
  }

  const failed = {
    workflowName: 'portrait',
    status: 'failed' as const
  }

  function mount(props: Record<string, unknown> = {}) {
    return render(NewChatScreen, {
      props: {
        ...props
      },
      global: { plugins: [i18n] }
    })
  }

  function loadingState() {
    return screen.getByRole('status', {
      name: i18n.global.t('agent.loadingWorkflowChats', {
        workflowName: 'portrait'
      })
    })
  }

  function expectNoGreetingOrStarterPrompts() {
    expect(screen.queryByTestId('suggested-prompts')).toBeNull()
    expect(
      screen.queryByText(i18n.global.t('agent.greetingQuestion'))
    ).toBeNull()
  }

  describe('while it is not known whether the workflow has chats', () => {
    it('shows nothing for the first moment, and marks the screen busy', () => {
      vi.useFakeTimers({ shouldAdvanceTime: false })
      mount({ landing: loading })

      expectNoGreetingOrStarterPrompts()
      expect(screen.queryByRole('status')).toBeNull()
      expect(screen.getByTestId('workflow-chat-landing')).toHaveAttribute(
        'aria-busy',
        'true'
      )
    })

    it('shows a loading state without a list heading once that takes a moment, and still no greeting or starter prompts', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: false })
      mount({ landing: loading })

      await vi.advanceTimersByTimeAsync(120)

      expect(loadingState()).toBeVisible()
      expect(screen.queryByRole('heading', { name: /Chats for/i })).toBeNull()
      expectNoGreetingOrStarterPrompts()
    })

    it('swaps the loading state for the greeting and the starter prompts when the workflow has no chats', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: false })
      const { rerender } = mount({ landing: loading })
      await vi.advanceTimersByTimeAsync(150)
      expect(loadingState()).toBeVisible()

      await rerender({ landing: null })

      expect(screen.getByTestId('suggested-prompts')).toBeVisible()
      expect(
        screen.getByText(i18n.global.t('agent.greetingQuestion'))
      ).toBeVisible()
      expect(screen.queryByRole('status')).toBeNull()
    })

    it('shows the error and a retry, and no greeting or starter prompts, when the chats cannot be loaded', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: false })
      const { rerender } = mount({ landing: loading })
      await vi.advanceTimersByTimeAsync(150)

      await rerender({ landing: failed })

      expect(screen.getByRole('alert')).toHaveTextContent(
        i18n.global.t('agent.followedChatOpenFailed', {
          workflowName: 'portrait'
        })
      )
      expect(
        screen.getByRole('button', {
          name: i18n.global.t('agent.retryFollowedChat', {
            workflowName: 'portrait'
          })
        })
      ).toBeVisible()
      expectNoGreetingOrStarterPrompts()
    })

    it('shows the loading state at once after a retry, with no greeting or starter prompts in between', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: false })
      const { rerender } = mount({ landing: loading })
      await vi.advanceTimersByTimeAsync(150)
      await rerender({ landing: failed })

      await rerender({ landing: loading })

      expect(loadingState()).toBeVisible()
      expectNoGreetingOrStarterPrompts()
    })
  })

  it('shows the greeting and starter prompts when landing is null', () => {
    mount({ landing: null })

    expect(screen.getByTestId('suggested-prompts')).toBeVisible()
    expect(screen.queryByTestId('workflow-chat-landing')).toBeNull()
  })

  it('emits retry when the retry button is clicked', async () => {
    const { emitted } = mount({ landing: failed })

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.retryFollowedChat', {
          workflowName: 'portrait'
        })
      })
    )

    expect(emitted('retry')).toHaveLength(1)
  })

  describe('while the chat of the workflow opens', () => {
    it('shows only a loading state, once that takes a moment', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: false })
      mount({ openingWorkflowName: 'portrait' })

      expectNoGreetingOrStarterPrompts()
      expect(screen.queryByTestId('workflow-chat-landing')).toBeNull()
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
      vi.useFakeTimers({ shouldAdvanceTime: false })
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
