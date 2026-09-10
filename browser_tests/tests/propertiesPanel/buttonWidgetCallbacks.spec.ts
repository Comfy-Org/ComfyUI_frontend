import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

const NODE_TYPE = 'DevToolsRemoteWidgetNodeWithRefreshButton'

test.describe(
  'Properties panel - Button widget callbacks',
  { tag: ['@ui', '@widget', '@node'] },
  () => {
    let panel: PropertiesPanelHelper
    let requestCount: number

    test.beforeEach(async ({ comfyPage }) => {
      requestCount = 0
      await comfyPage.page.route(
        '**/api/models/checkpoints**',
        async (route) => {
          requestCount++
          await route.fulfill({
            body: JSON.stringify(['checkpoint.safetensors']),
            status: 200
          })
        }
      )
      panel = new PropertiesPanelHelper(comfyPage.page)
      await comfyPage.nodeOps.clearGraph()
      const node = await comfyPage.nodeOps.addNode(NODE_TYPE)
      await node.click('title')
      await comfyPage.actionbar.propertiesButton.click()
      await expect(panel.root).toBeVisible()
      await expect.poll(() => requestCount).toBe(1)
    })

    test('invokes the callback from node Parameters', async () => {
      await panel.contentArea
        .getByRole('button', { name: 'refresh', exact: true })
        .click()

      await expect.poll(() => requestCount).toBe(2)
    })

    test('invokes the callback from Favorited Inputs', async ({
      comfyPage
    }) => {
      const refreshRow = panel.root.locator('.widget-item', {
        has: comfyPage.page.getByRole('button', {
          name: 'refresh',
          exact: true
        })
      })
      await refreshRow
        .getByTestId(TestIds.subgraphEditor.widgetActionsMenuButton)
        .click()
      await comfyPage.page
        .getByTestId(TestIds.menu.moreMenuContent)
        .getByText('Favorite', { exact: true })
        .click()

      await comfyPage.page.evaluate(() => window.app!.canvas.deselectAll())
      await comfyPage.nextFrame()
      await panel.contentArea
        .getByRole('button', { name: 'refresh', exact: true })
        .click()

      await expect.poll(() => requestCount).toBe(2)
    })
  }
)
