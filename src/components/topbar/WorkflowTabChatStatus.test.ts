import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

import WorkflowTabChatStatus from './WorkflowTabChatStatus.vue'

const path = '/workflows/test.json'

const { agentNeedsApproval, agentWorking, agentModified, agentChat } =
  enMessages.g
const labels = {
  waiting: agentNeedsApproval,
  working: agentWorking,
  unseen: agentModified,
  seen: agentChat
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: { g: { agentNeedsApproval, agentWorking, agentModified, agentChat } }
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

    expect(screen.getByRole('img', { name: labels.seen })).toHaveClass(
      'size-2',
      'rounded-full',
      'bg-muted-foreground'
    )
  })

  it('TS-03 shows a spinner while a turn runs', () => {
    useWorkflowTabActivityStore().setAgentTurnTabs([
      { path, awaitingApproval: false }
    ])
    renderStatus()

    expect(screen.getByRole('img', { name: labels.working })).toHaveClass(
      'motion-safe:animate-spin',
      'text-muted-foreground'
    )
  })

  it('TS-04 shows a yellow dot while the chat waits for an answer', () => {
    useWorkflowTabActivityStore().setAgentTurnTabs([
      { path, awaitingApproval: true }
    ])
    renderStatus()

    expect(screen.getByRole('img', { name: labels.waiting })).toHaveClass(
      'size-2',
      'rounded-full',
      'bg-warning'
    )
  })

  it('TS-05 shows a green dot for a finished turn that was not seen', () => {
    useWorkflowTabActivityStore().markModified(path)
    renderStatus()

    expect(screen.getByRole('img', { name: labels.unseen })).toHaveClass(
      'size-2',
      'rounded-full',
      'bg-success'
    )
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
