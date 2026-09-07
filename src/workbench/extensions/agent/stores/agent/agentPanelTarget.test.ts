import { fromPartial } from '@total-typescript/shoehorn'
import {
  createPinia,
  disposePinia,
  getActivePinia,
  setActivePinia
} from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useAgentPanelStore } from './agentPanelStore'

const host = vi.hoisted(() => ({ tabs: [] as ComfyWorkflow[] }))
vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    get openWorkflows() {
      return host.tabs
    }
  })
}))
vi.mock('@/platform/telemetry', () => ({ useTelemetry: () => null }))

describe('Agent target tab lifetime', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    host.tabs = reactive([])
  })
  afterEach(() => {
    const pinia = getActivePinia()
    if (pinia) disposePinia(pinia)
  })

  it('clears a closed target with no panel mounted and does not retarget to another tab', async () => {
    const target = fromPartial<ComfyWorkflow>({ path: 'workflows/a.json' })
    const other = fromPartial<ComfyWorkflow>({ path: 'workflows/b.json' })
    host.tabs.push(target, other)
    const panel = useAgentPanelStore()
    panel.selectedWorkflow = target
    await nextTick()
    expect(panel.selectedWorkflow.path).toBe(target.path)
    host.tabs.splice(0, 1)
    await nextTick()
    expect(panel.selectedWorkflow).toBeNull()
    host.tabs.push(target)
    await nextTick()
    expect(panel.selectedWorkflow).toBeNull()
  })

  it('retains a renamed target when another tab closes', async () => {
    const target = fromPartial<ComfyWorkflow>({ path: 'workflows/a.json' })
    host.tabs.push(
      target,
      fromPartial<ComfyWorkflow>({ path: 'workflows/b.json' })
    )
    const panel = useAgentPanelStore()
    panel.selectedWorkflow = target
    await nextTick()
    host.tabs[0].path = 'workflows/renamed.json'
    host.tabs.pop()
    await nextTick()
    expect(panel.selectedWorkflow.path).toBe('workflows/renamed.json')
  })
})
