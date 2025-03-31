import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { getMiddlePoint } from '../fixtures/utils/litegraphUtils'

test.describe('Reroute Node', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.setupWorkflowsDirectory({})
  })

  test('loads from inserted workflow', async ({ comfyPage }) => {
    const workflowName = 'single_connected_reroute_node.json'
    await comfyPage.setupWorkflowsDirectory({
      [workflowName]: workflowName
    })
    await comfyPage.setup()
    await comfyPage.menu.topbar.triggerTopbarCommand(['Workflow', 'New'])

    // Insert the workflow
    const workflowsTab = comfyPage.menu.workflowsTab
    await workflowsTab.open()
    await workflowsTab.getPersistedItem(workflowName).click({ button: 'right' })
    const insertButton = comfyPage.page.locator('.p-contextmenu-item-link', {
      hasText: 'Insert'
    })
    await insertButton.click()

    // Close the sidebar tab
    await workflowsTab.tabButton.click()
    await workflowsTab.root.waitFor({ state: 'hidden' })
    await comfyPage.setFocusMode(true)

    await expect(comfyPage.canvas).toHaveScreenshot('reroute_inserted.png')
  })
})

test.describe('LiteGraph Native Reroute Node', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('LiteGraph.Reroute.SplineOffset', 80)
  })

  test('loads from workflow', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('reroute/native_reroute')
    await expect(comfyPage.canvas).toHaveScreenshot('native_reroute.png')
  })

  test('Can add reroute by alt clicking on link', async ({ comfyPage }) => {
    const loadCheckpointNode = (
      await comfyPage.getNodeRefsByTitle('Load Checkpoint')
    )[0]
    const clipEncodeNode = (
      await comfyPage.getNodeRefsByTitle('CLIP Text Encode (Prompt)')
    )[0]

    const slot1 = await loadCheckpointNode.getOutput(1)
    const slot2 = await clipEncodeNode.getInput(0)
    const middlePoint = getMiddlePoint(
      await slot1.getPosition(),
      await slot2.getPosition()
    )

    await comfyPage.page.keyboard.down('Alt')
    await comfyPage.page.mouse.click(middlePoint.x, middlePoint.y)
    await comfyPage.page.keyboard.up('Alt')

    await expect(comfyPage.canvas).toHaveScreenshot(
      'native_reroute_alt_click.png'
    )
  })

  test('Can add reroute by clicking middle of link context menu', async ({
    comfyPage
  }) => {
    const loadCheckpointNode = (
      await comfyPage.getNodeRefsByTitle('Load Checkpoint')
    )[0]
    const clipEncodeNode = (
      await comfyPage.getNodeRefsByTitle('CLIP Text Encode (Prompt)')
    )[0]

    const slot1 = await loadCheckpointNode.getOutput(1)
    const slot2 = await clipEncodeNode.getInput(0)
    const middlePoint = getMiddlePoint(
      await slot1.getPosition(),
      await slot2.getPosition()
    )

    await comfyPage.page.mouse.click(middlePoint.x, middlePoint.y)
    await comfyPage.page
      .locator('.litecontextmenu .litemenu-entry', { hasText: 'Add Reroute' })
      .click()

    await expect(comfyPage.canvas).toHaveScreenshot(
      'native_reroute_context_menu.png'
    )
  })
})
