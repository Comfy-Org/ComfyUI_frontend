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

  it('shows a blank chat for a saved tab that has no chat', async () => {
    const workflow = savedWorkflow('workflows/landscape.json')
    const { deps, follow } = setup(workflow, {
      cloudIdFor: () => 'wf-landscape'
    })

    await follow.followTab(workflow)

    expect(deps.startBlankChat).toHaveBeenCalledOnce()
    expect(deps.loadThread).not.toHaveBeenCalled()
  })

  it('shows a blank chat for a saved tab the cloud listing has no record of', async () => {
    const workflow = savedWorkflow('workflows/unsynced.json')
    const { deps, follow } = setup(workflow, { cloudIdFor: () => undefined })

    await follow.followTab(workflow)

    expect(deps.startBlankChat).toHaveBeenCalledOnce()
  })

  it('keeps the current chat for a tab with no chat when the panel mounts', async () => {
    const workflow = savedWorkflow('workflows/landscape.json')
    const { deps, follow } = setup(workflow, {
      cloudIdFor: () => 'wf-landscape'
    })

    await follow.followTab(workflow, { blankWhenNoChat: false })

    expect(deps.startBlankChat).not.toHaveBeenCalled()
  })

  it('keeps the current chat when the cloud listing fails', async () => {
    const workflow = savedWorkflow('workflows/unsynced.json')
    const { deps, follow } = setup(workflow, {
      cloudIdFor: () => undefined,
      refreshCloudWorkflowIds: async () => false
    })

    await follow.followTab(workflow)

    expect(deps.startBlankChat).not.toHaveBeenCalled()
  })

  it('shows a blank chat for a new, unsaved tab', async () => {
    const workflow = unsavedWorkflow('workflows/Unsaved Workflow.json')
    const { deps, follow } = setup(workflow, { cloudIdFor: () => undefined })

    await follow.followTab(workflow)

    expect(deps.startBlankChat).toHaveBeenCalledOnce()
    expect(deps.loadThread).not.toHaveBeenCalled()
  })

  it('leaves an unsaved tab the agent bound to a chat alone', async () => {
    const workflow = unsavedWorkflow('workflows/second.json')
    const { deps, follow } = setup(workflow, { cloudIdFor: () => 'wf-second' })

    await follow.followTab(workflow)

    expect(deps.startBlankChat).not.toHaveBeenCalled()
    expect(deps.loadThread).not.toHaveBeenCalled()
  })

  it('does not reset a blank chat that already follows the visible tab', async () => {
    const workflow = unsavedWorkflow('workflows/Unsaved Workflow (2).json')
    const { deps, follow } = setup(workflow, {
      cloudIdFor: () => undefined,
      currentThreadId: () => null,
      followsVisibleWorkflow: () => true
    })

    await follow.followTab(workflow)

    expect(deps.startBlankChat).not.toHaveBeenCalled()
  })

  it('keeps the current chat while the user has a draft or a send in flight', async () => {
    const workflow = unsavedWorkflow('workflows/Unsaved Workflow.json')
    const { deps, follow } = setup(workflow, {
      cloudIdFor: () => undefined,
      userEngaged: () => true
    })

    await follow.followTab(workflow)

    expect(deps.startBlankChat).not.toHaveBeenCalled()
  })
})
