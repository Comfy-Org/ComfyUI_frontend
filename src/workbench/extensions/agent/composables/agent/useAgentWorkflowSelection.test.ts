import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useI18n } from 'vue-i18n'

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

vi.mock(import('vue-i18n'), { spy: true })

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

function setup(listCloudWorkflows: () => Promise<CloudWorkflowEntry[]>) {
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
    // Re-applied per test: mocks are restored between tests.
    vi.mocked(useI18n).mockReturnValue(fromPartial({ t: (key: string) => key }))
    localStorage.clear()
    workflowService.openWorkflow.mockClear()
    workflowService.saveWorkflowAs.mockClear()
  })

  it('an unresolved saved tab is refused until the saved-workflow index names it', async () => {
    const tab = addTab('workflows/saved.json')
    const { selection, warnWorkflowUnavailable } = setup(async () => [])

    await expect(selection.selectTarget(tab.path)).resolves.toBe(false)

    expect(warnWorkflowUnavailable).toHaveBeenCalledTimes(1)
    expect(useAgentPanelStore().selectedWorkflow).toBeNull()
  })
})
