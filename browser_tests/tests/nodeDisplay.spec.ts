import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

// If an input is optional by node definition, it should be shown as
// a hollow circle no matter what shape it was defined in the workflow JSON.
test.describe('Optional input', () => {
  test('No shape specified', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('optional_input_no_shape')
    await expect(comfyPage.canvas).toHaveScreenshot('optional_input.png')
  })

  test('Wrong shape specified', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('optional_input_wrong_shape')
    await expect(comfyPage.canvas).toHaveScreenshot('optional_input.png')
  })

  test('Correct shape specified', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('optional_input_correct_shape')
    await expect(comfyPage.canvas).toHaveScreenshot('optional_input.png')
  })

  test('Force input', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('force_input')
    await expect(comfyPage.canvas).toHaveScreenshot('force_input.png')
  })

  test('Only optional inputs', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('only_optional_inputs')
    expect(await comfyPage.getGraphNodesCount()).toBe(1)
    await expect(
      comfyPage.page.locator('.comfy-missing-nodes')
    ).not.toBeVisible()

    // If the node's multiline text widget is visible, then it was loaded successfully
    await expect(comfyPage.page.locator('.comfy-multiline-input')).toHaveCount(
      1
    )
  })
  test('Old workflow with converted input', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('old_workflow_converted_input')
    const node = await comfyPage.getNodeRefById('1')
    const inputs = await node.getProperty('inputs')
    const vaeInput = inputs.find((w) => w.name === 'vae')
    const convertedInput = inputs.find((w) => w.name === 'strength')

    expect(vaeInput).toBeDefined()
    expect(convertedInput).toBeDefined()
    expect(vaeInput.link).toBeNull()
    expect(convertedInput.link).not.toBeNull()
  })
  test('Renamed converted input', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('renamed_converted_widget')
    const node = await comfyPage.getNodeRefById('3')
    const inputs = await node.getProperty('inputs')
    const renamedInput = inputs.find((w) => w.name === 'breadth')
    expect(renamedInput).toBeUndefined()
  })
  test('slider', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('simple_slider')
    await expect(comfyPage.canvas).toHaveScreenshot('simple_slider.png')
  })
  test('unknown converted widget', async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.Workflow.ShowMissingNodesWarning', false)
    await comfyPage.loadWorkflow('missing_nodes_converted_widget')
    await expect(comfyPage.canvas).toHaveScreenshot(
      'missing_nodes_converted_widget.png'
    )
  })
})
