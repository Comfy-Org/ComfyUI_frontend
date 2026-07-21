import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import type { WorkspaceStore } from '@e2e/types/globals'
import type { NodeId } from '@/types/nodeId'

/**
 * Regression (#13861): a renamed widget label was lost after delete + undo and
 * after copy-paste. Both paths round-trip through LGraphNode.serialize() /
 * configure(), which persist a rename via the backing `input.label` mirror. The
 * bug was in `renameWidget`: it looked up the input by `widgetId` whenever the
 * widget had one (every in-graph widget does), but a normal-node input carries
 * none, so the lookup missed and `input.label` was never written. This walks the
 * QA repro on a CLIPTextEncode `text` widget through the real app.
 *
 * The rename mirrors the fixed `renameWidget` effect — display `label` plus the
 * backing `input.label` (matched by widget name), the channel the label
 * persists through — because the bug is in persistence, not the rename UI. The
 * delete→undo and copy→paste operations are driven through the real app so the
 * serialize/configure round-trip is genuinely exercised.
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
      const input = node.inputs.find((i) => i.widget?.name === widget.name)
      if (!input)
        throw new Error('expected a backing input for the text widget')
      widget.label = label
      input.label = label
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
