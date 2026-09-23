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
  const node = await comfyPage.nodeOps.addNode(NODE_TYPE, undefined, {
    x: 300,
    y: 200
  })
  await initialRequest
  await comfyPage.vueNodes.selectNode(String(node.id))

  const panel = new PropertiesPanelHelper(comfyPage.page)
  await comfyPage.actionbar.propertiesButton.click()
  await expect(panel.root).toBeVisible()
  await expect(panel.panelTitle).toContainText(
    'Remote Widget Node With Refresh Button'
  )
  return panel
}

test.describe(
  'Properties panel - Button widget callbacks',
  { tag: ['@ui', '@widget', '@node', '@vue-nodes'] },
  () => {
    test('invokes the callback from node Parameters', async ({ comfyPage }) => {
      const panel = await setupButtonWidget(comfyPage)
      await Promise.all([
        comfyPage.page.waitForRequest(CHECKPOINTS_ROUTE),
        panel.contentArea
          .getByRole('button', { name: 'refresh', exact: true })
          .click()
      ])
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
      await expect(panel.panelTitle).toContainText('Workflow Overview')
      await Promise.all([
        comfyPage.page.waitForRequest(CHECKPOINTS_ROUTE),
        panel.contentArea
          .getByRole('button', { name: 'refresh', exact: true })
          .click()
      ])
    })
  }
)
