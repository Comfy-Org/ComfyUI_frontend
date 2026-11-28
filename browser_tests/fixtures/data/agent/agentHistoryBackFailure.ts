import {
  agentThreadPage,
  agentThreadSummary
} from '@e2e/fixtures/data/agent/agentThreadList'

const threadId = 'thread-history-back-escape-e2e'
const threadTitle = 'Dreamy pastel landscape'
const seededAt = new Date(0).toISOString()

export const agentHistoryBackFailure = {
  workspaceId: 'personal',
  threadId,
  threadTitle,
  threadList: agentThreadPage([
    agentThreadSummary(threadId, threadTitle, {
      message_count: 2,
      created_at: seededAt,
      updated_at: seededAt,
      last_message_at: seededAt
    })
  ])
}
