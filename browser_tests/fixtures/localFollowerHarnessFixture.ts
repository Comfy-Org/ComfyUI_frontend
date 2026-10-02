import type { Page, TestInfo } from '@playwright/test'
import { z } from 'zod'

import type { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'
import type { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import type { useAgentWorkflowTabBindingStore } from '@/workbench/extensions/agent/stores/agent/agentWorkflowTabBindingStore'

type AgentConsentStore = ReturnType<typeof useAgentConsentStore>
type AgentPanelStore = ReturnType<typeof useAgentPanelStore>
type AgentWorkflowTabBindingStore = ReturnType<
  typeof useAgentWorkflowTabBindingStore
>
type WorkflowStore = ReturnType<typeof useWorkflowStore>

export const localFollowerHealthSchema = z.object({
  harness: z.literal('local-follower-e2e-injector')
})

export const localFollowerInjectionSchema = z.object({
  applied: z.boolean(),
  delivered: z.number(),
  node_id: z.number(),
  projected_nodes: z.number(),
  update_bytes: z.number()
})

export async function openLocalAgentPanel(page: Page): Promise<boolean> {
  return await page.evaluate(async () => {
    const isAgentConsentStore = (store: {
      $id: string
    }): store is AgentConsentStore => store.$id === 'agentConsent'
    const isAgentPanelStore = (store: {
      $id: string
    }): store is AgentPanelStore => store.$id === 'agentPanel'
    const pinia =
      document.getElementById('vue-app')?.__vue_app__?.config.globalProperties
        .$pinia
    if (!pinia) return false
    const stores = [...pinia._s.values()]
    const consent = stores.find(isAgentConsentStore)
    const panel = stores.find(isAgentPanelStore)
    if (!consent || !panel || !(await consent.accept())) return false
    panel.enabled = true
    panel.isOpen = true
    return true
  })
}

export async function bindActiveWorkflow(
  page: Page,
  workflowId: string
): Promise<boolean> {
  return await page.evaluate((workflowId) => {
    const isBindingStore = (store: {
      $id: string
    }): store is AgentWorkflowTabBindingStore =>
      store.$id === 'agentWorkflowTabBinding'
    const isWorkflowStore = (store: { $id: string }): store is WorkflowStore =>
      store.$id === 'workflow'
    const pinia =
      document.getElementById('vue-app')?.__vue_app__?.config.globalProperties
        .$pinia
    if (!pinia) return false
    const stores = [...pinia._s.values()]
    const binding = stores.find(isBindingStore)
    const workflows = stores.find(isWorkflowStore)
    const path = workflows?.activeWorkflow?.path
    if (!binding || typeof path !== 'string') return false
    binding.bind(workflowId, path)
    return binding.workflowIdFor(path) === workflowId
  }, workflowId)
}

export async function attachCanvasScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string
): Promise<void> {
  await testInfo.attach(name, {
    body: await page.locator('#graph-canvas').screenshot(),
    contentType: 'image/png'
  })
}
