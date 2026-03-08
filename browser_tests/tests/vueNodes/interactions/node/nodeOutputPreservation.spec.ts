import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../../../fixtures/ComfyPage'

test.describe('Node Output Preservation', { tag: ['@widget', '@node'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
  })

  test('Execution output widget value survives tab switch', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('execution/partial_execution')

    const outputNode = await comfyPage.nodeOps.getNodeRefById(1)
    expect(await (await outputNode.getWidget(0)).getValue()).toBe('')

    await outputNode.click('title')
    await comfyPage.command.executeCommand('Comfy.QueueSelectedOutputNodes')
    await expect(async () => {
      expect(await (await outputNode.getWidget(0)).getValue()).toBe('foo')
    }).toPass({ timeout: 5_000 })

    // Enable topbar tabs after execution so we can switch workflows
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Topbar'
    )

    await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
    await comfyPage.nextFrame()

    const firstTab = comfyPage.menu.topbar.getWorkflowTab('partial_execution')
    await firstTab.click()
    await comfyPage.nextFrame()

    await expect(async () => {
      expect(await (await outputNode.getWidget(0)).getValue()).toBe('foo')
    }).toPass({ timeout: 5_000 })
  })

  test('Outputs on different tabs are independent', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('execution/partial_execution')

    const outputNode1 = await comfyPage.nodeOps.getNodeRefById(1)
    await outputNode1.click('title')
    await comfyPage.command.executeCommand('Comfy.QueueSelectedOutputNodes')
    await expect(async () => {
      expect(await (await outputNode1.getWidget(0)).getValue()).toBe('foo')
    }).toPass({ timeout: 5_000 })

    // Enable topbar tabs after execution so we can switch workflows
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Topbar'
    )

    await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
    await comfyPage.nextFrame()

    const newOutputCount = await comfyPage.page.evaluate(
      () => Object.keys(window.app!.nodeOutputs).length
    )
    expect(newOutputCount).toBe(0)

    const firstTab = comfyPage.menu.topbar.getWorkflowTab('partial_execution')
    await firstTab.click()
    await comfyPage.nextFrame()

    await expect(async () => {
      expect(await (await outputNode1.getWidget(0)).getValue()).toBe('foo')
    }).toPass({ timeout: 5_000 })
  })
})
