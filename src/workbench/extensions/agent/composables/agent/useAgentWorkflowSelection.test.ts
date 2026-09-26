import { render, waitFor } from '@testing-library/vue'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { i18n } from '@/i18n'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

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
  const warnWorkflowUnavailable = vi.fn()
  const listCloudWorkflows = vi.fn(async () => [
    { id: 'wf-saved', name: 'saved' },
    { id: 'wf-current', name: 'current' }
  ])
  const resolver = useAgentWorkflowResolver({
    workflows,
    bindings,
    listCloudWorkflows
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
          warnWorkflowUnavailable
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
    warnWorkflowUnavailable
  }
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
        warnWorkflowUnavailable
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
        return [{ id: 'wf-saved', name: 'saved' }]
      })
      const restoration = selection.restoreTarget('wf-saved', () => true)

      try {
        await waitFor(() => {
          expect(workflows.activeWorkflow?.path).toBe(saved.path)
          expect(panel.selectedWorkflow?.path).toBe(saved.path)
          expect(bindings.tabPathFor('wf-saved')).toBe(saved.path)
        })
        expect(listCloudWorkflows).toHaveBeenCalledTimes(1)
        expect(warnWorkflowUnavailable).not.toHaveBeenCalled()
      } finally {
        finishRefresh()
        await restoration
      }
    }
  )

  it('reopens a known saved workflow without waiting for catalog synchronization', async () => {
    const { selection, workflows, bindings, panel, warnWorkflowUnavailable } =
      setup()
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
      expect(warnWorkflowUnavailable).not.toHaveBeenCalled()
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
      return [
        { id: 'wf-saved', name: 'saved' },
        { id: 'wf-current', name: 'current' }
      ]
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
      warnWorkflowUnavailable
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
    expect(warnWorkflowUnavailable).not.toHaveBeenCalled()
  })

  it('opens and binds a saved workflow discovered by catalog synchronization', async () => {
    const { selection, workflows, bindings, panel, warnWorkflowUnavailable } =
      setup()
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
    expect(warnWorkflowUnavailable).not.toHaveBeenCalled()
  })

  it('does not reopen an old target when selection changes during catalog synchronization', async () => {
    const {
      selection,
      workflows,
      bindings,
      panel,
      current,
      warnWorkflowUnavailable
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
    expect(warnWorkflowUnavailable).not.toHaveBeenCalled()
  })

  it('keeps the current view and warns when the saved workflow no longer exists', async () => {
    const { selection, workflows, panel, current, warnWorkflowUnavailable } =
      setup()

    await selection.restoreTarget('wf-saved', () => true)

    expect(workflows.activeWorkflow?.path).toBe(current.path)
    expect(panel.selectedWorkflow).toBeNull()
    expect(warnWorkflowUnavailable).toHaveBeenCalledOnce()
  })
})
