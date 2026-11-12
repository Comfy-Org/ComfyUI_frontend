import { describe, expect, it, vi } from 'vitest'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'
import type { ThreadListing } from '@/workbench/extensions/agent/services/agent/agentRestClient'
import type { ChatSession } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'

import { useAgentWorkflowChatFollow } from './useAgentWorkflowChatFollow'

type Deps = Parameters<typeof useAgentWorkflowChatFollow>[0]

const portraitChat: ChatSession = {
  id: 'th-portrait',
  title: 'Portrait',
  titleSource: 'server',
  updatedAt: 1,
  workflowId: 'wf-portrait'
}

function savedWorkflow(path: string): ComfyWorkflow {
  return createMockLoadedWorkflow({ path, isTemporary: false })
}

function unsavedWorkflow(path: string): ComfyWorkflow {
  return createMockLoadedWorkflow({ path, isTemporary: true })
}

function setup(workflow: ComfyWorkflow, overrides: Partial<Deps> = {}) {
  const deps: Deps = {
    activeWorkflow: () => workflow,
    selectedTarget: () => null,
    currentThreadId: () => 'th-other',
    sessions: () => [portraitChat],
    followsVisibleWorkflow: () => false,
    hasDraft: () => false,
    userEngaged: () => false,
    cloudIdFor: () => 'wf-portrait',
    refreshCloudWorkflowIds: async () => true,
    refreshHistory: async () => 'complete',
    loadThread: vi.fn(async () => true),
    clearDraft: vi.fn(),
    trackThreadStarted: vi.fn(),
    restoreThreadWorkflow: () => true,
    adoptWorkflowTarget: vi.fn(),
    adoptRestoredWorkflowTab: vi.fn(),
    startBlankChat: vi.fn(),
    ...overrides
  }
  return { deps, follow: useAgentWorkflowChatFollow(deps) }
}

describe('useAgentWorkflowChatFollow', () => {
  it('does not open a chat for a follow retired while its history refresh settles', async () => {
    const workflow = savedWorkflow('workflows/portrait.json')
    let resolveRefresh!: (outcome: ThreadListing['status']) => void
    const { deps, follow } = setup(workflow, {
      currentThreadId: () => null,
      followsVisibleWorkflow: () => true,
      refreshHistory: () =>
        new Promise((resolve) => {
          resolveRefresh = resolve
        })
    })

    const following = follow.followTab(workflow)
    await vi.waitFor(() => expect(resolveRefresh).toBeTypeOf('function'))
    resolveRefresh('complete')
    await Promise.resolve()
    follow.retireFollow()
    await following

    expect(deps.loadThread).not.toHaveBeenCalled()
  })

  it("opens the tab's latest chat", async () => {
    const workflow = savedWorkflow('workflows/portrait.json')
    const { deps, follow } = setup(workflow)

    await follow.followTab(workflow)

    expect(deps.loadThread).toHaveBeenCalledWith(
      'th-portrait',
      expect.any(Function),
      { keepOpenChatUntilLoaded: true }
    )
    expect(deps.startBlankChat).not.toHaveBeenCalled()
  })

  it.for<{
    name: string
    workflow: () => ComfyWorkflow
    overrides: Partial<Deps>
    blankWhenNoChat?: boolean
    blankChats: number
  }>([
    {
      name: 'shows a blank chat for a saved tab that has no chat',
      workflow: () => savedWorkflow('workflows/landscape.json'),
      overrides: { cloudIdFor: () => 'wf-landscape' },
      blankChats: 1
    },
    {
      name: 'shows a blank chat for a saved tab the cloud listing has no record of',
      workflow: () => savedWorkflow('workflows/unsynced.json'),
      overrides: { cloudIdFor: () => undefined },
      blankChats: 1
    },
    {
      name: 'shows a blank chat for a new, unsaved tab',
      workflow: () => unsavedWorkflow('workflows/Unsaved Workflow.json'),
      overrides: { cloudIdFor: () => undefined },
      blankChats: 1
    },
    {
      name: 'keeps the current chat for a tab with no chat when the panel mounts',
      workflow: () => savedWorkflow('workflows/landscape.json'),
      overrides: { cloudIdFor: () => 'wf-landscape' },
      blankWhenNoChat: false,
      blankChats: 0
    },
    {
      name: 'keeps the current chat when the cloud listing fails',
      workflow: () => savedWorkflow('workflows/unsynced.json'),
      overrides: {
        cloudIdFor: () => undefined,
        refreshCloudWorkflowIds: async () => false
      },
      blankChats: 0
    },
    {
      name: 'leaves an unsaved tab the agent bound to a chat alone',
      workflow: () => unsavedWorkflow('workflows/second.json'),
      overrides: { cloudIdFor: () => 'wf-second' },
      blankChats: 0
    },
    {
      name: 'does not reset a blank chat that already follows the visible tab',
      workflow: () => unsavedWorkflow('workflows/Unsaved Workflow (2).json'),
      overrides: {
        cloudIdFor: () => undefined,
        currentThreadId: () => null,
        followsVisibleWorkflow: () => true
      },
      blankChats: 0
    },
    {
      name: 'keeps the current chat while the user has a draft or a send in flight',
      workflow: () => unsavedWorkflow('workflows/Unsaved Workflow.json'),
      overrides: { cloudIdFor: () => undefined, userEngaged: () => true },
      blankChats: 0
    }
  ])('$name', async ({ overrides, blankWhenNoChat, blankChats, ...row }) => {
    const workflow = row.workflow()
    const { deps, follow } = setup(workflow, overrides)

    await follow.followTab(workflow, { blankWhenNoChat })

    expect(deps.startBlankChat).toHaveBeenCalledTimes(blankChats)
    expect(deps.loadThread).not.toHaveBeenCalled()
  })
})
