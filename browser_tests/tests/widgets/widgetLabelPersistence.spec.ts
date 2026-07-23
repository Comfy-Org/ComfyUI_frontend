import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import {
  RENAMED_LABEL,
  countNodesWithRenamedLabel,
  labelForNode,
  nodeExists,
  renameFirstTextWidget
} from '@e2e/fixtures/utils/widgetLabelTestUtils'
import type { WorkspaceStore } from '@e2e/types/globals'

/**
 * Regression (#13861): a renamed widget label was lost after delete + undo and
 * after copy-paste. Both paths round-trip through LGraphNode.serialize() /
 * configure(), which persist a rename via the backing `input.label` mirror. The
 * bug was in `renameWidget`: it looked up the input by `widgetId` whenever the
 * widget had one, but a normal-node input carries none, so the lookup missed and
 * `input.label` was never written. This walks the QA repro on a CLIPTextEncode
 * `text` widget through the real app.
 */
test.describe('Widget label persistence (regression #13861)', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.nextFrame()
  })

  test('renamed widget label survives copy-paste', async ({ comfyPage }) => {
    await renameFirstTextWidget(comfyPage)
    await expect.poll(() => countNodesWithRenamedLabel(comfyPage)).toBe(1)

    const node = (
      await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
    )[0]
    await node.click('title')
    await comfyPage.page.mouse.move(10, 10)
    await comfyPage.nextFrame()
    await comfyPage.clipboard.copy()
    await comfyPage.clipboard.paste()
    await comfyPage.nextFrame()

    await expect.poll(() => countNodesWithRenamedLabel(comfyPage)).toBe(2)
  })

  test('renamed widget label survives delete + undo', async ({ comfyPage }) => {
    const nodeId = await renameFirstTextWidget(comfyPage)

    // Snapshot the rename into the change tracker so undo restores a state that
    // includes it, mirroring a user who renames then deletes.
    await comfyPage.page.evaluate(() => {
      const store = window.app!.extensionManager as WorkspaceStore
      store.workflow.activeWorkflow?.changeTracker?.captureCanvasState()
    })

    const node = (
      await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
    )[0]
    await node.click('title')
    await comfyPage.canvas.press('Delete')
    await expect.poll(() => nodeExists(comfyPage, nodeId)).toBe(false)

    await comfyPage.keyboard.undo()
    await expect.poll(() => nodeExists(comfyPage, nodeId)).toBe(true)

    await expect.poll(() => labelForNode(comfyPage, nodeId)).toBe(RENAMED_LABEL)
  })
})
