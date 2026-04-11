import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

test.describe('Properties panel - Title editing', () => {
  let panel: PropertiesPanelHelper

  test.beforeEach(async ({ comfyPage }) => {
    panel = new PropertiesPanelHelper(comfyPage.page)
    await comfyPage.actionbar.propertiesButton.click()
    await comfyPage.nodeOps.selectNodes(['KSampler'])
  })

  test('should show pencil icon for editable title', async () => {
    await expect(panel.titleEditIcon).toBeVisible()
  })

  test('should enter edit mode on pencil click', async () => {
    await panel.titleEditIcon.click()
    await expect(panel.titleInput).toBeVisible()
  })

  test('should update node title on edit', async () => {
    const newTitle = 'My Custom Sampler'
    await panel.editTitle(newTitle)
    await expect(panel.panelTitle).toContainText(newTitle)
  })

  test('should not show pencil icon for multi-selection', async ({
    comfyPage
  }) => {
    await comfyPage.nodeOps.selectNodes([
      'KSampler',
      'CLIP Text Encode (Prompt)'
    ])
    await expect(panel.titleEditIcon).toBeHidden()
  })

  test('should not show pencil icon when nothing is selected', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(() => {
      window.app!.canvas.deselectAll()
    })
    await expect(panel.panelTitle).toContainText('Workflow Overview')
    await expect(panel.titleEditIcon).toBeHidden()
  })
})
