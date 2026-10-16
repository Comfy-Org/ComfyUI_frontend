import { render, waitFor } from '@testing-library/vue'
import type { WorkflowResponse } from '@comfyorg/ingest-types'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { i18n } from '@/i18n'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

import type { CloudWorkflowEntry } from '../../schemas/agentApiSchema'
import { AgentApiError } from '../../services/agent/agentRestClient'
import type { CloudWorkflowListing } from '../../services/agent/agentRestClient'
import { useAgentPanelStore } from '../../stores/agent/agentPanelStore'
import { useAgentWorkflowTabBindingStore } from '../../stores/agent/agentWorkflowTabBindingStore'
import { useAgentWorkflowResolver } from './useAgentWorkflowResolver'
import { useAgentWorkflowSelection } from './useAgentWorkflowSelection'

vi.mock(import('@/platform/workflow/core/services/workflowService'))

function setup() {
  const workflows = useWorkflowStore()
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
    expect(await restoration).toBe(true)
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

    expect(await restoration).toBe(false)
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

    expect(await restoration).toBe(false)
    expect(workflows.activeWorkflow?.path).toBe(current.path)
    expect(panel.selectedWorkflow?.path).toBe(current.path)
    expect(workflows.openWorkflows.map(({ path }) => path)).toEqual([
      current.path
    ])
    expect(bindings.tabPathFor('wf-saved')).toBeUndefined()
    expect(warnRestoreFailed).not.toHaveBeenCalled()
  })

  it('allows reading with an unresolved target without guessing another graph', async () => {
    const {
      selection,
      workflows,
      panel,
      current,
      bindings,
      warnRestoreFailed
    } = setup()

    expect(await selection.restoreTarget('wf-saved', () => true)).toBe(true)
    expect(workflows.activeWorkflow?.path).toBe(current.path)
    expect(panel.targetUnresolved).toBe(true)
    expect(bindings.tabPathFor('wf-saved')).toBeUndefined()
    expect(warnRestoreFailed).not.toHaveBeenCalled()
  })

  it('reads a chat with no local target when direct lookup confirms a live versionless draft', async () => {
    const {
      selection,
      workflows,
      panel,
      current,
      listCloudWorkflows,
      warnRestoreFailed
    } = setup()
    listCloudWorkflows.mockResolvedValueOnce(listing([]))

    expect(await selection.restoreTarget('wf-draft', () => true)).toBe(true)
    expect(panel.targetUnresolved).toBe(true)
    expect(workflows.activeWorkflow?.path).toBe(current.path)
    expect(warnRestoreFailed).not.toHaveBeenCalled()
  })

  it('reads a chat with no local target when its direct lookup is refused', async () => {
    const {
      selection,
      workflows,
      panel,
      current,
      listCloudWorkflows,
      getCloudWorkflow,
      warnRestoreFailed
    } = setup()
    listCloudWorkflows.mockResolvedValueOnce(listing([]))
    getCloudWorkflow.mockRejectedValueOnce(
      new AgentApiError('Workflow lookup failed', 403, undefined)
    )

    expect(await selection.restoreTarget('wf-saved', () => true)).toBe(true)
    expect(panel.targetUnresolved).toBe(true)
    expect(workflows.activeWorkflow?.path).toBe(current.path)
    expect(warnRestoreFailed).not.toHaveBeenCalled()
  })

  it('asks the lookup instead of an earlier listing when the latest refresh fails', async () => {
    const {
      selection,
      panel,
      resolver,
      cloudRows,
      listCloudWorkflows,
      warnRestoreFailed
    } = setup()
    expect(await resolver.refreshCloudWorkflowIds()).toBe(true)
    listCloudWorkflows.mockRejectedValueOnce(new Error('listing failed'))
    cloudRows.delete('wf-saved')

    expect(await selection.restoreTarget('wf-saved', () => true)).toBe(true)
    expect(panel.targetUnavailable).toBe(true)
    expect(warnRestoreFailed).not.toHaveBeenCalled()
  })

  it.for([
    {
      opening: 'returns false',
      open: async () => false
    },
    {
      opening: 'throws',
      open: async (): Promise<never> => {
        throw new Error('Cannot open')
      }
    }
  ])(
    'reports a failed restore when opening the saved workflow $opening',
    async ({ open }) => {
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

      expect(await selection.restoreTarget('wf-saved', () => true)).toBe(false)

      expect(workflows.activeWorkflow?.path).toBe(current.path)
      expect(panel.targetUnavailable).toBe(false)
      expect(warnRestoreFailed).toHaveBeenCalledOnce()
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

      expect(await selection.restoreTarget('wf-stale', () => true)).toBe(true)

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

    expect(await selection.restoreTarget('wf-draft', () => true)).toBe(true)

    expect(panel.targetUnavailable).toBe(false)
    expect(workflows.activeWorkflow?.path).toBe(draft.path)
    expect(panel.selectedWorkflow?.path).toBe(draft.path)
    expect(warnRestoreFailed).not.toHaveBeenCalled()
  })

  it('focuses the draft tab this chat owns without a lookup when the listing fails', async () => {
    const {
      selection,
      workflows,
      bindings,
      panel,
      cloudRows,
      listCloudWorkflows,
      warnRestoreFailed
    } = setup()
    const draft = openDraftTab(workflows, bindings)
    cloudRows.delete('wf-draft')
    listCloudWorkflows.mockRejectedValueOnce(new Error('offline'))

    expect(await selection.restoreTarget('wf-draft', () => true)).toBe(true)

    expect(workflows.activeWorkflow?.path).toBe(draft.path)
    expect(panel.selectedWorkflow?.path).toBe(draft.path)
    expect(warnRestoreFailed).not.toHaveBeenCalled()
  })

  it('calls a promoted-then-deleted draft unavailable even though its tab is still open', async () => {
    const { selection, workflows, bindings, panel, cloudRows, current } =
      setup()
    const draft = openDraftTab(workflows, bindings)
    cloudRows.delete('wf-draft')

    expect(await selection.restoreTarget('wf-draft', () => true)).toBe(true)

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

    expect(await selection.restoreTarget('wf-draft', () => true)).toBe(true)

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

    expect(await restoration).toBe(true)
    expect(panel.targetUnavailable).toBe(false)
    expect(panel.selectedWorkflow?.path).toBe(draft.path)
    expect(workflows.activeWorkflow?.path).toBe(draft.path)
    expect(warnRestoreFailed).not.toHaveBeenCalled()
  })

  it.for([
    {
      outcome: 'marks a chat with no local target unavailable by its lookup',
      listing: 'stops before reaching it',
      entries: [{ id: 'wf-saved', name: 'saved' }],
      unavailable: true
    },
    {
      outcome: 'keeps a chat with no local target readable without a lookup',
      listing: 'names it before stopping',
      entries: [{ id: 'wf-past-the-cut', name: 'past the cut' }],
      unavailable: false
    }
  ])(
    '$outcome when an incomplete listing $listing',
    async ({ entries, unavailable }) => {
      const {
        selection,
        workflows,
        panel,
        current,
        listCloudWorkflows,
        warnRestoreFailed
      } = setup()
      listCloudWorkflows.mockImplementationOnce(async () =>
        listing(entries, false)
      )

      expect(await selection.restoreTarget('wf-past-the-cut', () => true)).toBe(
        true
      )

      expect(panel.targetUnavailable).toBe(unavailable)
      expect(warnRestoreFailed).not.toHaveBeenCalled()
      expect(workflows.activeWorkflow?.path).toBe(current.path)
    }
  )

  it('marks a chat unavailable by its lookup when a reference request supersedes its listing', async () => {
    const {
      selection,
      panel,
      cloudRows,
      listCloudWorkflows,
      warnRestoreFailed
    } = setup()
    cloudRows.delete('wf-saved')
    let finishListing = () => {}
    const pendingListing = new Promise<void>((resolve) => {
      finishListing = resolve
    })
    listCloudWorkflows.mockImplementationOnce(async () => {
      await pendingListing
      return listing([{ id: 'wf-saved', name: 'saved' }])
    })
    const restoration = selection.restoreTarget('wf-saved', () => true)
    listCloudWorkflows.mockReturnValueOnce(new Promise(() => {}))

    selection.requestReferences()
    finishListing()

    expect(await restoration).toBe(true)
    expect(panel.targetUnavailable).toBe(true)
    expect(warnRestoreFailed).not.toHaveBeenCalled()
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

    expect(await restoration).toBe(false)
    expect(panel.targetUnavailable).toBe(false)
    expect(panel.selectedWorkflow?.path).toBe(current.path)
    expect(getCloudWorkflow).toHaveBeenCalledOnce()
  })

  it('does not reopen a draft closed while its row is being read', async () => {
    const { selection, workflows, bindings, panel, current, getCloudWorkflow } =
      setup()
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

    expect(await restoration).toBe(true)
    expect(panel.selectedWorkflow).toBeNull()
    expect(panel.targetUnavailable).toBe(false)
    expect(workflows.activeWorkflow?.path).toBe(current.path)
    expect(bindings.tabPathFor('wf-draft')).toBeUndefined()
  })

  it('leaves a deleted target unavailable when nothing local answers for it', async () => {
    const { selection, workflows, panel, current, warnRestoreFailed } = setup()

    expect(await selection.restoreTarget('wf-deleted', () => true)).toBe(true)

    expect(panel.targetUnavailable).toBe(true)
    expect(panel.selectedWorkflow).toBeNull()
    expect(workflows.activeWorkflow?.path).toBe(current.path)
    expect(workflows.syncWorkflows).not.toHaveBeenCalled()
    expect(warnRestoreFailed).not.toHaveBeenCalled()
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

    expect(await restoration).toBe(false)
    expect(panel.targetUnavailable).toBe(false)
    expect(panel.selectedWorkflow?.path).toBe(current.path)
    expect(warnRestoreFailed).not.toHaveBeenCalled()
  })

  it.for([
    {
      listing: 'fails',
      list: async (): Promise<never> => {
        throw new Error('offline')
      },
      listed: false
    },
    {
      listing: 'gives up before reaching it',
      list: async () => listing([{ id: 'wf-current', name: 'current' }], false),
      listed: false
    },
    {
      listing: 'omits it',
      list: async () => listing([]),
      listed: false
    },
    {
      listing: 'names it',
      list: async () => listing([{ id: 'wf-saved', name: 'saved' }]),
      listed: true
    }
  ])(
    'records whether a listing named the workflow of an unresolved target (listing $listing)',
    async ({ list, listed }) => {
      const { selection, panel, listCloudWorkflows } = setup()
      listCloudWorkflows.mockImplementationOnce(list)

      expect(await selection.restoreTarget('wf-saved', () => true)).toBe(true)

      expect(panel.targetUnresolved).toBe(true)
      expect(panel.unresolvedTargetListed).toBe(listed)
    }
  )

  it('keeps a listed workflow listed when a refresh starts during the catalog sync', async () => {
    const { selection, panel, listCloudWorkflows, resolver, workflows } =
      setup()
    listCloudWorkflows.mockImplementationOnce(async () =>
      listing([{ id: 'wf-saved', name: 'saved' }])
    )
    listCloudWorkflows.mockImplementationOnce(() => new Promise(() => {}))
    vi.mocked(workflows.syncWorkflows).mockImplementationOnce(async () => {
      void resolver.refreshCloudWorkflowIds()
    })

    expect(await selection.restoreTarget('wf-saved', () => true)).toBe(true)

    expect(panel.targetUnresolved).toBe(true)
    expect(panel.unresolvedTargetListed).toBe(true)
  })
})

describe('Current retry of an unresolved target', () => {
  beforeEach(() => localStorage.clear())

  type RetryRun = ReturnType<typeof setup> & { sessionCurrent: boolean }

  function startRetry(run: RetryRun, workflowId: string) {
    run.panel.retainUnresolvedTarget(false)
    let finishListing = () => {}
    const pendingListing = new Promise<void>((resolve) => {
      finishListing = resolve
    })
    run.listCloudWorkflows.mockImplementationOnce(async () => {
      await pendingListing
      return listing([
        { id: 'wf-saved', name: 'saved' },
        { id: 'wf-current', name: 'current' }
      ])
    })
    const retry = run.selection.retryTarget(
      workflowId,
      () => run.sessionCurrent
    )
    return { retry, finishListing }
  }

  it('keeps the unresolved target while the retry waits for Cloud, then opens the workflow it finds', async () => {
    const run = { ...setup(), sessionCurrent: true }
    run.current.load = vi.fn(async () => run.current)
    const { retry, finishListing } = startRetry(run, 'wf-current')

    expect(run.panel.targetUnresolved).toBe(true)
    finishListing()

    expect(await retry).toBe(true)
    expect(run.panel.selectedWorkflow?.path).toBe('workflows/current.json')
  })

  it.for([
    {
      supersededBy: 'a cancelled selection',
      supersede: ({ selection }) => selection.cancelSelection(),
      selected: null,
      unresolved: true
    },
    {
      supersededBy: 'leaving the chat',
      supersede: (run) => {
        run.sessionCurrent = false
      },
      selected: null,
      unresolved: true
    },
    {
      supersededBy: 'a target chosen meanwhile',
      supersede: ({ panel, current }) => panel.setWorkflowTarget(current),
      selected: 'workflows/current.json',
      unresolved: false
    }
  ] satisfies {
    supersededBy: string
    supersede: (run: RetryRun) => void
    selected: string | null
    unresolved: boolean
  }[])(
    'does not settle a retry superseded by $supersededBy',
    async ({ supersede, selected, unresolved }) => {
      const run = { ...setup(), sessionCurrent: true }
      const { retry, finishListing } = startRetry(run, 'wf-gone')

      supersede(run)
      finishListing()

      expect(await retry).toBe(false)
      expect({
        selected: run.panel.selectedWorkflow?.path ?? null,
        unresolved: run.panel.targetUnresolved
      }).toEqual({ selected, unresolved })
    }
  )

  it('does not retry an unresolved target a listing named', async () => {
    const { selection, panel } = setup()
    panel.retainUnresolvedTarget(true)

    expect(await selection.retryTarget('wf-current', () => true)).toBe(true)

    expect(panel.unresolvedTargetListed).toBe(true)
  })
})
