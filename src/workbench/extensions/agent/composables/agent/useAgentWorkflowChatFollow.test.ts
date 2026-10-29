import { describe, expect, it, vi } from 'vitest'

import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'
import type { ThreadListing } from '@/workbench/extensions/agent/services/agent/agentRestClient'

import { useAgentWorkflowChatFollow } from './useAgentWorkflowChatFollow'

describe('useAgentWorkflowChatFollow', () => {
  it('does not open a chat for a follow retired while its history refresh settles', async () => {
    const workflow = createMockLoadedWorkflow({
      path: 'workflows/portrait.json',
      isTemporary: false
    })
    let resolveRefresh!: (outcome: ThreadListing['status']) => void
    const loadThread = vi.fn(async () => true)
    const follow = useAgentWorkflowChatFollow({
      activeWorkflow: () => workflow,
      selectedTarget: () => null,
      currentThreadId: () => null,
      sessions: () => [
        {
          id: 'th-portrait',
          title: 'Portrait',
          titleSource: 'server',
          updatedAt: 1,
          workflowId: 'wf-portrait'
        }
      ],
      followsVisibleWorkflow: () => true,
      hasDraft: () => false,
      userEngaged: () => false,
      cloudIdFor: () => 'wf-portrait',
      refreshCloudWorkflowIds: async () => true,
      refreshHistory: () =>
        new Promise((resolve) => {
          resolveRefresh = resolve
        }),
      loadThread,
      clearDraft: vi.fn(),
      trackThreadStarted: vi.fn(),
      restoreThreadWorkflow: () => true,
      adoptWorkflowTarget: vi.fn(),
      adoptRestoredWorkflowTab: vi.fn()
    })

    const following = follow.followTab(workflow)
    await vi.waitFor(() => expect(resolveRefresh).toBeTypeOf('function'))
    resolveRefresh('complete')
    await Promise.resolve()
    follow.retireFollow()
    await following

    expect(loadThread).not.toHaveBeenCalled()
  })
})
