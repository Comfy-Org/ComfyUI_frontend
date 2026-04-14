import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { getNodeClipRegion } from '@e2e/fixtures/utils/screenshotClip'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

// If an input is optional by node definition, it should be shown as
// a hollow circle no matter what shape it was defined in the workflow JSON.
test.describe('Optional input', { tag: ['@screenshot', '@node'] }, () => {
  test('No shape specified', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('inputs/optional_input_no_shape')
    const node = (await comfyPage.nodeOps.getFirstNodeRef())!
    const clip = await getNodeClipRegion(comfyPage, [node.id])
    await expect(comfyPage.page).toHaveScreenshot('optional_input.png', {
      clip
    })
  })

  test('Wrong shape specified', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('inputs/optional_input_wrong_shape')
    const node = (await comfyPage.nodeOps.getFirstNodeRef())!
    const clip = await getNodeClipRegion(comfyPage, [node.id])
    await expect(comfyPage.page).toHaveScreenshot('optional_input.png', {
      clip
    })
  })

  test('Correct shape specified', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('inputs/optional_input_correct_shape')
    const node = (await comfyPage.nodeOps.getFirstNodeRef())!
    const clip = await getNodeClipRegion(comfyPage, [node.id])
    await expect(comfyPage.page).toHaveScreenshot('optional_input.png', {
      clip
    })
  })

  test('Force input', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('inputs/force_input')
    const node = (await comfyPage.nodeOps.getFirstNodeRef())!
    const clip = await getNodeClipRegion(comfyPage, [node.id])
    await expect(comfyPage.page).toHaveScreenshot('force_input.png', {
      clip
    })
  })

  test('Default input', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('inputs/default_input')
    const node = (await comfyPage.nodeOps.getFirstNodeRef())!
    const clip = await getNodeClipRegion(comfyPage, [node.id])
    await expect(comfyPage.page).toHaveScreenshot('default_input.png', {
      clip
    })
  })

  test('Only optional inputs', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('inputs/only_optional_inputs')
    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(1)
    await expect(
      comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
    ).toBeHidden()

    // If the node's multiline text widget is visible, then it was loaded successfully
    await expect(comfyPage.page.locator('.comfy-multiline-input')).toHaveCount(
      1
    )
  })

  test('Old workflow with converted input', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('inputs/old_workflow_converted_input')
    const node = await comfyPage.nodeOps.getNodeRefById('1')
    const inputs = (await node.getProperty('inputs')) as {
      name: string
      link?: number | null
    }[]
    const vaeInput = inputs.find((w) => w.name === 'vae')
    const convertedInput = inputs.find((w) => w.name === 'strength')

    expect(vaeInput).toBeDefined()
    expect(convertedInput).toBeDefined()
    expect(vaeInput!.link).toBeNull()
    expect(convertedInput!.link).not.toBeNull()
  })

  test('Renamed converted input', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('inputs/renamed_converted_widget')
    const node = await comfyPage.nodeOps.getNodeRefById('3')
    const inputs = (await node.getProperty('inputs')) as { name: string }[]
    const renamedInput = inputs.find((w) => w.name === 'breadth')
    expect(renamedInput).toBeUndefined()
  })

  test('slider', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('inputs/simple_slider')
    const node = (await comfyPage.nodeOps.getFirstNodeRef())!
    const clip = await getNodeClipRegion(comfyPage, [node.id])
    await expect(comfyPage.page).toHaveScreenshot('simple_slider.png', {
      clip
    })
  })

  test('unknown converted widget', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow(
      'missing/missing_nodes_converted_widget'
    )
    const node = (await comfyPage.nodeOps.getFirstNodeRef())!
    const clip = await getNodeClipRegion(comfyPage, [node.id])
    await expect(comfyPage.page).toHaveScreenshot(
      'missing_nodes_converted_widget.png',
      { clip }
    )
  })

  test('dynamically added input', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('inputs/dynamically_added_input')
    const node = (await comfyPage.nodeOps.getFirstNodeRef())!
    const clip = await getNodeClipRegion(comfyPage, [node.id])
    await expect(comfyPage.page).toHaveScreenshot(
      'dynamically_added_input.png',
      { clip }
    )
  })
})
