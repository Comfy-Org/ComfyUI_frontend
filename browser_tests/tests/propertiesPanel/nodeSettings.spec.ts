import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

test.describe('Properties panel - Node settings', () => {
  let panel: PropertiesPanelHelper

  test.beforeEach(async ({ comfyPage }) => {
    panel = new PropertiesPanelHelper(comfyPage.page)
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.vueNodes.waitForNodes()
    await comfyPage.actionbar.propertiesButton.click()
    await comfyPage.nodeOps.selectNodes(['KSampler'])
    await panel.switchToTab('Settings')
  })

  test.describe('Node state', () => {
    test('should show Normal, Bypass, and Mute state buttons', async () => {
      await expect(panel.getNodeStateButton('Normal')).toBeVisible()
      await expect(panel.getNodeStateButton('Bypass')).toBeVisible()
      await expect(panel.getNodeStateButton('Mute')).toBeVisible()
    })

    test('should set node to Bypass mode', async ({ comfyPage }) => {
      await panel.getNodeStateButton('Bypass').click()

      const nodeLocator = comfyPage.vueNodes.getNodeByTitle('KSampler')
      await expect(nodeLocator.getByText('Bypassed')).toBeVisible()
    })

    test('should set node to Mute mode', async ({ comfyPage }) => {
      await panel.getNodeStateButton('Mute').click()

      const nodeLocator = comfyPage.vueNodes.getNodeByTitle('KSampler')
      await expect(nodeLocator.getByText('Muted')).toBeVisible()
    })

    test('should restore node to Normal mode', async ({ comfyPage }) => {
      await panel.getNodeStateButton('Bypass').click()
      const nodeLocator = comfyPage.vueNodes.getNodeByTitle('KSampler')
      await expect(nodeLocator.getByText('Bypassed')).toBeVisible()

      await panel.getNodeStateButton('Normal').click()
      await expect(nodeLocator.getByText('Bypassed')).toBeHidden()
      await expect(nodeLocator.getByText('Muted')).toBeHidden()
    })
  })

  test.describe('Node color', () => {
    test('should display color swatches', async () => {
      await expect(panel.getColorSwatch('noColor')).toBeVisible()
      await expect(panel.getColorSwatch('red')).toBeVisible()
      await expect(panel.getColorSwatch('blue')).toBeVisible()
    })

    test('should apply color to node', async ({ comfyPage }) => {
      await panel.getColorSwatch('red').click()

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const selected = window.app!.canvas.selected_nodes
            const node = Object.values(selected)[0]
            return node?.color != null
          })
        )
        .toBe(true)
    })

    test('should remove color with noColor swatch', async ({ comfyPage }) => {
      await panel.getColorSwatch('red').click()

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const selected = window.app!.canvas.selected_nodes
            const node = Object.values(selected)[0]
            return node?.color != null
          })
        )
        .toBe(true)

      await panel.getColorSwatch('noColor').click()

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const selected = window.app!.canvas.selected_nodes
            const node = Object.values(selected)[0]
            return node?.color
          })
        )
        .toBeFalsy()
    })
  })

  test.describe('Pinned state', () => {
    test('should display pinned toggle', async () => {
      await expect(panel.pinnedSwitch).toBeVisible()
    })

    test('should toggle pinned state', async ({ comfyPage }) => {
      await panel.pinnedSwitch.click()

      const nodeLocator = comfyPage.vueNodes.getNodeByTitle('KSampler')
      await expect(nodeLocator.getByTestId('node-pin-indicator')).toBeVisible()
    })

    test('should unpin previously pinned node', async ({ comfyPage }) => {
      const nodeLocator = comfyPage.vueNodes.getNodeByTitle('KSampler')

      await panel.pinnedSwitch.click()
      await expect(nodeLocator.getByTestId('node-pin-indicator')).toBeVisible()

      await panel.pinnedSwitch.click()
      await expect(
        nodeLocator.getByTestId('node-pin-indicator')
      ).toBeHidden()
    })
  })
})
