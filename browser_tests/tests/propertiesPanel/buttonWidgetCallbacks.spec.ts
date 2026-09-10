import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

const NODE_TYPE = 'DevToolsRemoteWidgetNodeWithRefreshButton'
const CHECKPOINTS_ROUTE = '**/api/models/checkpoints**'

async function setupButtonWidget(comfyPage: ComfyPage) {
  await comfyPage.page.route(CHECKPOINTS_ROUTE, async (route) => {
    await route.fulfill({
      body: JSON.stringify(['checkpoint.safetensors']),
      status: 200
    })
  })
  await comfyPage.nodeOps.clearGraph()
  const initialRequest = comfyPage.page.waitForRequest(CHECKPOINTS_ROUTE)
  const node = await comfyPage.nodeOps.addNode(NODE_TYPE)
  await initialRequest
  await node.click('title')

  const panel = new PropertiesPanelHelper(comfyPage.page)
  await comfyPage.actionbar.propertiesButton.click()
  await expect(panel.root).toBeVisible()
  return panel
}

test.describe(
  'Properties panel - Button widget callbacks',
  { tag: ['@ui', '@widget', '@node', '@vue-nodes'] },
  () => {
    test('invokes the callback from node Parameters', async ({ comfyPage }) => {
      const panel = await setupButtonWidget(comfyPage)
      const refreshRequest = comfyPage.page.waitForRequest(CHECKPOINTS_ROUTE)
      await panel.contentArea
        .getByRole('button', { name: 'refresh', exact: true })
        .click()

      await refreshRequest
    })

    test('invokes the callback from Favorited Inputs', async ({
      comfyPage
    }) => {
      const panel = await setupButtonWidget(comfyPage)
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
      const refreshRequest = comfyPage.page.waitForRequest(CHECKPOINTS_ROUTE)
      await panel.contentArea
        .getByRole('button', { name: 'refresh', exact: true })
        .click()

      await refreshRequest
    })
  }
)
