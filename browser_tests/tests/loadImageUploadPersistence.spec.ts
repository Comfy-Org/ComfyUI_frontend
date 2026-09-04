/**
 * Dropping an image on a Load Image node must survive a browser
 * reload without an explicit save. `Comfy.Workflow.Persist` defaults to true
 * and writes a localStorage draft on every `graphChanged`, but the upload
 * commit never nudged the change tracker — and HTML5 drag-and-drop emits no
 * mouseup for its global hook to catch — so the draft kept the previous image.
 */
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const DROPPED_FILE = 'image64x64.webp'

test.describe('Load Image upload persistence', () => {
  test('keeps a dropped image across a reload without saving', async ({
    comfyPage,
    comfyFiles
  }) => {
    test.setTimeout(60000)

    await comfyPage.settings.setSetting('Comfy.Workflow.Persist', true)
    await comfyPage.nodeOps.clearGraph()
    await comfyPage.searchBoxV2.addNode('Load Image')

    const [loadImageNode] =
      await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    const { x, y } = await loadImageNode.getPosition()

    const readImageWidgetValue = () =>
      comfyPage.page.evaluate(
        () =>
          window.app?.graph?.nodes
            .find((node) => node.type === 'LoadImage')
            ?.widgets?.find((widget) => widget.name === 'image')?.value
      )

    // The server keeps the filename when the same bytes are uploaded again, so
    // asserting on the name rather than on "the value changed" keeps this test
    // correct whether or not a previous run already left the file behind.
    await comfyPage.dragDrop.dragAndDropFile(DROPPED_FILE, {
      dropPosition: { x, y },
      waitForUpload: true
    })
    comfyFiles.deleteAfterTest({ filename: DROPPED_FILE, type: 'input' })

    await expect.poll(readImageWidgetValue).toBe(DROPPED_FILE)

    // The draft carrying the new value is what survives the reload, so waiting
    // on it also covers the 512ms persist debounce.
    await expect
      .poll(
        () =>
          comfyPage.page.evaluate((expected) => {
            for (let i = 0; i < window.localStorage.length; i++) {
              const key = window.localStorage.key(i)
              if (!key?.startsWith('Comfy.Workflow.Draft.v2:')) continue
              if (window.localStorage.getItem(key)?.includes(expected))
                return true
            }
            return false
          }, DROPPED_FILE),
        { timeout: 10_000 }
      )
      .toBe(true)

    await comfyPage.workflow.reloadAndWaitForApp()

    await expect.poll(readImageWidgetValue).toBe(DROPPED_FILE)
  })
})
