import {
  ComfyPage,
  comfyPageFixture as test,
  comfyExpect as expect
} from './fixtures/ComfyPage'

async function beforeChange(comfyPage: ComfyPage) {
  await comfyPage.page.evaluate(() => {
    window['app'].canvas.emitBeforeChange()
  })
}
async function afterChange(comfyPage: ComfyPage) {
  await comfyPage.page.evaluate(() => {
    window['app'].canvas.emitAfterChange()
  })
}

test.describe('Change Tracker', () => {
  test('Can group multiple change actions into a single transaction', async ({
    comfyPage
  }) => {
    const node = (await comfyPage.getFirstNodeRef())!
    expect(node).toBeTruthy()
    await expect(node).not.toBeCollapsed()
    await expect(node).not.toBeBypassed()

    // Make changes outside set
    // Bypass + collapse node
    await node.click('collapse')
    await comfyPage.ctrlB()
    await expect(node).toBeCollapsed()
    await expect(node).toBeBypassed()

    // Undo, undo, ensure both changes undone
    await comfyPage.ctrlZ()
    await expect(node).not.toBeBypassed()
    await expect(node).toBeCollapsed()
    await comfyPage.ctrlZ()
    await expect(node).not.toBeBypassed()
    await expect(node).not.toBeCollapsed()

    // Run again, but within a change transaction
    beforeChange(comfyPage)

    await node.click('collapse')
    await comfyPage.ctrlB()
    await expect(node).toBeCollapsed()
    await expect(node).toBeBypassed()

    // End transaction
    afterChange(comfyPage)

    // Ensure undo reverts both changes
    await comfyPage.ctrlZ()
    await expect(node).not.toBeBypassed()
    await expect(node).not.toBeCollapsed()
  })

  test('Can group multiple transaction calls into a single one', async ({
    comfyPage
  }) => {
    const node = (await comfyPage.getFirstNodeRef())!
    const bypassAndPin = async () => {
      await beforeChange(comfyPage)
      await comfyPage.ctrlB()
      await expect(node).toBeBypassed()
      await comfyPage.page.keyboard.press('KeyP')
      await comfyPage.nextFrame()
      await expect(node).toBePinned()
      await afterChange(comfyPage)
    }

    const collapse = async () => {
      await beforeChange(comfyPage)
      await node.click('collapse', { moveMouseToEmptyArea: true })
      await expect(node).toBeCollapsed()
      await afterChange(comfyPage)
    }

    const multipleChanges = async () => {
      await beforeChange(comfyPage)
      // Call other actions that uses begin/endChange
      await collapse()
      await bypassAndPin()
      await afterChange(comfyPage)
    }

    await multipleChanges()

    await comfyPage.ctrlZ()
    await expect(node).not.toBeBypassed()
    await expect(node).not.toBePinned()
    await expect(node).not.toBeCollapsed()

    await comfyPage.ctrlY()
    await expect(node).toBeBypassed()
    await expect(node).toBePinned()
    await expect(node).toBeCollapsed()
  })
})
