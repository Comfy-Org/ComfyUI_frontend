import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import type { FollowLanding } from '@/workbench/extensions/agent/composables/agent/useAgentWorkflowChatFollow'
import type { ChatSession } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'

import WorkflowChatList from './WorkflowChatList.vue'

function chat(id: string, title: string): ChatSession {
  return { id, title, titleSource: 'server', updatedAt: 1, workflowId: 'wf' }
}

function mount(landing: Partial<FollowLanding> = {}) {
  return render(WorkflowChatList, {
    props: {
      landing: {
        workflowName: 'portrait',
        status: 'ready',
        chats: [chat('th-1', 'Retouch the skin'), chat('th-2', 'Warmer light')],
        hasMore: false,
        openingId: null,
        failedId: null,
        ...landing
      }
    },
    global: { plugins: [i18n] }
  })
}

describe('WorkflowChatList', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  it('names the workflow and lists its chats', () => {
    mount()

    expect(
      screen.getByRole('region', {
        name: i18n.global.t('agent.workflowChats.title', {
          workflowName: 'portrait'
        })
      })
    ).toBeVisible()
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent.trim())
    ).toEqual(['Retouch the skin', 'Warmer light'])
  })

  it('reports the chat the user picks', async () => {
    const { emitted } = mount()

    await userEvent.click(screen.getByRole('button', { name: 'Warmer light' }))

    expect(emitted('select')).toEqual([['th-2']])
  })

  it('marks the chat that is opening as loading, and not clickable', () => {
    mount({ openingId: 'th-1' })

    expect(
      screen.getByRole('button', { name: 'Retouch the skin' })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Warmer light' })).toBeEnabled()
  })

  it('says which chat failed to open', () => {
    mount({ failedId: 'th-2' })

    expect(
      screen.getByText(i18n.global.t('agent.historyOpenFailed'))
    ).toBeVisible()
  })

  it('offers all chats only when the list leaves some out', async () => {
    const { emitted, rerender } = mount()
    expect(
      screen.queryByRole('button', {
        name: i18n.global.t('agent.workflowChats.allChats')
      })
    ).toBeNull()

    await rerender({
      landing: {
        workflowName: 'portrait',
        status: 'ready',
        chats: [chat('th-1', 'Retouch the skin')],
        hasMore: true,
        openingId: null,
        failedId: null
      }
    })
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.workflowChats.allChats')
      })
    )

    expect(emitted('showAll')).toHaveLength(1)
  })

  describe('while the chats load', () => {
    const loadingState = () =>
      screen.getByRole('status', {
        name: i18n.global.t('agent.workflowChats.loading', {
          workflowName: 'portrait'
        })
      })

    it('shows nothing, not even its heading, for a list that arrives within a blink', () => {
      mount({ status: 'loading', chats: [] })

      expect(screen.queryByTestId('workflow-chat-list')).toBeNull()
      expect(screen.queryByRole('region')).toBeNull()
      expect(screen.queryAllByRole('listitem')).toHaveLength(0)
      expect(
        screen.queryAllByTestId('workflow-chat-list-placeholder')
      ).toHaveLength(0)
    })

    it('shows its heading and placeholder rows once it takes a moment', async () => {
      mount({ status: 'loading', chats: [] })

      await vi.advanceTimersByTimeAsync(150)

      expect(
        screen.getByRole('region', {
          name: i18n.global.t('agent.workflowChats.title', {
            workflowName: 'portrait'
          })
        })
      ).toHaveAttribute('aria-busy', 'true')
      expect(
        screen.getAllByTestId('workflow-chat-list-placeholder')
      ).toHaveLength(3)
      expect(loadingState()).toBeVisible()
    })

    it('shows the chats that arrive within a blink without a loading state in between', async () => {
      const { rerender } = mount({ status: 'loading', chats: [] })
      await vi.advanceTimersByTimeAsync(50)

      await rerender({
        landing: {
          workflowName: 'portrait',
          status: 'ready',
          chats: [chat('th-1', 'Retouch the skin')],
          hasMore: false,
          openingId: null,
          failedId: null
        }
      })

      expect(screen.getAllByRole('listitem')).toHaveLength(1)
      expect(screen.queryByRole('status')).toBeNull()
      expect(
        screen.queryAllByTestId('workflow-chat-list-placeholder')
      ).toHaveLength(0)
    })

    it('shows the loading state at once when the user retries after a failure', async () => {
      const failed = {
        workflowName: 'portrait',
        status: 'failed' as const,
        chats: [],
        hasMore: false,
        openingId: null,
        failedId: null
      }
      const { rerender } = mount({ status: 'loading', chats: [] })
      await vi.advanceTimersByTimeAsync(150)
      await rerender({ landing: failed })

      await rerender({ landing: { ...failed, status: 'loading' } })

      expect(loadingState()).toBeVisible()
      expect(
        screen.getAllByTestId('workflow-chat-list-placeholder')
      ).toHaveLength(3)
    })
  })

  describe('when the chats cannot be loaded', () => {
    it('says so and offers a retry that names the workflow', async () => {
      const { emitted } = mount({ status: 'failed', chats: [] })

      expect(screen.getByRole('alert')).toHaveTextContent(
        i18n.global.t('agent.workflowChats.loadFailed', {
          workflowName: 'portrait'
        })
      )
      await userEvent.click(
        screen.getByRole('button', {
          name: i18n.global.t('agent.workflowChats.retry', {
            workflowName: 'portrait'
          })
        })
      )

      expect(emitted('retry')).toHaveLength(1)
    })
  })
})
