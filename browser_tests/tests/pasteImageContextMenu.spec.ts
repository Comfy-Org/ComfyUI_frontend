import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Paste Image context menu option', { tag: ['@node'] }, () => {
  test('shows Paste Image in LoadImage node context menu', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')

    const loadImageNode = (
      await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    )[0]

    const menuOptions = await loadImageNode.getContextMenuOptionNames()

    expect(menuOptions).toContain('Paste Image')
  })

  test('does not show Paste Image on output-only image nodes', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/single_save_image_node')

    const saveImageNode = (
      await comfyPage.nodeOps.getNodeRefsByType('SaveImage')
    )[0]

    const menuOptions = await saveImageNode.getContextMenuOptionNames()

    expect(menuOptions).not.toContain('Paste Image')
  })
})
