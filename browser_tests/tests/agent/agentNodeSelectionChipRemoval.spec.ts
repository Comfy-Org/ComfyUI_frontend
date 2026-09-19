import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.describe('Agent node selection chip removal', { tag: '@cloud' }, () => {
  // PM-1226: removing a node's reference chip from the composer only drops
  // it from the composer's local list (useCanvasSelection#remove in
  // src/workbench/extensions/agent/composables/agent/useCanvasSelection.ts).
  // It never calls canvas.deselectAll()/canvasStore.updateSelectedItems(), so
  // the node stays highlighted on canvas after its chip disappears from the
  // composer. test.fail() pins this as a known repro until PM-1226 lands.
  test('clears the canvas highlight when its reference chip is removed from the composer', async ({
    agentPanel,
    comfyPage
  }) => {
    const node = await comfyPage.nodeOps.addNode('KSampler', undefined, {
      x: 400,
      y: 300
    })

    await agentPanel.open()
    await agentPanel.selectWorkflow()

    const panel = agentPanel.root
    await panel
      .getByRole('button', { name: enMessages.agent.addToPrompt })
      .click()
    await comfyPage.page
      .getByRole('menuitem', { name: enMessages.agent.nodes, exact: true })
      .click()
    await expect(
      comfyPage.page.getByTestId('node-selection-mode-banner')
    ).toBeVisible()

    await node.click('title')

    const removeButton = panel.getByRole('button', {
      name: `Remove KSampler #${node.id} reference`
    })
    await expect(removeButton).toBeVisible()
    expect(await node.getProperty<boolean>('is_selected')).toBe(true)

    await removeButton.click()
    await expect(removeButton).toHaveCount(0)

    test.fail()
    expect(await node.getProperty<boolean>('is_selected')).toBe(false)
  })
})
