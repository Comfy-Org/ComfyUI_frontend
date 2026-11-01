import { render, waitFor } from '@testing-library/vue'
import type { WorkflowResponse } from '@comfyorg/ingest-types'
import { getActivePinia } from 'pinia'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { i18n } from '@/i18n'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { blankGraph } from '@/scripts/defaultGraph'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

import type { CloudWorkflowEntry } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { AgentApiError } from '@/workbench/extensions/agent/services/agent/agentRestClient'
import type { CloudWorkflowListing } from '@/workbench/extensions/agent/services/agent/agentRestClient'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useAgentWorkflowTabBindingStore } from '@/workbench/extensions/agent/stores/agent/agentWorkflowTabBindingStore'
import { useAgentWorkflowResolver } from './useAgentWorkflowResolver'
import { useAgentWorkflowSelection } from './useAgentWorkflowSelection'

vi.mock(import('@/platform/workflow/core/services/workflowService'))
vi.mock(import('@comfyorg/telemetry/reportError'))

function setup({ tabsRestored = true }: { tabsRestored?: boolean } = {}) {
  const workflows = useWorkflowStore()
  if (tabsRestored) workflows.markTabsRestored()
  const bindings = useAgentWorkflowTabBindingStore()
  const panel = useAgentPanelStore()
  panel.beginWorkflowRestoration()
  const warnRestoreFailed = vi.fn()
  const listCloudWorkflows = vi.fn(
    async (): Promise<CloudWorkflowListing> =>
      listing([
        { id: 'wf-saved', name: 'saved' },
        { id: 'wf-current', name: 'current' }
      ])
  )
  const cloudRows = new Map([
    ['wf-saved', 1],
    ['wf-current', 1],
    ['wf-draft', 0]
  ])
  const getCloudWorkflow = vi.fn(
    async (workflowId: string): Promise<WorkflowResponse> => {
      const latestVersion = cloudRows.get(workflowId)
      if (latestVersion === undefined)
        throw new AgentApiError('workflow not found', 404, undefined)
      return {
        id: workflowId,
        latest_version: latestVersion,
        created_by: 'user-1',
        created_at: '2026-09-11T10:00:00Z',
        updated_at: '2026-09-11T10:00:00Z'
      }
    }
  )
  const resolver = useAgentWorkflowResolver({
    workflows,
    bindings,
    listCloudWorkflows,
    getCloudWorkflow
  })
  const current = createMockLoadedWorkflow({
    path: 'workflows/current.json',
    filename: 'current',
    isTemporary: false
  })
  workflows.attachWorkflow(current)
  workflows.openWorkflowsInBackground({ right: [current.path] })
  workflows.activeWorkflow = current
  vi.mocked(workflows.syncWorkflows).mockResolvedValue(undefined)
  vi.mocked(useWorkflowService().openWorkflow).mockImplementation(
    async (workflow) => {
      workflows.openWorkflowsInBackground({ right: [workflow.path] })
      workflows.activeWorkflow = await workflow.load()
      return true
    }
  )
  let selection: ReturnType<typeof useAgentWorkflowSelection> | undefined
  render(
    defineComponent({
      setup() {
        selection = useAgentWorkflowSelection({
          resolver,
          canSelectTarget: () => true,
          warnWorkflowUnavailable: vi.fn(),
          warnRestoreFailed
        })
        return () => null
      }
    }),
    { global: { plugins: [i18n] } }
  )
  assert.exists(selection)
  return {
    selection,
    workflows,
    bindings,
    panel,
    current,
    resolver,
    listCloudWorkflows,
    getCloudWorkflow,
    cloudRows,
    warnRestoreFailed
  }
}

function listing(
  entries: CloudWorkflowEntry[],
  complete = true
): CloudWorkflowListing {
  return { entries, complete }
}

describe('historical workflow restoration', () => {
  beforeEach(() => localStorage.clear())

  it.for([false, true])(
    'switches to a known open target without refreshing Cloud metadata (bound: %s)',
    async (bound) => {
      const {
        selection,
        workflows,
        bindings,
        panel,
        resolver,
        listCloudWorkflows,
        warnRestoreFailed
      } = setup()
      const saved = createMockLoadedWorkflow({
        path: 'workflows/saved.json',
        filename: 'saved',
        isTemporary: false
      })
      saved.load = vi.fn(async () => saved)
      workflows.attachWorkflow(saved)
      workflows.openWorkflowsInBackground({ right: [saved.path] })
      if (bound) bindings.bind('wf-saved', saved.path)
      await resolver.refreshCloudWorkflowIds()
      let finishRefresh = () => {}
      const refreshing = new Promise<void>((resolve) => {
        finishRefresh = resolve
      })
      listCloudWorkflows.mockImplementationOnce(async () => {
        await refreshing
        return listing([{ id: 'wf-saved', name: 'saved' }])
      })
      const restoration = selection.restoreTarget('wf-saved', () => true)

      try {
        await waitFor(() => {
          expect(workflows.activeWorkflow?.path).toBe(saved.path)
          expect(panel.selectedWorkflow?.path).toBe(saved.path)
          expect(bindings.tabPathFor('wf-saved')).toBe(saved.path)
        })
        expect(listCloudWorkflows).toHaveBeenCalledTimes(1)
        expect(warnRestoreFailed).not.toHaveBeenCalled()
      } finally {
        finishRefresh()
        await restoration
      }
    }
  )

  it('reports no commit when the panel is not restoring, even with the workflow open, selected and active', async () => {
    const { selection, workflows, bindings, panel } = setup()
    const saved = createMockLoadedWorkflow({
      path: 'workflows/saved.json',
      filename: 'saved',
      isTemporary: false
    })
    saved.load = vi.fn(async () => saved)
    workflows.attachWorkflow(saved)
    workflows.openWorkflowsInBackground({ right: [saved.path] })
    workflows.activeWorkflow = saved
    bindings.bind('wf-saved', saved.path)
    panel.setWorkflowTarget(saved)
    expect(panel.canRestoreWorkflow).toBe(false)
    expect(workflows.activeWorkflow.path).toBe(saved.path)

    expect(await selection.restoreTarget('wf-saved', () => true)).toEqual({
      ready: true,
      committedWorkflowId: null
    })
  })

  it('reopens a known saved workflow without waiting for catalog synchronization', async () => {
    const { selection, workflows, bindings, panel, warnRestoreFailed } = setup()
    const saved = createMockLoadedWorkflow({
      path: 'workflows/saved.json',
      filename: 'saved',
      isTemporary: false
    })
    saved.load = vi.fn(async () => saved)
    workflows.attachWorkflow(saved)
    let finishSync = () => {}
    vi.mocked(workflows.syncWorkflows).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSync = resolve
        })
    )
    const restoration = selection.restoreTarget('wf-saved', () => true)

    try {
      await waitFor(() => {
        expect(workflows.activeWorkflow?.path).toBe(saved.path)
        expect(panel.selectedWorkflow?.path).toBe(saved.path)
        expect(bindings.tabPathFor('wf-saved')).toBe(saved.path)
      })
      expect(warnRestoreFailed).not.toHaveBeenCalled()
    } finally {
      finishSync()
      await restoration
    }
  })

  it('rejects a cold stale binding before switching to the freshly resolved open tab', async () => {
    const {
      selection,
      workflows,
      bindings,
      panel,
      current,
      listCloudWorkflows
    } = setup()
    const saved = createMockLoadedWorkflow({
      path: 'workflows/saved.json',
      filename: 'saved',
      isTemporary: false
    })
    saved.load = vi.fn(async () => saved)
    workflows.attachWorkflow(saved)
    workflows.openWorkflowsInBackground({ right: [saved.path] })
    bindings.bind('wf-saved', current.path)
    let finishRefresh = () => {}
    const refreshing = new Promise<void>((resolve) => {
      finishRefresh = resolve
    })
    listCloudWorkflows.mockImplementationOnce(async () => {
      await refreshing
      return listing([
        { id: 'wf-saved', name: 'saved' },
        { id: 'wf-current', name: 'current' }
      ])
    })
    const restoration = selection.restoreTarget('wf-saved', () => true)
    await Promise.resolve()
    expect(panel.selectedWorkflow).toBeNull()
    expect(workflows.activeWorkflow?.path).toBe(current.path)
    finishRefresh()
    expect(await restoration).toEqual({
      ready: true,
      committedWorkflowId: 'wf-saved'
    })
    expect(panel.selectedWorkflow?.path).toBe(saved.path)
    expect(workflows.activeWorkflow?.path).toBe(saved.path)
    expect(bindings.tabPathFor('wf-saved')).toBe(saved.path)
  })

  it('does not commit or warn for a superseded cached opening', async () => {
    const {
      selection,
      bindings,
      panel,
      current,
      resolver,
      listCloudWorkflows,
      warnRestoreFailed
    } = setup()
    await resolver.refreshCloudWorkflowIds()
    let finishOpening = () => {}
    const opening = new Promise<void>((resolve) => {
      finishOpening = resolve
    })
    vi.mocked(useWorkflowService().openWorkflow).mockImplementationOnce(
      async () => {
        await opening
        return false
      }
    )
    const restoration = selection.restoreTarget('wf-current', () => true)
    selection.cancelSelection()
    panel.setWorkflowTarget(current)
    finishOpening()

    expect((await restoration).ready).toBe(false)
    expect(panel.selectedWorkflow?.path).toBe(current.path)
    expect(bindings.tabPathFor('wf-current')).toBeUndefined()
    expect(listCloudWorkflows).toHaveBeenCalledTimes(1)
    expect(warnRestoreFailed).not.toHaveBeenCalled()
  })

  it('opens and binds a saved workflow discovered by catalog synchronization', async () => {
    const { selection, workflows, bindings, panel, warnRestoreFailed } = setup()
    const saved = createMockLoadedWorkflow({
      path: 'workflows/saved.json',
      filename: 'saved',
      isTemporary: false
    })
    saved.load = vi.fn(async () => saved)
    vi.mocked(workflows.syncWorkflows).mockImplementationOnce(async () => {
      workflows.attachWorkflow(saved)
    })

    await selection.restoreTarget('wf-saved', () => true)

    expect(workflows.activeWorkflow?.path).toBe(saved.path)
    expect(panel.selectedWorkflow?.path).toBe(saved.path)
    expect(bindings.tabPathFor('wf-saved')).toBe(saved.path)
    expect(warnRestoreFailed).not.toHaveBeenCalled()
  })

  it('does not reopen an old target when selection changes during catalog synchronization', async () => {
    const {
      selection,
      workflows,
      bindings,
      panel,
      current,
      warnRestoreFailed
    } = setup()
    const saved = createMockLoadedWorkflow({
      path: 'workflows/saved.json',
      filename: 'saved',
      isTemporary: false
    })
    saved.load = vi.fn(async () => saved)
    let markStarted = () => {}
    let finishSync = () => {}
    const started = new Promise<void>((resolve) => {
      markStarted = resolve
    })
    const pending = new Promise<void>((resolve) => {
      finishSync = resolve
    })
    vi.mocked(workflows.syncWorkflows).mockImplementationOnce(async () => {
      markStarted()
      await pending
      workflows.attachWorkflow(saved)
    })
    const restoration = selection.restoreTarget('wf-saved', () => true)
    await started

    selection.cancelSelection()
    panel.setWorkflowTarget(current)
    finishSync()
    await restoration

    expect(workflows.activeWorkflow?.path).toBe(current.path)
    expect(panel.selectedWorkflow?.path).toBe(current.path)
    expect(workflows.openWorkflows.map(({ path }) => path)).toEqual([
      current.path
    ])
    expect(bindings.tabPathFor('wf-saved')).toBeUndefined()
    expect(warnRestoreFailed).not.toHaveBeenCalled()
  })

  it('keeps the current view and reports a failed restore when a listed workflow has no saved file', async () => {
    const { selection, workflows, panel, current, warnRestoreFailed } = setup()

    expect((await selection.restoreTarget('wf-saved', () => true)).ready).toBe(
      false
    )

    expect(workflows.activeWorkflow?.path).toBe(current.path)
    expect(panel.selectedWorkflow).toBeNull()
    expect(panel.targetUnavailable).toBe(false)
    expect(warnRestoreFailed).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(
      new Error('No saved workflow resolves to the chat target'),
      {
        surface: 'agent',
        errorType: 'agent_workflow_restore_failed',
        context: { workflowId: 'wf-saved' }
      }
    )
  })

  it.for([
    {
      listing: 'omits the workflow',
      list: async () => listing([{ id: 'wf-saved', name: 'saved' }]),
      ready: true,
      unavailable: true,
      warns: 0
    },
    {
      listing: 'fails',
      list: async (): Promise<never> => {
        throw new Error('offline')
      },
      ready: false,
      unavailable: false,
      warns: 1
    }
  ])(
    'restores a chat whose workflow the Cloud listing $listing',
    async ({ list, ready, unavailable, warns }) => {
      const {
        selection,
        workflows,
        panel,
        current,
        listCloudWorkflows,
        warnRestoreFailed
      } = setup()
      listCloudWorkflows.mockImplementationOnce(list)

      expect((await selection.restoreTarget('wf-gone', () => true)).ready).toBe(
        ready
      )

      expect(workflows.activeWorkflow?.path).toBe(current.path)
      expect(panel.selectedWorkflow).toBeNull()
      expect(panel.targetUnavailable).toBe(unavailable)
      expect(warnRestoreFailed).toHaveBeenCalledTimes(warns)
    }
  )

  const openFailure = new Error('Cannot open')
  it.for([
    {
      opening: 'returns false',
      open: async () => false,
      cause: new Error('The chat target workflow did not open')
    },
    {
      opening: 'throws',
      open: async (): Promise<never> => {
        throw openFailure
      },
      cause: openFailure
    }
  ])(
    'reports a failed restore when opening the saved workflow $opening',
    async ({ open, cause }) => {
      const { selection, workflows, panel, current, warnRestoreFailed } =
        setup()
      workflows.attachWorkflow(
        createMockLoadedWorkflow({
          path: 'workflows/saved.json',
          filename: 'saved',
          isTemporary: false
        })
      )
      vi.mocked(useWorkflowService().openWorkflow).mockImplementationOnce(open)

      expect(
        (await selection.restoreTarget('wf-saved', () => true)).ready
      ).toBe(false)

      expect(workflows.activeWorkflow?.path).toBe(current.path)
      expect(panel.targetUnavailable).toBe(false)
      expect(warnRestoreFailed).toHaveBeenCalledOnce()
      expect(reportError).toHaveBeenCalledWith(cause, {
        surface: 'agent',
        errorType: 'agent_workflow_restore_failed',
        context: { workflowId: 'wf-saved' }
      })
    }
  )

  it.for([
    {
      listing: 'omits it',
      entries: [],
      unavailable: true,
      active: 'workflows/current.json',
      lifecycleReads: 1
    },
    {
      listing: 'lists it without a name',
      entries: [{ id: 'wf-stale' }],
      unavailable: false,
      active: 'workflows/bound.json',
      lifecycleReads: 0
    }
  ])(
    'lets a successful listing decide a stale binding when the listing $listing',
    async ({ entries, unavailable, active, lifecycleReads }) => {
      const {
        selection,
        workflows,
        bindings,
        panel,
        listCloudWorkflows,
        getCloudWorkflow
      } = setup()
      const bound = createMockLoadedWorkflow({
        path: 'workflows/bound.json',
        filename: 'bound',
        isTemporary: false
      })
      bound.load = vi.fn(async () => bound)
      workflows.attachWorkflow(bound)
      workflows.openWorkflowsInBackground({ right: [bound.path] })
      bindings.bind('wf-stale', bound.path)
      listCloudWorkflows.mockImplementationOnce(async () => listing(entries))

      expect(
        (await selection.restoreTarget('wf-stale', () => true)).ready
      ).toBe(true)

      expect(panel.targetUnavailable).toBe(unavailable)
      expect(workflows.activeWorkflow?.path).toBe(active)
      expect(getCloudWorkflow).toHaveBeenCalledTimes(lifecycleReads)
    }
  )

  function openDraftTab(
    workflows: ReturnType<typeof setup>['workflows'],
    bindings: ReturnType<typeof setup>['bindings'],
    workflowId = 'wf-draft'
  ) {
    const draft = createMockLoadedWorkflow({
      path: 'workflows/Unsaved Workflow.json',
      filename: 'Unsaved Workflow',
      isTemporary: true
    })
    draft.load = vi.fn(async () => draft)
    workflows.attachWorkflow(draft)
    workflows.openWorkflowsInBackground({ right: [draft.path] })
    bindings.bind(workflowId, draft.path)
    return draft
  }

  it('focuses the unsaved draft tab this chat owns when the listing cannot carry it', async () => {
    const { selection, workflows, bindings, panel, warnRestoreFailed } = setup()
    const draft = openDraftTab(workflows, bindings)

    expect((await selection.restoreTarget('wf-draft', () => true)).ready).toBe(
      true
    )

    expect(panel.targetUnavailable).toBe(false)
    expect(workflows.activeWorkflow?.path).toBe(draft.path)
    expect(panel.selectedWorkflow?.path).toBe(draft.path)
    expect(warnRestoreFailed).not.toHaveBeenCalled()
  })

  it('calls a promoted-then-deleted draft unavailable even though its tab is still open', async () => {
    const { selection, workflows, bindings, panel, cloudRows, current } =
      setup()
    const draft = openDraftTab(workflows, bindings)
    cloudRows.delete('wf-draft')

    expect((await selection.restoreTarget('wf-draft', () => true)).ready).toBe(
      true
    )

    expect(panel.targetUnavailable).toBe(true)
    expect(panel.selectedWorkflow).toBeNull()
    expect(workflows.activeWorkflow?.path).toBe(current.path)
    expect(workflows.openWorkflows.map(({ path }) => path)).toContain(
      draft.path
    )
  })

  it('does not call a workflow deleted when its own row cannot be read', async () => {
    const {
      selection,
      workflows,
      bindings,
      panel,
      getCloudWorkflow,
      warnRestoreFailed
    } = setup()
    const draft = openDraftTab(workflows, bindings)
    getCloudWorkflow.mockRejectedValueOnce(
      new AgentApiError('upstream failed', 500, undefined)
    )

    expect((await selection.restoreTarget('wf-draft', () => true)).ready).toBe(
      true
    )

    expect(panel.targetUnavailable).toBe(false)
    expect(panel.selectedWorkflow?.path).toBe(draft.path)
    expect(warnRestoreFailed).not.toHaveBeenCalled()
  })

  it('does not call a workflow deleted when a save promotes its tab mid-listing', async () => {
    const {
      selection,
      workflows,
      bindings,
      panel,
      cloudRows,
      listCloudWorkflows,
      warnRestoreFailed
    } = setup()
    const draft = openDraftTab(workflows, bindings, 'wf-promoted')
    cloudRows.set('wf-promoted', 0)
    let promoted = false
    vi.spyOn(draft, 'isTemporary', 'get').mockImplementation(() => !promoted)
    let finishListing = () => {}
    const pendingListing = new Promise<void>((resolve) => {
      finishListing = resolve
    })
    listCloudWorkflows.mockImplementationOnce(async () => {
      await pendingListing
      return listing([{ id: 'wf-saved', name: 'saved' }])
    })
    const restoration = selection.restoreTarget('wf-promoted', () => true)

    promoted = true
    cloudRows.set('wf-promoted', 1)
    finishListing()

    expect((await restoration).ready).toBe(true)
    expect(panel.targetUnavailable).toBe(false)
    expect(panel.selectedWorkflow?.path).toBe(draft.path)
    expect(workflows.activeWorkflow?.path).toBe(draft.path)
    expect(warnRestoreFailed).not.toHaveBeenCalled()
  })

  it('does not decide anything from a listing that gave up mid-walk', async () => {
    const {
      selection,
      workflows,
      panel,
      current,
      listCloudWorkflows,
      warnRestoreFailed
    } = setup()
    listCloudWorkflows.mockImplementationOnce(async () =>
      listing([{ id: 'wf-saved', name: 'saved' }], false)
    )

    expect(
      (await selection.restoreTarget('wf-past-the-cut', () => true)).ready
    ).toBe(false)

    expect(panel.targetUnavailable).toBe(false)
    expect(warnRestoreFailed).toHaveBeenCalledOnce()
    expect(workflows.activeWorkflow?.path).toBe(current.path)
  })

  it('does not mark a superseded restoration unavailable while its row is being read', async () => {
    const { selection, workflows, bindings, panel, current, getCloudWorkflow } =
      setup()
    openDraftTab(workflows, bindings)
    let readStarted = () => {}
    const started = new Promise<void>((resolve) => {
      readStarted = resolve
    })
    let finishRead = () => {}
    const reading = new Promise<void>((resolve) => {
      finishRead = resolve
    })
    getCloudWorkflow.mockImplementationOnce(async () => {
      readStarted()
      await reading
      throw new AgentApiError('workflow not found', 404, undefined)
    })
    const restoration = selection.restoreTarget('wf-draft', () => true)
    await started

    selection.cancelSelection()
    panel.setWorkflowTarget(current)
    finishRead()

    expect((await restoration).ready).toBe(false)
    expect(panel.targetUnavailable).toBe(false)
    expect(panel.selectedWorkflow?.path).toBe(current.path)
    expect(getCloudWorkflow).toHaveBeenCalledOnce()
  })

  it('does not reopen a draft closed while its row is being read', async () => {
    const { selection, workflows, bindings, panel, getCloudWorkflow } = setup()
    const draft = openDraftTab(workflows, bindings)
    let readStarted = () => {}
    const started = new Promise<void>((resolve) => {
      readStarted = resolve
    })
    let finishRead = () => {}
    const reading = new Promise<void>((resolve) => {
      finishRead = resolve
    })
    getCloudWorkflow.mockImplementationOnce(async (workflowId) => {
      readStarted()
      await reading
      return {
        id: workflowId,
        latest_version: 0,
        created_by: 'user-1',
        created_at: '2026-09-11T10:00:00Z',
        updated_at: '2026-09-11T10:00:00Z'
      }
    })
    const restoration = selection.restoreTarget('wf-draft', () => true)
    await started

    await workflows.closeWorkflow(draft)
    finishRead()

    expect((await restoration).ready).toBe(false)
    expect(panel.selectedWorkflow).toBeNull()
    expect(workflows.openWorkflows).not.toContain(draft)
  })

  it('leaves a deleted target unavailable, and reports ready with no commit, when nothing local answers for it', async () => {
    const { selection, workflows, panel, current, warnRestoreFailed } = setup()

    expect(await selection.restoreTarget('wf-deleted', () => true)).toEqual({
      ready: true,
      committedWorkflowId: null
    })

    expect(panel.targetUnavailable).toBe(true)
    expect(panel.selectedWorkflow).toBeNull()
    expect(workflows.activeWorkflow?.path).toBe(current.path)
    expect(workflows.syncWorkflows).not.toHaveBeenCalled()
    expect(warnRestoreFailed).not.toHaveBeenCalled()
  })

  const draftPath = 'workflows/Agent draft.json'
  const draftGraphId = '3d4d7f1e-3c8b-4a0a-9a3c-1d2e3f4a5b6c'

  async function bindDraftThenReload(): Promise<void> {
    const beforeReload = useWorkflowStore()
    const draft = beforeReload.createTemporary('Agent draft.json', {
      ...blankGraph,
      id: draftGraphId
    })
    beforeReload.openWorkflowsInBackground({ right: [draft.path] })
    const bindingsBeforeReload = useAgentWorkflowTabBindingStore()
    bindingsBeforeReload.bind('wf-draft', draft.path)
    await nextTick()
    bindingsBeforeReload.$dispose()
    delete getActivePinia()?.state.value[bindingsBeforeReload.$id]
    await beforeReload.closeWorkflow(draft)
  }

  function restoreDraftTab(workflows: ReturnType<typeof useWorkflowStore>) {
    const restored = workflows.createTemporary('Agent draft.json', {
      ...blankGraph,
      id: draftGraphId
    })
    workflows.openWorkflowsInBackground({ right: [restored.path] })
    workflows.markTabsRestored()
    return restored
  }

  it('PM-2332 waits for a page reload to restore the unsaved draft tab before calling the chat target unavailable', async () => {
    await bindDraftThenReload()
    const {
      selection,
      workflows,
      panel,
      listCloudWorkflows,
      getCloudWorkflow,
      warnRestoreFailed
    } = setup({ tabsRestored: false })

    const restoration = selection.restoreTarget('wf-draft', () => true)
    await vi.waitFor(() => expect(listCloudWorkflows).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(panel.targetUnavailable).toBe(false)

    const restored = restoreDraftTab(workflows)

    expect((await restoration).ready).toBe(true)
    expect(restored.path).toBe(draftPath)
    expect(getCloudWorkflow).toHaveBeenCalledWith('wf-draft')
    expect(panel.targetUnavailable).toBe(false)
    expect(panel.selectedWorkflow?.path).toBe(draftPath)
    expect(workflows.activeWorkflow?.path).toBe(draftPath)
    expect(warnRestoreFailed).not.toHaveBeenCalled()
  })

  it('waits for the reloaded draft tab even when the listing is incomplete', async () => {
    await bindDraftThenReload()
    const {
      selection,
      workflows,
      panel,
      listCloudWorkflows,
      warnRestoreFailed
    } = setup({ tabsRestored: false })
    listCloudWorkflows.mockImplementationOnce(async () =>
      listing([{ id: 'wf-saved', name: 'saved' }], false)
    )

    const restoration = selection.restoreTarget('wf-draft', () => true)
    await vi.waitFor(() => expect(listCloudWorkflows).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(workflows.syncWorkflows).not.toHaveBeenCalled()
    expect(warnRestoreFailed).not.toHaveBeenCalled()

    restoreDraftTab(workflows)

    expect(await restoration).toEqual({
      ready: true,
      committedWorkflowId: 'wf-draft'
    })
    expect(panel.selectedWorkflow?.path).toBe(draftPath)
    expect(panel.targetUnavailable).toBe(false)
    expect(warnRestoreFailed).not.toHaveBeenCalled()
  })

  it('calls the target unavailable when startup never finishes restoring tabs', async () => {
    vi.useFakeTimers()
    try {
      const { selection, panel, listCloudWorkflows, getCloudWorkflow } = setup({
        tabsRestored: false
      })
      let settled = false
      const restoration = selection
        .restoreTarget('wf-deleted', () => true)
        .finally(() => {
          settled = true
        })
      await vi.waitFor(() => expect(listCloudWorkflows).toHaveBeenCalled())

      await vi.advanceTimersByTimeAsync(14_000)
      expect(settled).toBe(false)
      expect(panel.targetUnavailable).toBe(false)

      await vi.advanceTimersByTimeAsync(1_000)
      expect(settled).toBe(true)
      expect(await restoration).toEqual({
        ready: true,
        committedWorkflowId: null
      })
      expect(panel.targetUnavailable).toBe(true)
      expect(getCloudWorkflow).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('still calls the target unavailable once a reload restores no tab for it', async () => {
    const {
      selection,
      panel,
      getCloudWorkflow,
      listCloudWorkflows,
      workflows
    } = setup({ tabsRestored: false })

    const restoration = selection.restoreTarget('wf-deleted', () => true)
    await vi.waitFor(() => expect(listCloudWorkflows).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(panel.targetUnavailable).toBe(false)

    workflows.markTabsRestored()

    expect(await restoration).toEqual({
      ready: true,
      committedWorkflowId: null
    })
    expect(panel.targetUnavailable).toBe(true)
    expect(getCloudWorkflow).not.toHaveBeenCalled()
  })

  it('does not mark a superseded restoration unavailable when its listing omits the workflow', async () => {
    const { selection, panel, current, listCloudWorkflows, warnRestoreFailed } =
      setup()
    let finishListing = () => {}
    const pendingListing = new Promise<void>((resolve) => {
      finishListing = resolve
    })
    listCloudWorkflows.mockImplementationOnce(async () => {
      await pendingListing
      return listing([])
    })
    const restoration = selection.restoreTarget('wf-gone', () => true)

    selection.cancelSelection()
    panel.setWorkflowTarget(current)
    finishListing()

    expect((await restoration).ready).toBe(false)
    expect(panel.targetUnavailable).toBe(false)
    expect(panel.selectedWorkflow?.path).toBe(current.path)
    expect(warnRestoreFailed).not.toHaveBeenCalled()
  })
})

describe('picking a target tab', () => {
  beforeEach(() => localStorage.clear())

  it('loads an unsaved tab a reload left unopened before saving it', async () => {
    const { selection, workflows, panel, listCloudWorkflows } = setup()
    const graph = { ...blankGraph, id: 'b6c1d1e6-7f00-4a7e-9a52-0d1a2b3c4d5e' }
    const restored = workflows.createTemporary(
      'Unsaved Workflow (2).json',
      graph
    )
    workflows.openWorkflowsInBackground({ right: [restored.path] })
    expect(restored.isLoaded).toBe(false)
    let saved = false
    vi.spyOn(restored, 'isTemporary', 'get').mockImplementation(() => !saved)
    vi.mocked(useWorkflowService().saveWorkflowAs).mockImplementationOnce(
      async (tab) => {
        // workflowStore.saveWorkflow refuses a tab that has no loaded state.
        if (!tab.isLoaded)
          throw new Error(
            `Cannot save workflow '${tab.path}' before it is loaded`
          )
        saved = true
        return true
      }
    )
    listCloudWorkflows.mockImplementation(async () =>
      listing([
        { id: 'wf-current', name: 'current' },
        ...(saved ? [{ id: 'wf-restored', name: 'Unsaved Workflow (2)' }] : [])
      ])
    )
    const toast = useToast()

    expect(await selection.selectTarget(restored.path)).toBe(true)

    expect(useWorkflowService().saveWorkflowAs).toHaveBeenCalledWith(restored, {
      filename: 'Unsaved Workflow (2)'
    })
    expect(panel.selectedWorkflow?.path).toBe(restored.path)
    expect(workflows.activeWorkflow?.path).toBe(restored.path)
    expect(toast.toasts).toHaveLength(0)
  })

  it('does not save a second copy when opening the tab finds it already saved', async () => {
    const { selection, workflows, panel, listCloudWorkflows } = setup()
    const restored = workflows.createTemporary('Restored.json', {
      ...blankGraph,
      id: '0f7a3c52-0d55-4e43-9d1e-6a8d5c2b7e11'
    })
    workflows.openWorkflowsInBackground({ right: [restored.path] })
    let saved = false
    vi.spyOn(restored, 'isTemporary', 'get').mockImplementation(() => !saved)
    vi.mocked(useWorkflowService().openWorkflow).mockImplementationOnce(
      async (workflow) => {
        workflows.activeWorkflow = await workflow.load()
        saved = true
        return true
      }
    )
    listCloudWorkflows.mockImplementation(async () =>
      listing([
        { id: 'wf-current', name: 'current' },
        ...(saved ? [{ id: 'wf-restored', name: 'Restored' }] : [])
      ])
    )

    expect(await selection.selectTarget(restored.path)).toBe(true)

    expect(useWorkflowService().saveWorkflowAs).not.toHaveBeenCalled()
    expect(panel.selectedWorkflow?.path).toBe(restored.path)
  })
})
