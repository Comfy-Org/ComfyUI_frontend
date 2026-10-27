import type { Route } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { UserDataHelper } from '@e2e/fixtures/helpers/UserDataHelper'
import type { WorkspaceStore } from '@e2e/types/globals'
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
      test('a late preview load does not land on another workflow node with the same id', async ({
        comfyPage
      }) => {
        const { page } = comfyPage
        const workflowB = `preview-scope-b-${Date.now().toString(36)}`
        const workflowBFile = `workflows/${workflowB}.json`
        const userData = new UserDataHelper(
          comfyPage.request,
          comfyPage.id,
          comfyPage.url
        )
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

        const held: Route[] = []
        await page.route('**/api/view?**', async (route) => {
          if (route.request().url().includes('example.png')) held.push(route)
          else await route.fallback()
        })

        try {
          await trackHandledImageLoads(page)
          await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
          const { id } = await comfyPage.nodeOps.addNode('LoadImage')
          const sharedId = String(id)
          await expect.poll(() => held.length).toBeGreaterThan(0)

          await userData.write(workflowBFile, {
            last_node_id: Number(id),
            last_link_id: 0,
            nodes: [
              {
                id: Number(id),
                type: 'LoraLoaderModelOnly',
                pos: [100, 100],
                size: [315, 82],
                flags: {},
                order: 0,
                mode: 0,
                properties: {},
                widgets_values: []
              }
            ],
            links: [],
            groups: [],
            config: {},
            extra: {},
            version: 0.4
          })
          await page.evaluate(() =>
            (
              window.app!.extensionManager as WorkspaceStore
            ).workflow.syncWorkflows()
          )
          const workflowsTab = comfyPage.menu.workflowsTab
          await workflowsTab.open()
          await workflowsTab.getPersistedItem(workflowB).dblclick()
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
          await userData.delete(workflowBFile)
        }
      })
    }
  )
}
