import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

import WorkflowTabChatStatus from './WorkflowTabChatStatus.vue'

const path = '/workflows/test.json'

const { agentNeedsApproval, agentWorking, agentFinishedUnseen, agentChat } =
  enMessages.g

const labels = {
  waiting: agentNeedsApproval,
  working: agentWorking,
  unseen: agentFinishedUnseen,
  seen: agentChat
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { agentNeedsApproval, agentWorking, agentFinishedUnseen, agentChat }
    }
  }
})

function renderStatus() {
  return render(WorkflowTabChatStatus, {
    props: { workflowPath: path },
    global: { plugins: [i18n] }
  })
}

describe('WorkflowTabChatStatus', () => {
  it('TS-01 shows nothing for a tab without a chat', () => {
    renderStatus()

    expect(screen.queryByRole('img')).toBeNull()
  })

  it('TS-02 shows a gray dot for a tab that has a chat', () => {
    useWorkflowTabActivityStore().setChatPaths([path])
    renderStatus()

    const status = screen.getByRole('img', { name: labels.seen })
    expect(status).toBeVisible()
    expect(status).toHaveAttribute('data-status', 'seen')
  })

  it('TS-03 shows a spinner while a turn runs', () => {
    useWorkflowTabActivityStore().setAgentTurnTabs([
      { path, awaitingApproval: false }
    ])
    renderStatus()

    const status = screen.getByRole('img', { name: labels.working })
    expect(status).toBeVisible()
    expect(status).toHaveAttribute('data-status', 'in-progress')
  })

  it('TS-04 shows a yellow dot while the chat waits for an answer', () => {
    useWorkflowTabActivityStore().setAgentTurnTabs([
      { path, awaitingApproval: true }
    ])
    renderStatus()

    const status = screen.getByRole('img', { name: labels.waiting })
    expect(status).toBeVisible()
    expect(status).toHaveAttribute('data-status', 'waiting')
  })

  it('TS-05 shows a green dot for a finished turn that was not seen', () => {
    useWorkflowTabActivityStore().markModified(path)
    renderStatus()

    const status = screen.getByRole('img', { name: labels.unseen })
    expect(status).toBeVisible()
    expect(status).toHaveAttribute('data-status', 'unseen')
  })

  it('TS-07 shows one indicator and follows the most urgent state', async () => {
    const activity = useWorkflowTabActivityStore()
    activity.setChatPaths([path])
    activity.markModified(path)
    activity.setAgentTurnTabs([{ path, awaitingApproval: true }])
    renderStatus()
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(screen.getByRole('img', { name: labels.waiting })).toBeVisible()

    activity.setAgentTurnTabs([{ path, awaitingApproval: false }])
    await nextTick()
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(screen.getByRole('img', { name: labels.working })).toBeVisible()

    activity.setAgentTurnTabs([])
    await nextTick()
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(screen.getByRole('img', { name: labels.unseen })).toBeVisible()

    activity.markSeen(path)
    await nextTick()
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(screen.getByRole('img', { name: labels.seen })).toBeVisible()
  })

  it('shows the status of its own tab only', () => {
    useWorkflowTabActivityStore().setChatPaths(['/workflows/other.json'])
    renderStatus()

    expect(screen.queryByRole('img')).toBeNull()
  })
})
