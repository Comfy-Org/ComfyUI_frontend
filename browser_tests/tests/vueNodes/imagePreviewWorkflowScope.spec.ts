/**
 * 1.57 QA: a Load Image preview from one workflow tab showed up on the node
 * with the same id in another workflow after that workflow was closed and
 * reopened. The Vue image preview copies its loaded <img> onto the legacy
 * `node.imgs` by node id. When the preview's image finished loading after its
 * graph had been swapped out, the id resolved to the other workflow's node.
 */
import type { Route } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Vue image preview workflow scope', { tag: '@vue-nodes' }, () => {
  test('a late preview load does not land on a reopened workflow node with the same id', async ({
    comfyPage
  }) => {
    const workflowB = `preview-scope-b-${Date.now().toString(36)}`

    const firstNodeState = () =>
      comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.at(0)
        return node
          ? { id: String(node.id), type: node.type, imgs: node.imgs?.length }
          : null
      })

    // Workflow A: a Load Image node as the first node, showing its preview
    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.searchBoxV2.addNode('Load Image')
    const loadImageNode = comfyPage.vueNodes.getNodeByTitle('Load Image')
    await expect(loadImageNode.locator('img')).toBeVisible()
    const { id: sharedId } = (await firstNodeState())!

    // Workflow B: a different node with the same id, saved
    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.searchBoxV2.addNode('Load LoRA')
    await expect
      .poll(firstNodeState)
      .toEqual({ id: sharedId, type: 'LoraLoaderModelOnly' })
    await comfyPage.menu.topbar.saveWorkflow(workflowB)

    // Hold A's preview image so it is still loading when A is swapped out
    const held: Route[] = []
    await comfyPage.page.route('**/api/view?**', async (route) => {
      if (route.request().url().includes('example.png')) held.push(route)
      else await route.fallback()
    })

    try {
      // Closing B brings A back, which requests its preview again
      await comfyPage.menu.topbar.closeWorkflowTab(workflowB)
      await comfyPage.workflow.waitForWorkflowIdle()
      await expect.poll(() => held.length).toBeGreaterThan(0)

      const workflowsTab = comfyPage.menu.workflowsTab
      await workflowsTab.open()
      await workflowsTab.getPersistedItem(workflowB).dblclick()
      await comfyPage.workflow.waitForWorkflowIdle()
      await expect
        .poll(firstNodeState)
        .toEqual({ id: sharedId, type: 'LoraLoaderModelOnly' })

      // A's preview now finishes loading while B is on the canvas
      const loaded = comfyPage.page.waitForEvent('requestfinished', (req) =>
        req.url().includes('example.png')
      )
      for (const route of held.splice(0)) await route.fallback()
      await loaded
      await comfyPage.nextFrame()

      expect(await firstNodeState()).toEqual({
        id: sharedId,
        type: 'LoraLoaderModelOnly'
      })
    } finally {
      await comfyPage.page.unroute('**/api/view?**')
      await comfyPage.workflow.deleteWorkflow(workflowB)
    }
  })
})
