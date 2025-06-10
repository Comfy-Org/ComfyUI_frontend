import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { getMiddlePoint } from '../fixtures/utils/litegraphUtils'
import { PerformanceMonitor } from '../helpers/performanceMonitor'

test.describe('Reroute Node', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.setupWorkflowsDirectory({})
  })

  test('@perf loads from inserted workflow', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'load-workflow-with-reroute'

    await perfMonitor.startMonitoring(testName)

    const workflowName = 'single_connected_reroute_node.json'
    await perfMonitor.measureOperation('setup-workflow-directory', async () => {
      await comfyPage.setupWorkflowsDirectory({
        [workflowName]: workflowName
      })
    })

    await perfMonitor.measureOperation('setup-page', async () => {
      await comfyPage.setup()
    })

    await perfMonitor.measureOperation('create-new-workflow', async () => {
      await comfyPage.menu.topbar.triggerTopbarCommand(['Workflow', 'New'])
    })

    // Insert the workflow
    const workflowsTab = comfyPage.menu.workflowsTab
    await perfMonitor.measureOperation('open-workflows-tab', async () => {
      await workflowsTab.open()
    })

    await perfMonitor.measureOperation('insert-workflow', async () => {
      await workflowsTab
        .getPersistedItem(workflowName)
        .click({ button: 'right' })
      const insertButton = comfyPage.page.locator('.p-contextmenu-item-link', {
        hasText: 'Insert'
      })
      await insertButton.click()
    })

    await perfMonitor.measureOperation('close-sidebar', async () => {
      // Close the sidebar tab
      await workflowsTab.tabButton.click()
      await workflowsTab.root.waitFor({ state: 'hidden' })
    })

    await perfMonitor.measureOperation('set-focus-mode', async () => {
      await comfyPage.setFocusMode(true)
    })

    await expect(comfyPage.canvas).toHaveScreenshot('reroute_inserted.png')

    await perfMonitor.finishMonitoring(testName)
  })
})

test.describe('LiteGraph Native Reroute Node', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('LiteGraph.Reroute.SplineOffset', 80)
  })

  test('@perf loads from workflow', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'load-native-reroute-workflow'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('reroute/native_reroute')
    })

    await expect(comfyPage.canvas).toHaveScreenshot('native_reroute.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can add reroute by alt clicking on link', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'add-reroute-alt-click'

    await perfMonitor.startMonitoring(testName)

    let loadCheckpointNode: any
    let clipEncodeNode: any

    await perfMonitor.measureOperation('get-nodes', async () => {
      loadCheckpointNode = (
        await comfyPage.getNodeRefsByTitle('Load Checkpoint')
      )[0]
      clipEncodeNode = (
        await comfyPage.getNodeRefsByTitle('CLIP Text Encode (Prompt)')
      )[0]
    })

    let slot1: any
    let slot2: any
    let middlePoint: any

    await perfMonitor.measureOperation('calculate-link-position', async () => {
      slot1 = await loadCheckpointNode.getOutput(1)
      slot2 = await clipEncodeNode.getInput(0)
      middlePoint = getMiddlePoint(
        await slot1.getPosition(),
        await slot2.getPosition()
      )
    })

    await perfMonitor.measureOperation('alt-click-link', async () => {
      await comfyPage.page.keyboard.down('Alt')
      await comfyPage.page.mouse.click(middlePoint.x, middlePoint.y)
      await comfyPage.page.keyboard.up('Alt')
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'native_reroute_alt_click.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can add reroute by clicking middle of link context menu', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'add-reroute-context-menu'

    await perfMonitor.startMonitoring(testName)

    let loadCheckpointNode: any
    let clipEncodeNode: any

    await perfMonitor.measureOperation('get-nodes', async () => {
      loadCheckpointNode = (
        await comfyPage.getNodeRefsByTitle('Load Checkpoint')
      )[0]
      clipEncodeNode = (
        await comfyPage.getNodeRefsByTitle('CLIP Text Encode (Prompt)')
      )[0]
    })

    let slot1: any
    let slot2: any
    let middlePoint: any

    await perfMonitor.measureOperation('calculate-link-position', async () => {
      slot1 = await loadCheckpointNode.getOutput(1)
      slot2 = await clipEncodeNode.getInput(0)
      middlePoint = getMiddlePoint(
        await slot1.getPosition(),
        await slot2.getPosition()
      )
    })

    await perfMonitor.measureOperation(
      'click-link-for-context-menu',
      async () => {
        await comfyPage.page.mouse.click(middlePoint.x, middlePoint.y)
      }
    )

    // Context menu interaction not monitored (floating menu - skip per guide)
    await comfyPage.page
      .locator('.litecontextmenu .litemenu-entry', { hasText: 'Add Reroute' })
      .click()

    await expect(comfyPage.canvas).toHaveScreenshot(
      'native_reroute_context_menu.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })
})
