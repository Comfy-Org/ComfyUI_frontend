import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'
import { PropertiesPanelHelper } from './PropertiesPanelHelper'

test.describe('Properties panel - Node selection', () => {
  let panel: PropertiesPanelHelper

  test.beforeEach(async ({ comfyPage }) => {
    panel = new PropertiesPanelHelper(comfyPage.page)
    await comfyPage.actionbar.propertiesButton.click()
  })

  test.describe('Single node', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.nodeOps.selectNodes(['KSampler'])
    })

    test('should show node title in panel header', async () => {
      await expect(panel.panelTitle).toContainText('KSampler')
    })

    test('should show Parameters, Info, and Settings tabs', async () => {
      await expect(panel.getTab('Parameters')).toBeVisible()
      await expect(panel.getTab('Info')).toBeVisible()
      await expect(panel.getTab('Settings')).toBeVisible()
    })

    test('should not show Nodes tab for single node', async () => {
      await expect(panel.getTab('Nodes')).not.toBeVisible()
    })

    test('should display node widgets in Parameters tab', async () => {
      await expect(panel.contentArea.getByText('seed')).toBeVisible()
      await expect(panel.contentArea.getByText('steps')).toBeVisible()
    })
  })

  test.describe('Multi-node', () => {
    test('should show item count in title', async ({ comfyPage }) => {
      await comfyPage.nodeOps.selectNodes([
        'KSampler',
        'CLIP Text Encode (Prompt)'
      ])
      await expect(panel.panelTitle).toContainText('3 items selected')
    })

    test('should list all selected nodes in Parameters tab', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.selectNodes([
        'KSampler',
        'CLIP Text Encode (Prompt)'
      ])
      await expect(panel.root.getByText('KSampler')).toHaveCount(1)
      await expect(
        panel.root.getByText('CLIP Text Encode (Prompt)')
      ).toHaveCount(2)
    })

    test('should not show Info tab for multi-selection', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.selectNodes([
        'KSampler',
        'CLIP Text Encode (Prompt)'
      ])
      await expect(panel.getTab('Info')).not.toBeVisible()
    })
  })

  test.describe('Selection changes', () => {
    test('should update from no selection to node selection', async ({
      comfyPage
    }) => {
      await expect(panel.panelTitle).toContainText('Workflow Overview')
      await comfyPage.nodeOps.selectNodes(['KSampler'])
      await expect(panel.panelTitle).toContainText('KSampler')
    })

    test('should update from node selection back to no selection', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.selectNodes(['KSampler'])
      await expect(panel.panelTitle).toContainText('KSampler')
      await comfyPage.page.evaluate(() => {
        window.app!.canvas.deselectAll()
      })
      await comfyPage.nextFrame()
      await expect(panel.panelTitle).toContainText('Workflow Overview')
    })

    test('should update between different single node selections', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.selectNodes(['KSampler'])
      await expect(panel.panelTitle).toContainText('KSampler')

      await comfyPage.page.evaluate(() => {
        window.app!.canvas.deselectAll()
      })
      await comfyPage.nextFrame()
      await comfyPage.nodeOps.selectNodes(['Empty Latent Image'])
      await expect(panel.panelTitle).toContainText('Empty Latent Image')
    })
  })

  test.describe('Tab labels', () => {
    test('should show "Parameters" tab for single node', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.selectNodes(['KSampler'])
      await expect(panel.getTab('Parameters')).toBeVisible()
    })

    test('should show "Nodes" tab label for multi-selection', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.selectNodes([
        'KSampler',
        'CLIP Text Encode (Prompt)'
      ])
      await expect(panel.getTab('Nodes')).toBeVisible()
    })
  })
})
