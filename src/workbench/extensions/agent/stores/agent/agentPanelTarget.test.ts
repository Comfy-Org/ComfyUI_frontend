import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAgentPanelStore } from './agentPanelStore'

vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: () => null
}))

function setup() {
  const workflows = useWorkflowStore()
  const target = workflows.createTemporary('a.json')
  const other = workflows.createTemporary('b.json')
  workflows.openWorkflowsInBackground({ right: [target.path, other.path] })
  const panel = useAgentPanelStore()
  panel.setWorkflowTarget(target)
  return { workflows, panel, target, other }
}

describe('Agent target tab lifetime', () => {
  it('clears a closed target with no panel mounted and does not retarget on reopening', async () => {
    const { workflows, panel, target } = setup()
    await nextTick()
    expect(panel.selectedWorkflow?.path).toBe(target.path)
    await workflows.closeWorkflow(target)
    await nextTick()
    expect(panel.selectedWorkflow).toBeNull()
    const reopened = workflows.createTemporary('a.json')
    workflows.openWorkflowsInBackground({ right: [reopened.path] })
    await nextTick()
    expect(panel.selectedWorkflow).toBeNull()
  })

  it('retains a renamed target when another tab closes', async () => {
    const { workflows, panel, target, other } = setup()
    vi.spyOn(target, 'rename').mockImplementation(async (path) => {
      target.path = path
      return target
    })
    await workflows.renameWorkflow(target, 'workflows/renamed.json')
    await workflows.closeWorkflow(other)
    await nextTick()
    expect(panel.selectedWorkflow?.path).toBe('workflows/renamed.json')
  })
})
