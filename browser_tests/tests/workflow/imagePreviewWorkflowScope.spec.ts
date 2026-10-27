import type { Route } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  hasHandledImageLoad,
  restoreImageSrc,
  trackHandledImageLoads
} from '@e2e/fixtures/utils/imageLoadSpy'

const VIEW_ROUTE = '**/api/view?**'
const WORKFLOW_B = 'preview-scope-b'
const SHARED_NODE = { id: '10', type: 'LoraLoaderModelOnly' }

for (const mode of ['canvas', 'vue'] as const) {
  test.describe(
    `Image preview workflow scope (${mode} mode)`,
    { tag: mode === 'vue' ? ['@vue-nodes'] : [] },
    () => {
      const held: Route[] = []

      test.beforeEach(async ({ comfyPage }) => {
        held.length = 0
        await comfyPage.workflow.setupWorkflowsDirectory({
          [`${WORKFLOW_B}.json`]: 'nodes/lora_loader_model_only_id_10.json'
        })
        await comfyPage.page.route(VIEW_ROUTE, async (route) => {
          if (route.request().url().includes('example.png')) held.push(route)
          else await route.fallback()
        })
        await trackHandledImageLoads(comfyPage.page)
      })

      test.afterEach(async ({ comfyPage }) => {
        await restoreImageSrc(comfyPage.page)
        await comfyPage.page.unroute(VIEW_ROUTE)
        await comfyPage.workflow.setupWorkflowsDirectory({})
      })

      test('a late preview load does not land on another workflow node with the same id', async ({
        comfyPage
      }) => {
        const { page } = comfyPage
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

        await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
        await expect.poll(() => held.length).toBeGreaterThan(0)

        const workflowsTab = comfyPage.menu.workflowsTab
        await workflowsTab.open()
        await workflowsTab.getPersistedItem(WORKFLOW_B).dblclick()
        await expect.poll(firstNodeState).toEqual(SHARED_NODE)

        for (const route of held.splice(0)) await route.fallback()
        await expect
          .poll(() => hasHandledImageLoad(page, 'example.png'))
          .toBe(true)

        expect(await firstNodeState()).toEqual(SHARED_NODE)
      })
    }
  )
}
