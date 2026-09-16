import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Workflow Tab Thumbnails', { tag: '@workflow' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    // oxlint-disable-next-line comfy/no-comfy-page-setup-call -- pre-existing call, tracked by evfail-23; not fixed in this pass
    await comfyPage.setup()
  })

  test('Should show thumbnail when hovering over a non-active tab', async ({
    comfyPage
  }) => {
    await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
    const popover = await comfyPage.menu.topbar.showWorkflowTabPopover(0)
    await expect(popover.root).toContainText('Unsaved Workflow')
    await expect(popover.thumbnail).toBeVisible()
  })

  test('Should not show thumbnail for active tab', async ({ comfyPage }) => {
    await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
    const popover = await comfyPage.menu.topbar.showWorkflowTabPopover(1)
    await expect(popover.root).toContainText('Unsaved Workflow (2)')
    await expect(popover.thumbnail).toBeHidden()
  })

  test('Thumbnail should update when switching tabs', async ({ comfyPage }) => {
    // Multiple workflow switches and thumbnail renders can exceed the default
    // timeout on loaded CI workers.
    test.slow()

    // Wait for initial workflow to load
    await comfyPage.nextFrame()

    // Create a new workflow (tab 1) which will be empty
    await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
    await comfyPage.nextFrame()

    // Now we have two tabs: tab 0 (default workflow with nodes) and tab 1 (empty)
    // Tab 1 is currently active, so we can only get thumbnail for tab 0

    // Step 1: Different tabs should show different previews
    await comfyPage.menu.topbar.showWorkflowTabPopover(0)
    const tab0ThumbnailWithNodes =
      await comfyPage.menu.topbar.workflowTabPopover.readThumbnailDataUrl()

    // Add a node to tab 1 (current active tab)
    await comfyPage.menu.topbar.workflowTabPopover.dismiss()
    await comfyPage.nodeOps.addNode('CheckpointLoaderSimple', undefined, {
      x: 200,
      y: 200
    })
    await comfyPage.nextFrame()

    // Switch to tab 0 so we can get tab 1's thumbnail
    await comfyPage.menu.topbar.getTab(0).click()
    await comfyPage.nextFrame()

    await comfyPage.menu.topbar.showWorkflowTabPopover(1)
    const tab1ThumbnailWithNode =
      await comfyPage.menu.topbar.workflowTabPopover.readThumbnailDataUrl()

    // The thumbnails should be different
    expect(tab0ThumbnailWithNodes).not.toBe(tab1ThumbnailWithNode)

    // Step 2: Switching without changes shouldn't update thumbnail
    await comfyPage.menu.topbar.showWorkflowTabPopover(1)
    const tab1ThumbnailBefore =
      await comfyPage.menu.topbar.workflowTabPopover.readThumbnailDataUrl()

    // Switch to tab 1 and back to tab 0 without making changes
    await comfyPage.menu.topbar.getTab(1).click()
    await comfyPage.nextFrame()
    await comfyPage.menu.topbar.getTab(0).click()
    await comfyPage.nextFrame()

    await comfyPage.menu.topbar.showWorkflowTabPopover(1)
    const tab1ThumbnailAfter =
      await comfyPage.menu.topbar.workflowTabPopover.readThumbnailDataUrl()
    expect(tab1ThumbnailBefore).toBe(tab1ThumbnailAfter)

    // Step 3: Adding another node should cause thumbnail to change
    await comfyPage.nodeOps.addNode('VAELoader', undefined, { x: 200, y: 200 })
    await comfyPage.nextFrame()

    // Switch to tab 1 and back to update tab 0's thumbnail
    await comfyPage.menu.topbar.getTab(1).click()

    await comfyPage.menu.topbar.showWorkflowTabPopover(0)
    const tab0ThumbnailAfterNewNode =
      await comfyPage.menu.topbar.workflowTabPopover.readThumbnailDataUrl()

    // The thumbnail should have changed after adding a node
    expect(tab0ThumbnailWithNodes).not.toBe(tab0ThumbnailAfterNewNode)
  })
})
