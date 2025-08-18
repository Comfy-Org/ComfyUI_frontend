import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

// Constants
const INITIAL_NAME = 'initial_slot_name'
const RENAMED_NAME = 'renamed_slot_name'
const SECOND_RENAMED_NAME = 'second_renamed_name'

// Common selectors
const SELECTORS = {
  promptDialog: '.graphdialog input'
} as const

test.describe('Subgraph Slot Rename Dialog', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Disabled')
  })

  test('Shows current slot label (not stale) in rename dialog', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('subgraphs/basic-subgraph')

    const subgraphNode = await comfyPage.getNodeRefById('2')
    await subgraphNode.navigateIntoSubgraph()

    // Get initial slot label
    const initialInputLabel = await comfyPage.page.evaluate(() => {
      const graph = window['app'].canvas.graph
      return graph.inputs?.[0]?.label || graph.inputs?.[0]?.name || null
    })

    // First rename
    await comfyPage.rightClickSubgraphInputSlot(initialInputLabel)
    await comfyPage.clickLitegraphContextMenuItem('Rename Slot')

    await comfyPage.page.waitForSelector(SELECTORS.promptDialog, {
      state: 'visible'
    })

    // Clear and enter new name
    await comfyPage.page.fill(SELECTORS.promptDialog, '')
    await comfyPage.page.fill(SELECTORS.promptDialog, RENAMED_NAME)
    await comfyPage.page.keyboard.press('Enter')

    // Wait for dialog to close
    await comfyPage.page.waitForSelector(SELECTORS.promptDialog, {
      state: 'hidden'
    })

    // Force re-render
    await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
    await comfyPage.nextFrame()

    // Verify the rename worked
    const afterFirstRename = await comfyPage.page.evaluate(() => {
      const graph = window['app'].canvas.graph
      const slot = graph.inputs?.[0]
      return {
        label: slot?.label || null,
        name: slot?.name || null,
        displayName: slot?.displayName || slot?.label || slot?.name || null
      }
    })
    expect(afterFirstRename.label).toBe(RENAMED_NAME)

    // Now rename again - this is where the bug would show
    // We need to use the index-based approach since the method looks for slot.name
    await comfyPage.rightClickSubgraphInputSlot()
    await comfyPage.clickLitegraphContextMenuItem('Rename Slot')

    await comfyPage.page.waitForSelector(SELECTORS.promptDialog, {
      state: 'visible'
    })

    // Get the current value in the prompt dialog
    const dialogValue = await comfyPage.page.inputValue(SELECTORS.promptDialog)

    // This should show the current label (RENAMED_NAME), not the original name
    expect(dialogValue).toBe(RENAMED_NAME)
    expect(dialogValue).not.toBe(afterFirstRename.name) // Should not show the original slot.name

    // Complete the second rename to ensure everything still works
    await comfyPage.page.fill(SELECTORS.promptDialog, '')
    await comfyPage.page.fill(SELECTORS.promptDialog, SECOND_RENAMED_NAME)
    await comfyPage.page.keyboard.press('Enter')

    // Wait for dialog to close
    await comfyPage.page.waitForSelector(SELECTORS.promptDialog, {
      state: 'hidden'
    })

    // Force re-render
    await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
    await comfyPage.nextFrame()

    // Verify the second rename worked
    const afterSecondRename = await comfyPage.page.evaluate(() => {
      const graph = window['app'].canvas.graph
      return graph.inputs?.[0]?.label || null
    })
    expect(afterSecondRename).toBe(SECOND_RENAMED_NAME)
  })

  test('Shows current output slot label in rename dialog', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('subgraphs/basic-subgraph')

    const subgraphNode = await comfyPage.getNodeRefById('2')
    await subgraphNode.navigateIntoSubgraph()

    // Get initial output slot label
    const initialOutputLabel = await comfyPage.page.evaluate(() => {
      const graph = window['app'].canvas.graph
      return graph.outputs?.[0]?.label || graph.outputs?.[0]?.name || null
    })

    // First rename
    await comfyPage.rightClickSubgraphOutputSlot(initialOutputLabel)
    await comfyPage.clickLitegraphContextMenuItem('Rename Slot')

    await comfyPage.page.waitForSelector(SELECTORS.promptDialog, {
      state: 'visible'
    })

    // Clear and enter new name
    await comfyPage.page.fill(SELECTORS.promptDialog, '')
    await comfyPage.page.fill(SELECTORS.promptDialog, RENAMED_NAME)
    await comfyPage.page.keyboard.press('Enter')

    // Wait for dialog to close
    await comfyPage.page.waitForSelector(SELECTORS.promptDialog, {
      state: 'hidden'
    })

    // Force re-render
    await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
    await comfyPage.nextFrame()

    // Now rename again to check for stale content
    // We need to use the index-based approach since the method looks for slot.name
    await comfyPage.rightClickSubgraphOutputSlot()
    await comfyPage.clickLitegraphContextMenuItem('Rename Slot')

    await comfyPage.page.waitForSelector(SELECTORS.promptDialog, {
      state: 'visible'
    })

    // Get the current value in the prompt dialog
    const dialogValue = await comfyPage.page.inputValue(SELECTORS.promptDialog)

    // This should show the current label (RENAMED_NAME), not the original name
    expect(dialogValue).toBe(RENAMED_NAME)
  })
})
