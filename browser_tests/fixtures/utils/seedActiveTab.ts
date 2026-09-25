import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import type { WorkflowJSON } from '@comfyorg/comfy-multi-player'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { WorkspaceStore } from '@e2e/types/globals'

function highest(values: readonly unknown[]): number {
  return values.reduce<number>(
    (max, value) => (typeof value === 'number' && value > max ? value : max),
    0
  )
}

/**
 * The backend mints a host doc from the workflow the frontend posts, so at
 * first subscribe the live graph and the doc hold the same nodes. Loading the
 * doc's seed into the tab a test is about to target keeps that parity.
 *
 * Seeds carry only the fields the doc projects; the per-node bookkeeping a
 * saved workflow always has is filled in so the strict schema accepts them.
 */
function seedAsComfyWorkflow(seed: WorkflowJSON): ComfyWorkflowJSON {
  return zComfyWorkflow.parse({
    last_node_id: highest(seed.nodes.map((node) => node.id)),
    last_link_id: highest(
      seed.links.map((link) => (Array.isArray(link) ? link[0] : undefined))
    ),
    version: 0.4,
    ...seed,
    nodes: seed.nodes.map((node, order) => ({
      flags: {},
      order,
      mode: 0,
      properties: {},
      ...node
    }))
  })
}

function liveNodeIds(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    window.app!.graph.nodes.map((node) => String(node.id)).sort()
  )
}

export async function loadSeedIntoActiveTab(
  page: Page,
  seed: WorkflowJSON
): Promise<void> {
  const workflow = seedAsComfyWorkflow(seed)
  await page.waitForFunction(
    () =>
      (window.app!.extensionManager as WorkspaceStore).workflow
        .activeWorkflow !== null
  )
  await page.evaluate(async (workflowJson) => {
    const app = window.app!
    const { activeWorkflow } = (app.extensionManager as WorkspaceStore).workflow
    if (!activeWorkflow) throw new Error('no active workflow tab to seed')
    await app.loadGraphData(workflowJson, true, true, activeWorkflow)
  }, workflow)
  await expect
    .poll(() => liveNodeIds(page))
    .toEqual(seed.nodes.map((node) => String(node.id)).sort())
}
