import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { getGroupTitlePosition } from '@e2e/fixtures/utils/groupHelpers'

/**
 * Returns {selectedNodeCount, selectedGroupCount, selectedItemCount}
 * from the canvas in the browser.
 */
async function getSelectionCounts(comfyPage: ComfyPage) {
  return comfyPage.page.evaluate(() => {
    const canvas = window.app!.canvas
    let selectedNodeCount = 0
    let selectedGroupCount = 0
    for (const item of canvas.selectedItems) {
      if ('inputs' in item || 'outputs' in item) selectedNodeCount++
      else selectedGroupCount++
    }
    return {
      selectedNodeCount,
      selectedGroupCount,
      selectedItemCount: canvas.selectedItems.size
    }
  })
}

test.describe('Group Select Children', { tag: ['@canvas', '@node'] }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('Setting enabled: clicking outer group selects nested group and inner node', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting(
      'LiteGraph.Group.SelectChildrenOnClick',
      true
    )
    await comfyPage.workflow.loadWorkflow('groups/nested-groups-1-inner-node')

    const outerPos = await getGroupTitlePosition(comfyPage, 'Outer Group')
    await comfyPage.canvas.click({ position: outerPos })
    await comfyPage.nextFrame()

    // Outer Group + Inner Group + 1 node = 3 items
    await expect
      .poll(() => getSelectionCounts(comfyPage))
      .toMatchObject({
        selectedItemCount: 3,
        selectedGroupCount: 2,
        selectedNodeCount: 1
      })
  })

  test('Setting disabled: clicking outer group selects only the group', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting(
      'LiteGraph.Group.SelectChildrenOnClick',
      false
    )
    await comfyPage.workflow.loadWorkflow('groups/nested-groups-1-inner-node')

    const outerPos = await getGroupTitlePosition(comfyPage, 'Outer Group')
    await comfyPage.canvas.click({ position: outerPos })
    await comfyPage.nextFrame()

    await expect
      .poll(() => getSelectionCounts(comfyPage))
      .toMatchObject({
        selectedItemCount: 1,
        selectedGroupCount: 1,
        selectedNodeCount: 0
      })
  })

  test('Deselecting outer group deselects all children', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting(
      'LiteGraph.Group.SelectChildrenOnClick',
      true
    )
    await comfyPage.workflow.loadWorkflow('groups/nested-groups-1-inner-node')

    // Select the outer group (cascades to children)
    const outerPos = await getGroupTitlePosition(comfyPage, 'Outer Group')
    await comfyPage.canvas.click({ position: outerPos })
    await comfyPage.nextFrame()

    await expect
      .poll(() => getSelectionCounts(comfyPage))
      .toMatchObject({ selectedItemCount: 3 })

    // Deselect all via page.evaluate to avoid UI overlay interception
    await comfyPage.page.evaluate(() => {
      window.app!.canvas.deselectAll()
    })
    await comfyPage.nextFrame()

    await expect
      .poll(() => getSelectionCounts(comfyPage))
      .toMatchObject({ selectedItemCount: 0 })
  })
})
