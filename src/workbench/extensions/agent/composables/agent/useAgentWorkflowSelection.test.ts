import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import { useToastStore } from '@/platform/updates/common/toastStore'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'
import { getFilenameDetails } from '@/utils/formatUtil'

import type { CloudWorkflowEntry } from '../../schemas/agentApiSchema'
import { useAgentPanelStore } from '../../stores/agent/agentPanelStore'
import { useAgentWorkflowTabBindingStore } from '../../stores/agent/agentWorkflowTabBindingStore'
import { useAgentWorkflowResolver } from './useAgentWorkflowResolver'
import { useAgentWorkflowSelection } from './useAgentWorkflowSelection'

const workflowService = vi.hoisted(() => ({
  openWorkflow: vi.fn(async () => true),
  saveWorkflowAs: vi.fn(async () => true)
}))

vi.mock<unknown>(
  import('@/platform/workflow/core/services/workflowService'),
  () => ({ useWorkflowService: () => workflowService })
)

vi.mock<unknown>(import('vue-i18n'), async (importOriginal) => ({
  ...(await importOriginal()),
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

function addTab(path: string, isTemporary = false): LoadedComfyWorkflow {
  const workflowStore = useWorkflowStore()
  const slash = path.lastIndexOf('/')
  const { filename, suffix } = getFilenameDetails(path.slice(slash + 1))
  const tab = createMockLoadedWorkflow({
    path,
    directory: path.slice(0, slash),
    filename,
    suffix,
    isTemporary,
    isModified: false,
    activeState: null
  })
  tab.load = vi.fn(async () => tab)
  workflowStore.attachWorkflow(tab, workflowStore.openWorkflows.length)
  workflowStore.openWorkflowsInBackground({ right: [tab.path] })
  return tab
}

function setup(
  listCloudWorkflows: (() => Promise<CloudWorkflowEntry[]>) | null
) {
  const scope = effectScope()
  const warnWorkflowUnavailable = vi.fn()
  const selection = scope.run(() => {
    const resolver = useAgentWorkflowResolver({
      workflows: useWorkflowStore(),
      bindings: useAgentWorkflowTabBindingStore(),
      listCloudWorkflows
    })
    return useAgentWorkflowSelection({
      resolver,
      canSelectTarget: () => true,
      warnWorkflowUnavailable
    })
  })!
  return { selection, warnWorkflowUnavailable, scope }
}

describe('Agent workflow target selection', () => {
  beforeEach(() => {
    localStorage.clear()
    workflowService.openWorkflow.mockClear()
    workflowService.saveWorkflowAs.mockClear()
  })

  it('without a cloud index (standalone), an unbound saved tab becomes the target as-is', async () => {
    const tab = addTab('workflows/saved.json')
    const { selection, warnWorkflowUnavailable } = setup(null)

    await expect(selection.selectTarget(tab.path)).resolves.toBe(true)

    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(tab.path)
    expect(workflowService.openWorkflow).toHaveBeenCalledWith(tab)
    expect(workflowService.saveWorkflowAs).not.toHaveBeenCalled()
    expect(warnWorkflowUnavailable).not.toHaveBeenCalled()
    expect(useToastStore().messagesToAdd).toEqual([])
    // No workflow exists for the tab yet: the agent mints one on its first
    // turn and the ack binds it. Nothing is bound in advance.
    expect(
      useAgentWorkflowTabBindingStore().workflowIdFor(tab.path)
    ).toBeUndefined()
  })

  it('without a cloud index, a temporary tab is not saved to acquire an id', async () => {
    const tab = addTab('workflows/Unsaved Workflow.json', true)
    const { selection, warnWorkflowUnavailable } = setup(null)

    await expect(selection.selectTarget(tab.path)).resolves.toBe(true)

    expect(workflowService.saveWorkflowAs).not.toHaveBeenCalled()
    expect(warnWorkflowUnavailable).not.toHaveBeenCalled()
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(tab.path)
  })

  it('without a cloud index, a tab already bound to a workflow keeps that binding', async () => {
    const tab = addTab('workflows/bound.json')
    useAgentWorkflowTabBindingStore().bind('wf-bound', tab.path)
    const { selection } = setup(null)

    await expect(selection.selectTarget(tab.path)).resolves.toBe(true)

    expect(useAgentWorkflowTabBindingStore().workflowIdFor(tab.path)).toBe(
      'wf-bound'
    )
  })

  it('with a cloud index (cloud), an unresolved saved tab is still refused', async () => {
    const tab = addTab('workflows/saved.json')
    const { selection, warnWorkflowUnavailable } = setup(async () => [])

    await expect(selection.selectTarget(tab.path)).resolves.toBe(false)

    expect(warnWorkflowUnavailable).toHaveBeenCalledTimes(1)
    expect(useAgentPanelStore().selectedWorkflow).toBeNull()
  })
})
