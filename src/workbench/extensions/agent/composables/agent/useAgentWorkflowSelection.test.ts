import { render, waitFor } from '@testing-library/vue'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { i18n } from '@/i18n'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

import type { CloudWorkflowEntry } from '../../schemas/agentApiSchema'
import { AgentApiError } from '../../services/agent/agentRestClient'
import type {
  CloudWorkflowListing,
  CloudWorkflowRow
} from '../../services/agent/agentRestClient'
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
  // The rows cloud actually holds for this fixture, by the version each
  // carries. `wf-draft` is a draft the agent minted and nothing promoted, so
  // it is version 0 and `GET /api/workflows` cannot carry it while
  // `GET /api/workflows/{id}` still serves it; the other two are saved. Any
  // other id answers 404, which is what cloud's `GetByID` does for a
  // soft-deleted row. Tests delete from this map to model a deletion.
  const cloudRows = new Map([
    ['wf-saved', 1],
    ['wf-current', 1],
    ['wf-draft', 0]
  ])
  const getCloudWorkflow = vi.fn(
    async (workflowId: string): Promise<CloudWorkflowRow> => {
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

    expect(await selection.restoreTarget('wf-saved', () => true)).toBe(false)

    expect(workflows.activeWorkflow?.path).toBe(current.path)
    expect(panel.selectedWorkflow).toBeNull()
    expect(panel.targetUnavailable).toBe(false)
    expect(warnRestoreFailed).toHaveBeenCalledOnce()
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

      expect(await selection.restoreTarget('wf-gone', () => true)).toBe(ready)

      expect(workflows.activeWorkflow?.path).toBe(current.path)
      expect(panel.selectedWorkflow).toBeNull()
      expect(panel.targetUnavailable).toBe(unavailable)
      expect(warnRestoreFailed).toHaveBeenCalledTimes(warns)
    }
  )

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

  // The stale-binding policy is unchanged, and `lifecycleReads` records what it
  // now costs: a listing that carries the id settles it outright, while an
  // omitting one is confirmed against `GET /api/workflows/{id}` before the
  // chat's target is retired. `wf-stale` has no row in the fixture, so that
  // read answers 404.
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

  // `GET /api/workflows` excludes version-less rows, so an omitting listing
  // cannot testify about an unsaved workflow. These pin the split: the draft
  // tab the chat owns is focused, while an id with no local owner stays
  // unavailable.
  it('focuses the unsaved draft tab this chat owns when the listing cannot carry it', async () => {
    const {
      selection,
      workflows,
      bindings,
      panel,
      getCloudWorkflow,
      warnRestoreFailed
    } = setup()
    const draft = openDraftTab(workflows, bindings)

    expect(await selection.restoreTarget('wf-draft', () => true)).toBe(true)

    expect(panel.targetUnavailable).toBe(false)
    expect(workflows.activeWorkflow?.path).toBe(draft.path)
    expect(panel.selectedWorkflow?.path).toBe(draft.path)
    expect(warnRestoreFailed).not.toHaveBeenCalled()
    // The draft's own row said it is live; the listing's silence did not.
    expect(getCloudWorkflow).toHaveBeenCalledWith('wf-draft')
  })

  // A run promotes the cloud row while the tab stays temporary, so the tab's
  // `isTemporary` flag cannot tell "never promoted" from "promoted, then
  // deleted". These three cases are indistinguishable from local state alone
  // and are separated only by asking about the id.
  it('calls a promoted-then-deleted draft unavailable even though its tab is still open', async () => {
    const { selection, workflows, bindings, panel, cloudRows, current } =
      setup()
    const draft = openDraftTab(workflows, bindings)
    // The run promoted it, the user deleted it: `GetByID` now answers 404.
    cloudRows.delete('wf-draft')

    expect(await selection.restoreTarget('wf-draft', () => true)).toBe(true)

    expect(panel.targetUnavailable).toBe(true)
    expect(panel.selectedWorkflow).toBeNull()
    // The verdict retires the chat's target; it does not close the user's tab
    // or move them off what they were looking at.
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

  // The listing is a snapshot, and a save that promotes the tab mid-flight
  // lands after it was taken. Reading the tab's `isTemporary` flag after the
  // await would see the promoted tab against a listing that predates it and
  // declare a live, open workflow deleted.
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
    // `isTemporary` is derived, not stored: `UserFile` reads it off the file's
    // size, so saving flips it on the tab the chat already holds.
    let promoted = false
    Object.defineProperty(draft, 'isTemporary', { get: () => !promoted })
    let finishListing = () => {}
    const pendingListing = new Promise<void>((resolve) => {
      finishListing = resolve
    })
    listCloudWorkflows.mockImplementationOnce(async () => {
      await pendingListing
      // Taken before the save landed, so it cannot carry the new row.
      return listing([{ id: 'wf-saved', name: 'saved' }])
    })
    const restoration = selection.restoreTarget('wf-promoted', () => true)

    // The save completes while the listing is in flight: the tab stops being
    // temporary and cloud's row gains its first version.
    promoted = true
    cloudRows.set('wf-promoted', 1)
    finishListing()

    expect(await restoration).toBe(true)
    expect(panel.targetUnavailable).toBe(false)
    expect(panel.selectedWorkflow?.path).toBe(draft.path)
    expect(workflows.activeWorkflow?.path).toBe(draft.path)
    expect(warnRestoreFailed).not.toHaveBeenCalled()
  })

  // A listing that gave up mid-walk is not evidence about the pages it never
  // read, so a saved workflow past the cut must not be retired on its silence.
  it('does not decide anything from a listing that gave up mid-walk', async () => {
    const {
      selection,
      workflows,
      panel,
      current,
      listCloudWorkflows,
      getCloudWorkflow,
      warnRestoreFailed
    } = setup()
    listCloudWorkflows.mockImplementationOnce(async () =>
      listing([{ id: 'wf-saved', name: 'saved' }], false)
    )

    expect(await selection.restoreTarget('wf-past-the-cut', () => true)).toBe(
      false
    )

    expect(panel.targetUnavailable).toBe(false)
    expect(getCloudWorkflow).not.toHaveBeenCalled()
    // Nothing local answers for it either, so this stays the retryable
    // restoration failure it was, not a deletion verdict.
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
    // Waiting on the read itself, not on a microtask count: cancelling before
    // the row read begins only re-proves the listing's own guard.
    await started

    selection.cancelSelection()
    panel.setWorkflowTarget(current)
    finishRead()

    expect(await restoration).toBe(false)
    expect(panel.targetUnavailable).toBe(false)
    expect(panel.selectedWorkflow?.path).toBe(current.path)
    expect(getCloudWorkflow).toHaveBeenCalledOnce()
  })

  it('leaves a deleted target unavailable when nothing local answers for it', async () => {
    const { selection, workflows, panel, current, warnRestoreFailed } = setup()

    expect(await selection.restoreTarget('wf-deleted', () => true)).toBe(true)

    expect(panel.targetUnavailable).toBe(true)
    expect(panel.selectedWorkflow).toBeNull()
    expect(workflows.activeWorkflow?.path).toBe(current.path)
    expect(vi.mocked(workflows.syncWorkflows)).not.toHaveBeenCalled()
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
})
