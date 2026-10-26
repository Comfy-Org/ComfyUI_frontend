import type { Route } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  hasHandledImageLoad,
  restoreImageSrc,
  trackHandledImageLoads
} from '@e2e/fixtures/utils/imageLoadSpy'

for (const mode of ['canvas', 'vue'] as const) {
  test.describe(
    `Image preview workflow scope (${mode} mode)`,
    { tag: mode === 'vue' ? ['@vue-nodes'] : [] },
    () => {
      test('a late preview load does not land on a reopened workflow node with the same id', async ({
        comfyPage
      }) => {
        const { page } = comfyPage
        const workflowB = `preview-scope-b-${Date.now().toString(36)}`
        function firstNodeState() {
          return page.evaluate(() => {
            const node = window.app!.graph.nodes.at(0)
            return node
              ? {
                  id: String(node.id),
                  type: node.type,
                  imgs: node.imgs?.length
                }
              : null
          })
        }

        await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
        await comfyPage.searchBoxV2.addNode('Load Image')
        await expect
          .poll(async () => (await firstNodeState())?.imgs)
          .toBeGreaterThan(0)
        const { id: sharedId } = (await firstNodeState())!

        await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
        await comfyPage.searchBoxV2.addNode('Load LoRA')
        await expect
          .poll(firstNodeState)
          .toEqual({ id: sharedId, type: 'LoraLoaderModelOnly' })
        await comfyPage.menu.topbar.saveWorkflow(workflowB)

        const held: Route[] = []
        await page.route('**/api/view?**', async (route) => {
          if (route.request().url().includes('example.png')) held.push(route)
          else await route.fallback()
        })

        try {
          await trackHandledImageLoads(page)
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

          for (const route of held.splice(0)) await route.fallback()
          await expect
            .poll(() => hasHandledImageLoad(page, 'example.png'))
            .toBe(true)

          expect(await firstNodeState()).toEqual({
            id: sharedId,
            type: 'LoraLoaderModelOnly'
          })
        } finally {
          await restoreImageSrc(page)
          await page.unroute('**/api/view?**')
          await comfyPage.workflow.deleteWorkflow(workflowB)
        }
      })
    }
  )
}
