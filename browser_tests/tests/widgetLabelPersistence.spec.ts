import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import type { WorkspaceStore } from '@e2e/types/globals'
import type { NodeId } from '@/types/nodeId'

/**
 * Regression (#13861): a renamed socketless / DOM widget label was lost after
 * delete + undo and after copy-paste. Both paths round-trip through
 * LGraphNode.serialize() / configure(), which only persisted the rename via the
 * `input.label` mirror — absent for socketless widgets. This walks the exact QA
 * repro on a CLIPTextEncode `text` DOM widget (no backing input slot).
 *
 * The rename is applied programmatically because the bug is in persistence, not
 * in the rename UI; the delete→undo and copy→paste operations are driven through
 * the real app so the serialize/configure round-trip is genuinely exercised.
 */
const RENAMED_LABEL = 'Renamed Widget Label'
const WIDGET_NAME = 'text'

async function renameFirstTextWidget(comfyPage: ComfyPage): Promise<NodeId> {
  return comfyPage.page.evaluate(
    ({ widgetName, label }) => {
      const node = window.app!.graph.nodes.find(
        (n) => n.type === 'CLIPTextEncode'
      )!
      const widget = node.widgets!.find((w) => w.name === widgetName)!
      const mirrored = node.inputs.some(
        (i) => i.widget?.name === widget.name && i.label != null
      )
      if (mirrored) throw new Error('text widget is not socketless')
      // Mimic the rename flow (renameWidget): a rename writes both the display
      // label and the userLabel signal that serialization keys off.
      widget.label = label
      widget.userLabel = label
      return node.id
    },
    { widgetName: WIDGET_NAME, label: RENAMED_LABEL }
  )
}

function countNodesWithRenamedLabel(comfyPage: ComfyPage): Promise<number> {
  return comfyPage.page.evaluate(
    ({ widgetName, label }) =>
      window.app!.graph.nodes.filter(
        (n) =>
          n.type === 'CLIPTextEncode' &&
          n.widgets?.find((w) => w.name === widgetName)?.label === label
      ).length,
    { widgetName: WIDGET_NAME, label: RENAMED_LABEL }
  )
}

function nodeExists(comfyPage: ComfyPage, nodeId: NodeId): Promise<boolean> {
  return comfyPage.page.evaluate(
    (id) => !!window.app!.graph.getNodeById(id),
    nodeId
  )
}

function labelForNode(
  comfyPage: ComfyPage,
  nodeId: NodeId
): Promise<string | undefined> {
  return comfyPage.page.evaluate(
    ({ id, widgetName }) =>
      window
        .app!.graph.getNodeById(id)
        ?.widgets?.find((w) => w.name === widgetName)?.label,
    { id: nodeId, widgetName: WIDGET_NAME }
  )
}

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
