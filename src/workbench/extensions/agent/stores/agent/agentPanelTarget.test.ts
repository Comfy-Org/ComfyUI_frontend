import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAgentPanelStore } from './agentPanelStore'

vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: () => null
}))

async function setup() {
  const workflows = useWorkflowStore()
  const target = await workflows.createTemporary('a.json').load()
  const other = await workflows.createTemporary('b.json').load()
  workflows.openWorkflowsInBackground({ right: [target.path, other.path] })
  const panel = useAgentPanelStore()
  panel.setWorkflowTarget(target)
  return { workflows, panel, target, other }
}

describe('Agent target tab lifetime', () => {
  it('clears a closed target with no panel mounted and does not retarget on reopening', async () => {
    const { workflows, panel, target } = await setup()
    await nextTick()
    expect(panel.selectedWorkflow?.path).toBe(target.path)
    await workflows.closeWorkflow(target)
    await nextTick()
    expect(panel.selectedWorkflow).toBeNull()
    panel.initializeTargetTracking(true)
    expect(panel.canRestoreWorkflow).toBe(false)
    expect(panel.followsVisibleWorkflow).toBe(false)
    const reopened = workflows.createTemporary('a.json')
    workflows.openWorkflowsInBackground({ right: [reopened.path] })
    await nextTick()
    expect(panel.selectedWorkflow).toBeNull()
  })

  it('retains a renamed target when another tab closes', async () => {
    const { workflows, panel, target, other } = await setup()
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

describe('Agent target tracking policy', () => {
  it('leaves the target undecided while startup is unresolved', async () => {
    const workflows = useWorkflowStore()
    const panel = useAgentPanelStore()
    workflows.activeWorkflow = await workflows.createTemporary('a.json').load()
    expect(panel.selectedWorkflow).toBeNull()
    workflows.activeWorkflow = await workflows.createTemporary('b.json').load()
    expect(panel.selectedWorkflow).toBeNull()
    expect(panel.followsVisibleWorkflow).toBe(false)
  })

  it('derives a fresh target and tab changes without a mounted panel', async () => {
    const workflows = useWorkflowStore()
    const panel = useAgentPanelStore()
    const a = await workflows.createTemporary('a.json').load()
    const b = await workflows.createTemporary('b.json').load()
    workflows.activeWorkflow = a
    panel.initializeTargetTracking(false)
    expect(panel.selectedWorkflow?.path).toBe(a.path)
    workflows.activeWorkflow = b
    expect(panel.selectedWorkflow?.path).toBe(b.path)
  })

  it('retains the chosen target across navigation and repeated startup', async () => {
    const { workflows, panel, target, other } = await setup()
    workflows.activeWorkflow = other
    panel.initializeTargetTracking(false)
    expect(panel.selectedWorkflow?.path).toBe(target.path)
    expect(panel.followsVisibleWorkflow).toBe(false)
    expect(panel.canRestoreWorkflow).toBe(false)
  })

  it('continues following the replacement when the visible tab closes', async () => {
    const { workflows, panel, target, other } = await setup()
    workflows.activeWorkflow = target
    panel.startFollowingVisibleWorkflow()
    await workflows.closeWorkflow(target)
    await nextTick()
    workflows.activeWorkflow = other
    expect(panel.selectedWorkflow?.path).toBe(other.path)
    expect(panel.followsVisibleWorkflow).toBe(true)
  })

  it('captures a followed workflow on commitment and only New Chat resumes following', async () => {
    const { workflows, panel, target, other } = await setup()
    workflows.activeWorkflow = target
    panel.startFollowingVisibleWorkflow()
    panel.retainWorkflowTarget()
    workflows.activeWorkflow = other
    panel.initializeTargetTracking(false)
    expect(panel.selectedWorkflow?.path).toBe(target.path)
    expect(panel.followsVisibleWorkflow).toBe(false)
    panel.startFollowingVisibleWorkflow()
    expect(panel.selectedWorkflow?.path).toBe(other.path)
  })

  it('separates history restoration from an explicitly cleared target', async () => {
    const { workflows, panel, other } = await setup()
    panel.setWorkflowTarget(null)
    panel.initializeTargetTracking(true)
    workflows.activeWorkflow = other
    expect(panel.selectedWorkflow).toBeNull()
    expect(panel.canRestoreWorkflow).toBe(false)
    panel.beginWorkflowRestoration()
    expect(panel.selectedWorkflow).toBeNull()
    expect(panel.canRestoreWorkflow).toBe(true)
    expect(panel.followsVisibleWorkflow).toBe(false)
  })

  it('keeps restoration eligible through navigation while waiting for history', async () => {
    const workflows = useWorkflowStore()
    const panel = useAgentPanelStore()
    panel.initializeTargetTracking(true)
    workflows.activeWorkflow = await workflows.createTemporary('a.json').load()
    expect(panel.selectedWorkflow).toBeNull()
    expect(panel.followsVisibleWorkflow).toBe(false)
    expect(panel.canRestoreWorkflow).toBe(true)
    panel.setWorkflowTarget(workflows.activeWorkflow)
    expect(panel.canRestoreWorkflow).toBe(false)
    expect(panel.followsVisibleWorkflow).toBe(false)
  })
})
