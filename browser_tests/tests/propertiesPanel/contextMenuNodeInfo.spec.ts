import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

test.describe(
  'Properties panel - Node Info via context menu',
  { tag: '@vue-nodes' },
  () => {
    let panel: PropertiesPanelHelper

    test.beforeEach(async ({ comfyPage }) => {
      panel = new PropertiesPanelHelper(comfyPage.page)
    })

    test('opens the right side panel Info tab when clicked from the node context menu', async ({
      comfyPage
    }) => {
      await expect(panel.root).toBeHidden()

      const fixture = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
      await comfyPage.contextMenu.openForVueNode(fixture.header)
      await comfyPage.contextMenu.clickMenuItemExact('Node Info')

      await expect(panel.root).toBeVisible()
      await expect(panel.getTab('Info')).toBeVisible()
      await expect(
        panel.contentArea.getByRole('heading', { name: 'Inputs' })
      ).toBeVisible()
    })
  }
)
